// Direct LLM provider client. The extension no longer talks to a backend —
// the background service worker calls the provider's OpenAI-compatible
// /v1/chat/completions endpoint itself (manifest host_permissions: <all_urls>
// lets the SW bypass CORS). Prompt/param logic here is ported verbatim from
// the former backend (backend/src/index.ts) so output quality is unchanged.

/** Normalize an Ollama server URL to its OpenAI-compatible /v1 base. */
export function ollamaV1(url?: string): string {
  const b = (url || 'http://localhost:11434').trim().replace(/\/+$/, '');
  return /\/v1$/.test(b) ? b : `${b}/v1`;
}

/** Native Ollama API root (server root, not the OpenAI-compatible /v1). */
export function ollamaRoot(baseUrl?: string): string {
  return (baseUrl || 'http://localhost:11434')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');
}

function getProviderBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    abacus: 'https://routellm.abacus.ai/v1',
    ollama: 'http://localhost:11434/v1',
    custom: '',
  };
  return urls[provider] ?? urls.openai;
}

/**
 * The concrete OpenAI-compatible base URL to call, given the selected
 * provider and user settings. Ollama → the (tunnelled) Ollama /v1; custom
 * → the user's endpoint; everything else → the provider's known base.
 */
export function resolveBaseUrl(
  provider: string | undefined,
  customBaseUrl?: string,
  ollamaUrl?: string,
): string {
  if (provider === 'ollama') return ollamaV1(ollamaUrl);
  if (provider === 'custom') return customBaseUrl || '';
  return getProviderBaseUrl(provider || 'openai');
}

/**
 * Ollama-only: extra body field controlling how long Ollama keeps the model
 * resident after a request. Numeric tokens ("0","-1") → number (seconds);
 * durations ("2m") → string. Returns {} for other providers.
 */
export function ollamaKeepAliveParam(
  provider: string | undefined,
  keepAlive: string | undefined,
): Record<string, unknown> {
  if (provider !== 'ollama' || !keepAlive) return {};
  const v = /^-?\d+$/.test(keepAlive) ? Number(keepAlive) : keepAlive;
  return { keep_alive: v };
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * One OpenAI-compatible chat completion. Returns the assistant message
 * content (string). Throws on a non-2xx response so callers keep their
 * existing safe-fallback semantics.
 */
export async function chatCompletion(opts: {
  apiKey?: string;
  baseURL: string;
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
  responseFormat?: { type: string };
  extraBody?: Record<string, unknown>;
}): Promise<string> {
  const { apiKey, baseURL, model, messages, temperature, maxTokens, responseFormat, extraBody } =
    opts;
  const response = await fetch(`${baseURL.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || 'ollama'}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      ...(maxTokens ? { max_tokens: maxTokens } : {}),
      ...(responseFormat ? { response_format: responseFormat } : {}),
      ...(extraBody || {}),
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`LLM HTTP ${response.status}: ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
}

/**
 * Live model list for a provider (GET /v1/models). Returns up to 50 ids,
 * or [] on any failure so callers fall back to the static list.
 */
export async function listModels(
  provider: string,
  apiKey?: string,
  baseURL?: string,
): Promise<string[]> {
  try {
    const base = (baseURL || getProviderBaseUrl(provider)).replace(/\/+$/, '');
    const key = provider === 'ollama' ? 'ollama' : apiKey || '';
    const r = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const ids: string[] = (data?.data || []).map((m: { id: string }) => m.id);
    return ids.slice(0, 50);
  } catch {
    return [];
  }
}

async function ollamaFetchJson(
  root: string,
  path: string,
  ms: number,
  init?: RequestInit,
): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  const url = `${root}${path}`;
  const started = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const ms2 = Date.now() - started;
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      console.warn('[OGrammar] ollamaFetchJson HTTP', r.status, url, `${ms2}ms`, body.slice(0, 300));
      return null;
    }
    const j = await r.json();
    console.log('[OGrammar] ollamaFetchJson OK', url, `${ms2}ms`);
    return j;
  } catch (e) {
    const ms2 = Date.now() - started;
    console.error('[OGrammar] ollamaFetchJson ERR', url, `${ms2}ms`, e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Installed Ollama models via the native API (`/api/tags`, same source as
 * `ollama list`). Authoritative and version-stable, unlike the OpenAI-compat
 * `/v1/models`. Returns full tagged names; [] if the server is unreachable.
 */
export async function ollamaTags(baseUrl?: string): Promise<string[]> {
  const tags = await ollamaFetchJson(ollamaRoot(baseUrl), '/api/tags', 3000);
  return ((tags && tags.models) || [])
    .map((m: { name?: string }) => m?.name)
    .filter((n: unknown): n is string => typeof n === 'string');
}

/**
 * Ollama reachability + model readiness via the native API. A model in
 * /api/tags isn't necessarily loaded — /api/ps reports what's running;
 * with model+probe we do a 1-token generate to force-load and confirm.
 */
export async function ollamaStatus(
  baseUrl?: string,
  model?: string,
  probe?: boolean,
): Promise<{
  reachable: boolean;
  installed: string[];
  running: string[];
  modelReady: boolean;
  error?: string;
}> {
  const root = ollamaRoot(baseUrl);

  const tags = await ollamaFetchJson(root, '/api/tags', 3000);
  if (!tags) {
    return { reachable: false, installed: [], running: [], modelReady: false };
  }
  const installed: string[] = (tags.models || []).map((m: { name: string }) => m.name);
  const psData = await ollamaFetchJson(root, '/api/ps', 3000);
  const running: string[] = ((psData && psData.models) || []).map(
    (m: { name: string }) => m.name,
  );

  let modelReady = model ? running.includes(model) : false;
  let probeError: string | undefined;
  if (model && probe && !modelReady) {
    const gen = await ollamaFetchJson(root, '/api/generate', 30000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: 'ok',
        stream: false,
        options: { num_predict: 1 },
      }),
    });
    if (gen && (gen.response !== undefined || gen.done)) modelReady = true;
    else probeError = 'Model failed to load — check it is pulled and the server has resources.';
  }

  return { reachable: true, installed, running, modelReady, error: probeError };
}

/**
 * Evict the given model plus anything /api/ps reports running (a generate
 * call with keep_alive:0 unloads it). Best-effort; never throws.
 */
export async function ollamaUnload(baseUrl?: string, model?: string): Promise<string[]> {
  const root = ollamaRoot(baseUrl);
  const targets = new Set<string>();
  if (model) targets.add(model);
  const ps = await ollamaFetchJson(root, '/api/ps', 3000);
  for (const m of (ps && ps.models) || []) if (m?.name) targets.add(m.name);

  const unloaded: string[] = [];
  for (const mdl of targets) {
    const r = await ollamaFetchJson(root, '/api/generate', 8000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: mdl, keep_alive: 0 }),
    });
    if (r) unloaded.push(mdl);
  }
  return unloaded;
}
