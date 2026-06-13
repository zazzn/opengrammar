// chrome.storage.local persistence for the LLM-taught learned-corrections store.
//
// The pure matcher lives in ../shared/learnedCorrections; this adds the live
// storage, an in-memory mirror for synchronous reads in the hot path, and the
// capture/forget hooks. Stored under `learnedCorrections` in storage.local (LOCAL,
// not sync: the map can grow and is device-specific learning).
import { normalizeLearnKey, type LearnedMap } from '../shared/learnedCorrections';

const STORAGE_KEY = 'learnedCorrections';

interface StoredEntry {
  /** Surface replacement to apply (e.g. "received"). */
  to: string;
  /** How many times the LLM/user confirmed this correction. */
  count: number;
  /** Last-confirmed epoch ms. */
  at: number;
}

const learned: LearnedMap = new Map();
let raw: Record<string, StoredEntry> = {};

/** The in-memory normalized-original -> replacement map for the hot path. */
export function getLearnedMap(): LearnedMap {
  return learned;
}

function rebuildMap(): void {
  learned.clear();
  for (const [key, entry] of Object.entries(raw)) {
    if (entry && typeof entry.to === 'string') learned.set(key, entry.to);
  }
}

/** Load the persisted store into memory. Call once on content-script init. */
export async function initLearnedCorrections(): Promise<void> {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    raw = (result[STORAGE_KEY] as Record<string, StoredEntry>) || {};
  } catch {
    raw = {};
  }
  rebuildMap();
}

/** Keep the in-memory map in sync when storage changes (other tabs/devices). */
export function onLearnedStorageChange(newValue: unknown): void {
  raw = (newValue as Record<string, StoredEntry>) || {};
  rebuildMap();
}

/**
 * Remember an LLM (or user-accepted) correction so the LOCAL engine applies it next
 * time without an LLM round-trip. Keyed by the normalized original; stores the
 * surface replacement. The high-conviction issuePolicy guards already vetted it, so
 * one confirmation is enough. Guards garbage: needs a real key, a non-empty target,
 * and the target must actually differ from the original.
 */
export function recordLearnedCorrection(original: string, suggestion: string): void {
  const key = normalizeLearnKey(original);
  const to = (suggestion || '').trim();
  if (key.length < 2 || !to || normalizeLearnKey(to) === key) return;
  const prev = raw[key];
  raw[key] = { to, count: (prev?.count ?? 0) + 1, at: Date.now() };
  learned.set(key, to);
  persist();
}

/** Forget a learned correction (the user reverted it, or removed it in options). */
export function forgetLearnedCorrection(original: string): void {
  const key = normalizeLearnKey(original);
  if (!(key in raw)) return;
  delete raw[key];
  learned.delete(key);
  persist();
}

function persist(): void {
  try {
    void chrome.storage.local.set({ [STORAGE_KEY]: raw });
  } catch {
    /* storage may be unavailable if the extension context was invalidated */
  }
}
