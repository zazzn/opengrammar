// At-rest protection for the provider API key (WebCrypto AES-GCM).
//
// HONEST SCOPE — read this before assuming "encrypted == safe":
// In a browser extension there is no true secret store: the extension must
// be able to decrypt the key to use it, so the AES key necessarily lives in
// the same trust boundary. This module therefore protects against:
//   • plaintext on disk / visible in the chrome.storage viewer
//   • the key being synced cross-device via chrome.storage.sync
//   • the key leaking into settings exports
// It does NOT protect against code already running in the extension's own
// context (inherent browser limitation). It is strong at-rest hygiene, not
// secrecy from a compromised extension.
//
// Layout:
//   chrome.storage.local["__ogApiKeyCryptoKey"] = base64 raw AES-256 key
//                                                 (device-only, never synced)
//   chrome.storage.local["apiKeyEnc"]          = { iv, ct } base64
//   legacy plaintext "apiKey" (sync or local)  = migrated then deleted
//
// Usable from every extension realm (service worker, popup, options,
// content script) — all have chrome.storage + crypto.subtle.

const KEY_ID = '__ogApiKeyCryptoKey';
const BLOB_ID = 'apiKeyEnc';
const LEGACY = 'apiKey';

interface EncBlob {
  iv: string;
  ct: string;
}

// crypto.subtle is secure-context-only. Extension pages + the service worker
// always qualify; a content script injected into an http:// page does not.
// The only content-script reader degrades gracefully (returns '') rather
// than throwing when subtle is unavailable there.
const subtleOk = (): boolean =>
  typeof crypto !== 'undefined' && !!crypto.subtle;

const b64 = (u: Uint8Array): string => btoa(String.fromCharCode(...u));
// Construct via `new Uint8Array(len)` so the buffer is a plain ArrayBuffer
// (not ArrayBufferLike) — required to satisfy WebCrypto's BufferSource.
const unb64 = (s: string): Uint8Array<ArrayBuffer> => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};

// Memoised per realm so concurrent callers (the background has several
// read sites) don't each generate a competing AES key on first run.
let keyPromise: Promise<CryptoKey> | null = null;

function loadCryptoKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const got = await chrome.storage.local.get(KEY_ID);
    const existing = got[KEY_ID];
    if (typeof existing === 'string' && existing) {
      return crypto.subtle.importKey(
        'raw',
        unb64(existing),
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      );
    }
    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt'],
    );
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    await chrome.storage.local.set({ [KEY_ID]: b64(raw) });
    return key;
  })();
  return keyPromise;
}

/** Encrypt + persist the key (device-local). Empty input clears it. */
export async function setApiKey(plain: string): Promise<void> {
  const clean = (plain || '').trim();
  if (!clean) {
    await clearAllApiKeys();
    return;
  }
  const key = await loadCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(clean),
    ),
  );
  await chrome.storage.local.set({
    [BLOB_ID]: { iv: b64(iv), ct: b64(ct) } satisfies EncBlob,
  });
  // Guarantee no plaintext remains anywhere.
  await chrome.storage.sync.remove(LEGACY);
  await chrome.storage.local.remove(LEGACY);
}

/**
 * Decrypt + return the key (''-on-miss). Transparently migrates any legacy
 * plaintext `apiKey` (older installs stored it in chrome.storage.sync) into
 * the encrypted store and removes the plaintext.
 */
export async function getApiKey(): Promise<string> {
  const [loc, syn] = await Promise.all([
    chrome.storage.local.get([BLOB_ID, LEGACY]),
    chrome.storage.sync.get(LEGACY),
  ]);

  const legacy =
    (typeof loc[LEGACY] === 'string' && loc[LEGACY]) ||
    (typeof syn[LEGACY] === 'string' && syn[LEGACY]) ||
    '';
  if (legacy) {
    // Migrate to the encrypted store where crypto is available; on an
    // http:// content page (no subtle) just return the legacy value.
    if (subtleOk()) await setApiKey(legacy);
    return legacy;
  }

  const blob = loc[BLOB_ID] as EncBlob | undefined;
  if (!blob || !blob.ct || !blob.iv || !subtleOk()) return '';
  try {
    const key = await loadCryptoKey();
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(blob.iv) },
      key,
      unb64(blob.ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    // Key rotated / blob corrupt → treat as no key rather than throw.
    return '';
  }
}

/** Remove every API-key artifact: ciphertext, AES key, legacy plaintext. */
export async function clearAllApiKeys(): Promise<void> {
  keyPromise = null;
  await Promise.all([
    chrome.storage.local.remove([BLOB_ID, LEGACY, KEY_ID]),
    chrome.storage.sync.remove(LEGACY),
  ]);
}
