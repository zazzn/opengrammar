import type {
  AnalysisContext,
  AnalyticsEventType,
  AnalyticsSummary,
  AnalyzeResponse,
  AutocompleteRequest,
  AutocompleteResponse,
  EditorContext,
  LLMProvider,
  RewriteResponse,
  Issue,
} from '../types';
import { harperLint, warmHarper } from './harperEngine';
import { getApiKey } from '../shared/apiKeyStore';
import { PROVIDERS } from '../types';
import {
  chatCompletion,
  listModels,
  ollamaKeepAliveParam,
  ollamaStatus,
  ollamaTags,
  ollamaUnload as ollamaUnloadDirect,
  resolveBaseUrl,
} from './llmClient';
import { clearLog, formatCompact, logEvent } from './debugLog';

const DEFAULT_PROVIDER = 'openai';
const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_ANALYTICS: AnalyticsSummary = {
  totals: {
    analysis_runs: 0,
    issues_found: 0,
    suggestions_applied: 0,
    suggestions_ignored: 0,
    autocomplete_shown: 0,
    autocomplete_accepted: 0,
    rewrite_opened: 0,
    rewrite_applied: 0,
  },
  domains: {},
  providers: {},
};

chrome.runtime.onInstalled.addListener(() => {
  void initializeStoredDefaults();
  void warmHarper();
});

// Warm the local engine when the SW spins back up so the first keystroke
// after an idle period doesn't pay the WASM init cost.
chrome.runtime.onStartup.addListener(() => {
  void warmHarper();
});

void initializeStoredDefaults();
void warmHarper();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'CHECK_GRAMMAR') {
    handleGrammarCheck(request.text, request.context, sendResponse);
    return true;
  }

  if (request.type === 'REWRITE_TEXT') {
    handleRewrite(request.text, request.tone, sendResponse);
    return true;
  }

  if (request.type === 'REPHRASE_TEXT') {
    rephraseText(request.sentence, request.goal).then((r) => sendResponse(r));
    return true;
  }

  if (request.type === 'GET_DEBUG_LOG') {
    formatCompact().then((r) => sendResponse(r));
    return true;
  }

  if (request.type === 'CLEAR_DEBUG_LOG') {
    clearLog().then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.type === 'GET_SELECTION') {
    // Get selected text from the current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' }, (response) => {
          sendResponse(response);
        });
      } else {
        sendResponse({ text: '' });
      }
    });
    return true;
  }

  if (request.type === 'SYNC_ACTIVE_CONTEXT') {
    const tabId = sender.tab?.id;
    if (!tabId || typeof request.text !== 'string') {
      sendResponse({ success: false });
      return false;
    }

    void storeActiveContext(tabId, request.text, request.issues || []).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'GET_ACTIVE_TEXT') {
    void getActiveEditorContext().then((context) => {
      sendResponse(context || { text: '', issues: [] });
    });
    return true;
  }

  if (request.type === 'AUTOCOMPLETE_TEXT') {
    void handleAutocomplete(request, sendResponse);
    return true;
  }

  if (request.type === 'TRACK_ANALYTICS_EVENT') {
    void trackAnalyticsEvent(request.eventType, request.payload).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'GET_ANALYTICS_SUMMARY') {
    void getAnalyticsSummary().then((summary) => sendResponse(summary));
    return true;
  }

  if (request.type === 'CLEAR_ANALYTICS') {
    void chrome.storage.sync.set({ analyticsSummary: DEFAULT_ANALYTICS }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'GET_PROVIDERS') {
    sendResponse({ providers: getProviders() });
    return false;
  }

  if (request.type === 'GET_MODELS') {
    getModels(request.provider, request.apiKey, request.baseUrl).then((models) =>
      sendResponse({ models }),
    );
    return true;
  }

  if (request.type === 'CORRECT_TEXT') {
    correctText(request.text).then((r) => sendResponse(r));
    return true;
  }

  if (request.type === 'GET_OLLAMA_STATUS') {
    getOllamaStatus(request.baseUrl, request.model, request.probe).then((s) =>
      sendResponse(s),
    );
    return true;
  }

  if (request.type === 'OLLAMA_UNLOAD') {
    unloadOllama(request.baseUrl, request.model).then(() => sendResponse({ success: true }));
    return true;
  }

  // D1: Badge count update
  if (request.type === 'UPDATE_BADGE_COUNT') {
    void updateBadge(request.count, sender.tab?.id);
    sendResponse({ success: true });
    return false;
  }

  // D4: Writing history
  if (request.type === 'SAVE_WRITING_SESSION') {
    void saveWritingSession(request.payload).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === 'GET_WRITING_HISTORY') {
    void getWritingHistory(request.days || 30).then((history) => {
      sendResponse(history);
    });
    return true;
  }
});


function filterIssues(issues: Issue[] | undefined, ignoredIssues: string[], dictionary: string[]): Issue[] {
  if (!issues || issues.length === 0) return [];
  let filtered = issues;

  const normalizedIgnored = normalizeIgnoredIssues(ignoredIssues);
  if (normalizedIgnored.length > 0) {
    filtered = filtered.filter((issue) => {
      const issueId = issue.id || `${issue.type}-${issue.offset}-${issue.original}`;
      return !normalizedIgnored.includes(issueId);
    });
  }

  if (dictionary && dictionary.length > 0) {
    filtered = filtered.filter((issue) => {
      if (issue.type !== 'spelling') return true;
      const word = issue.original.toLowerCase().trim();
      return !dictionary.includes(word);
    });
  }

  return filtered;
}

async function handleGrammarCheck(
  text: string,
  context: AnalysisContext | undefined,
  sendResponse: (response: any) => void,
) {
  try {
    const { enabled, ignoredIssues, dictionary } = await chrome.storage.sync.get([
      'enabled',
      'ignoredIssues',
      'dictionary',
    ]);

    if (enabled === false) {
      sendResponse({
        issues: [],
        metadata: { textLength: text.length, issuesCount: 0, processingTimeMs: 0 },
      });
      return;
    }

    // Inline tier: Harper local engine. Instant, on-device, mechanical, fully
    // offline — no backend. The grammar/tone button (CORRECT_TEXT) is the only
    // LLM path and is separate. If Harper itself fails to init we return no
    // issues (the legacy rule-engine fallback was removed with the backend).
    try {
      const t0 = Date.now();
      const harperIssues = await harperLint(text);
      const filtered = filterIssues(harperIssues, ignoredIssues || [], dictionary || []);

      await trackAnalyticsEvent('analysis_runs', {
        count: 1,
        domain: context?.domain,
        provider: 'harper',
      });
      if (filtered.length > 0) {
        await trackAnalyticsEvent('issues_found', {
          count: filtered.length,
          domain: context?.domain,
          provider: 'harper',
        });
      }

      void updateBadge(filtered.length, undefined);

      logEvent({
        kind: 'harper',
        meta: `${filtered.length} issue(s) in ${Date.now() - t0}ms`,
        in: text,
        out: filtered
          .slice(0, 12)
          .map((i) => `${i.type}:"${i.original}"→"${i.suggestion}"`)
          .join(' · '),
      });

      sendResponse({
        issues: filtered,
        metadata: {
          textLength: text.length,
          issuesCount: filtered.length,
          processingTimeMs: Date.now() - t0,
          provider: 'harper',
        },
      });
    } catch (harperError) {
      console.warn('[harper] lint failed; returning no issues:', harperError);
      sendResponse({
        issues: [],
        metadata: { textLength: text.length, issuesCount: 0, processingTimeMs: 0 },
      });
    }
  } catch (error) {
    console.error('Grammar check failed:', error);
    sendResponse({
      error: 'Failed to check grammar',
      message: error instanceof Error ? error.message : 'Unknown error',
      issues: [],
    });
  }
}

async function handleAutocomplete(
  request: AutocompleteRequest & { type: string },
  sendResponse: (response: AutocompleteResponse) => void,
) {
  try {
    const apiKey = await getApiKey();
    const { model, provider, customBaseUrl, ollamaUrl, autocompleteEnabled } =
      await chrome.storage.sync.get([
        'model',
        'provider',
        'customBaseUrl',
        'ollamaUrl',
        'autocompleteEnabled',
      ]);

    if (autocompleteEnabled === false) {
      sendResponse({
        suggestion: '',
        confidence: 0,
        replaceStart: request.cursor,
        replaceEnd: request.cursor,
        source: 'heuristic',
      });
      return;
    }

    const text = request.text;
    const cursor = Math.max(0, Math.min(request.cursor ?? text.length, text.length));
    const providerId = (provider || 'openai') as LLMProvider;

    const data: AutocompleteResponse =
      apiKey || providerId === 'ollama'
        ? await getLlmAutocomplete(
            text,
            cursor,
            apiKey,
            model,
            providerId,
            resolveBaseUrl(providerId, customBaseUrl, ollamaUrl),
            request.context,
          )
        : getHeuristicAutocomplete(text, cursor);

    if (data.suggestion) {
      await trackAnalyticsEvent('autocomplete_shown', {
        count: 1,
        domain: request.context?.domain,
        provider: provider || 'heuristic',
      });
    }

    logEvent({
      kind: 'autocomplete',
      provider,
      model,
      meta: data.source,
      in: text.slice(Math.max(0, cursor - 120), cursor),
      out: data.suggestion,
    });

    sendResponse(data);
  } catch (error) {
    sendResponse({
      suggestion: '',
      confidence: 0,
      replaceStart: request.cursor,
      replaceEnd: request.cursor,
      source: 'heuristic',
      error: error instanceof Error ? error.message : 'Autocomplete failed',
    });
  }
}

// Ported verbatim from backend/src/index.ts (getLlmAutocomplete) so the
// next-word suggestion behaviour is unchanged now the call is client-side.
async function getLlmAutocomplete(
  text: string,
  cursor: number,
  apiKey: string,
  model: string | undefined,
  provider: LLMProvider,
  baseURL: string,
  context?: AnalysisContext,
): Promise<AutocompleteResponse> {
  const prefix = text.slice(0, cursor);
  const suffix = text.slice(cursor);

  const content = await chatCompletion({
    apiKey,
    baseURL,
    model: model || 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content:
          'You are a writing assistant. Predict the next short continuation for the user. ' +
          'Use context.pageContext (the title/URL/main text of the page they are viewing) to make ' +
          'the continuation specific and relevant to that page when applicable. ' +
          'Return ONLY JSON with keys suggestion and confidence. Keep suggestion under 12 words and do not repeat the existing text.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          prefix: prefix.slice(-400),
          suffix: suffix.slice(0, 120),
          context,
        }),
      },
    ],
    temperature: 0.5,
    maxTokens: 80,
    responseFormat: { type: 'json_object' },
  });

  const raw = content || '{"suggestion":"","confidence":0.5}';
  const parsed = JSON.parse(raw.replace(/^```json\s*/, '').replace(/\s*```$/, ''));

  return {
    suggestion: typeof parsed.suggestion === 'string' ? parsed.suggestion.trim() : '',
    confidence:
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.72,
    replaceStart: cursor,
    replaceEnd: cursor,
    source: 'llm',
  };
}

// Ported verbatim from backend/src/index.ts (getHeuristicAutocomplete).
function getHeuristicAutocomplete(text: string, cursor: number): AutocompleteResponse {
  const prefix = text.slice(0, cursor);
  const trimmed = prefix.trimEnd();
  const lower = trimmed.toLowerCase();

  const patternSuggestions: Array<{ pattern: RegExp; suggestion: string }> = [
    { pattern: /thank you for$/i, suggestion: ' your time.' },
    { pattern: /i look forward to$/i, suggestion: ' hearing from you.' },
    { pattern: /please let me know if$/i, suggestion: ' you have any questions.' },
    { pattern: /in conclusion[,]?$/i, suggestion: ' this approach provides a stronger outcome.' },
    { pattern: /for example[,]?$/i, suggestion: ' this can improve clarity and consistency.' },
    { pattern: /i hope you are$/i, suggestion: ' doing well.' },
  ];

  for (const entry of patternSuggestions) {
    if (entry.pattern.test(lower)) {
      return {
        suggestion: entry.suggestion,
        confidence: 0.66,
        replaceStart: cursor,
        replaceEnd: cursor,
        source: 'heuristic',
      };
    }
  }

  const endsWithSentence = /[.!?]$/.test(trimmed);
  return {
    suggestion: endsWithSentence ? ' This helps keep the writing clear.' : '',
    confidence: endsWithSentence ? 0.42 : 0,
    replaceStart: cursor,
    replaceEnd: cursor,
    source: 'heuristic',
  };
}

async function handleRewrite(text: string, tone: string, sendResponse: (response: any) => void) {
  try {
    if (!text || !tone) {
      sendResponse({ error: 'Text and tone are required' });
      return;
    }
    const apiKey = await getApiKey();
    const { model, provider, customBaseUrl, ollamaUrl, ollamaKeepAlive } =
      await chrome.storage.sync.get([
        'model',
        'provider',
        'customBaseUrl',
        'ollamaUrl',
        'ollamaKeepAlive',
      ]);

    // Tone instructions ported verbatim from backend/src/index.ts (/rewrite).
    const toneInstructions: Record<string, string> = {
      polish:
        'Lightly polish the wording for clarity and flow. Do NOT change the meaning, facts, or overall tone, and keep the length similar',
      formal: 'Make the text more formal and professional',
      casual: 'Make the text more casual and conversational',
      professional: 'Make the text more professional and business-appropriate',
      friendly: 'Make the text friendlier and warmer',
      concise: 'Make the text more concise and direct',
      detailed: 'Make the text more detailed and elaborate',
      persuasive: 'Make the text more persuasive and compelling',
      neutral: 'Keep the text neutral and objective',
    };

    const rewritten = await chatCompletion({
      apiKey,
      baseURL: resolveBaseUrl(provider, customBaseUrl, ollamaUrl),
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a writing assistant. ${toneInstructions[tone] || 'Improve the writing'}. Return ONLY the rewritten text, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      temperature: 0.7,
      maxTokens: 1000,
      extraBody: ollamaKeepAliveParam(provider, ollamaKeepAlive),
    });

    const data: RewriteResponse = { original: text, rewritten: rewritten || text, tone };
    logEvent({ kind: 'rewrite', provider, model, meta: tone, in: text, out: data.rewritten });
    sendResponse(data);
  } catch (error) {
    console.error('Rewrite failed:', error);
    sendResponse({
      error: 'Failed to rewrite text',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Multi-suggestion rephrase (the floating bubble's "alternatives" panel).
// SYSTEM_PROMPT / goal descriptions ported verbatim from the former backend
// Rephraser (backend/src/rephraser.ts). Returns the same shape the bubble
// rendering expects: { suggestions:[{text,label}], explanation, bestMatch }.
const REPHRASE_GOALS: Record<string, string> = {
  clarity: 'clearer and easier to understand',
  formal: 'more formal and professional',
  concise: 'shorter and more concise (remove filler words)',
  friendly: 'warmer, friendlier, and more approachable',
};
const REPHRASE_SYSTEM_PROMPT = `You are an expert writing assistant. Rewrite the given sentence in exactly 3 different ways.

Rules:
1. Keep the core meaning intact
2. Apply the requested goal (clarity/formal/concise/friendly)
3. Each rewrite must be meaningfully different from the others
4. Keep the same approximate length unless goal is "concise"
5. Return ONLY a JSON object — no preamble, no markdown

Format:
{
  "suggestions": [
    { "text": "First rewrite", "label": "Option 1" },
    { "text": "Second rewrite", "label": "Option 2" },
    { "text": "Third rewrite", "label": "Option 3" }
  ],
  "explanation": "One sentence explaining what was improved",
  "bestMatch": 0
}`;

async function rephraseText(
  sentence: string,
  goal: string,
): Promise<{
  suggestions: { text: string; label: string }[];
  explanation: string;
  bestMatch: number;
}> {
  try {
    if (!sentence) return { suggestions: [], explanation: '', bestMatch: 0 };
    const apiKey = await getApiKey();
    const { model, provider, customBaseUrl, ollamaUrl, ollamaKeepAlive } =
      await chrome.storage.sync.get([
        'model',
        'provider',
        'customBaseUrl',
        'ollamaUrl',
        'ollamaKeepAlive',
      ]);
    if (!apiKey && provider !== 'ollama') {
      return {
        suggestions: [],
        explanation: 'Rephrase failed. Please check your API key and try again.',
        bestMatch: 0,
      };
    }
    const adjective = REPHRASE_GOALS[goal] || REPHRASE_GOALS.clarity;
    const raw = await chatCompletion({
      apiKey,
      baseURL: resolveBaseUrl(provider, customBaseUrl, ollamaUrl),
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: REPHRASE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Rewrite this sentence in 3 ways that are ${adjective}:\n\n"${sentence}"`,
        },
      ],
      temperature: 0.7,
      maxTokens: 512,
      responseFormat: { type: 'json_object' },
      extraBody: ollamaKeepAliveParam(provider, ollamaKeepAlive),
    });
    const cleaned = (raw || '{}').replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(cleaned);
    const result = {
      suggestions: (parsed.suggestions || []).map((s: { text?: string; label?: string }) => ({
        text: s.text || String(s),
        label: s.label || 'Option',
      })),
      explanation: parsed.explanation || '',
      bestMatch: typeof parsed.bestMatch === 'number' ? parsed.bestMatch : 0,
    };
    logEvent({
      kind: 'rephrase',
      provider,
      model,
      meta: goal,
      in: sentence,
      out: result.suggestions.map((s: { text: string }) => s.text).join(' | '),
    });
    return result;
  } catch (error) {
    console.error('Rephrase error:', error);
    return {
      suggestions: [],
      explanation: 'Rephrase failed. Please check your API key and try again.',
      bestMatch: 0,
    };
  }
}

function getProviders() {
  return PROVIDERS;
}

// Live model list. Ollama: the native /api/tags (what `ollama list` uses)
// — the real installed models, not the curated names. Other providers:
// their OpenAI-compatible /v1/models when a key is set. The static
// PROVIDERS list is only a fallback for an unreachable server / no key.
async function getModels(provider: string, apiKey?: string, baseUrl?: string) {
  const staticModels = PROVIDERS.find((p) => p.id === provider)?.models || [];
  if (provider === 'ollama') {
    const live = await ollamaTags(baseUrl);
    return live.length > 0 ? live : staticModels;
  }
  if (apiKey && apiKey !== 'ollama') {
    const live = await listModels(provider, apiKey, baseUrl);
    if (live.length > 0) return live;
  }
  return staticModels;
}

// Whole-text correctness pass. Prompt/params ported verbatim from the former
// backend /correct so output is identical. No key (and not Ollama) → signal
// the content script to use its safe local fallback (llm:false); any error
// returns the original unchanged so a card never garbles.
async function correctText(
  text: string,
): Promise<{ original: string; corrected: string; llm: boolean }> {
  try {
    const apiKey = await getApiKey();
    const { model, provider, customBaseUrl, ollamaUrl, ollamaKeepAlive } =
      await chrome.storage.sync.get([
        'model',
        'provider',
        'customBaseUrl',
        'ollamaUrl',
        'ollamaKeepAlive',
      ]);

    if (!apiKey && provider !== 'ollama') {
      return { original: text, corrected: text, llm: false };
    }

    const corrected = await chatCompletion({
      apiKey,
      baseURL: resolveBaseUrl(provider, customBaseUrl, ollamaUrl),
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a meticulous proofreader. Correct ONLY spelling, ' +
            'grammar, punctuation, and capitalization errors. Do NOT rephrase, ' +
            'reword, change tone/style, or add or remove information. Preserve ' +
            'the original wording wherever it is already correct. Keep line ' +
            'breaks. Leave URLs, email addresses, file paths, code, @mentions, ' +
            'and #hashtags EXACTLY as written — never alter or "fix" them. ' +
            'If a sentence is already correct, return it unchanged. ' +
            'Return ONLY the corrected text, with no preamble, quotes, or notes.',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
      maxTokens: Math.min(4000, Math.ceil(text.length / 2) + 600),
      extraBody: ollamaKeepAliveParam(provider, ollamaKeepAlive),
    });
    const out = corrected.trim() || text;
    logEvent({
      kind: 'correct',
      provider,
      model,
      meta: out === text ? 'no-change' : 'changed',
      in: text,
      out,
    });
    return { original: text, corrected: out, llm: true };
  } catch (error) {
    console.error('Correct error:', error);
    return { original: text, corrected: text, llm: false };
  }
}

async function getOllamaStatus(baseUrl?: string, model?: string, probe?: boolean) {
  return ollamaStatus(baseUrl, model, probe);
}

/**
 * Explicitly unload the Ollama model so memory/VRAM returns to the system.
 * Fired when the user switches away from Ollama or disables the extension
 * (the idle keep_alive handles the in-use case). Best-effort; silent on
 * failure (Ollama may simply not be reachable).
 */
async function unloadOllama(ollamaUrl?: string, model?: string): Promise<void> {
  try {
    await ollamaUnloadDirect(ollamaUrl, model);
  } catch {
    /* Ollama not reachable — nothing to reclaim. */
  }
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;

  // Provider switched away from Ollama → free the local model's memory.
  if (
    changes.provider &&
    changes.provider.oldValue === 'ollama' &&
    changes.provider.newValue !== 'ollama'
  ) {
    chrome.storage.sync.get(['ollamaUrl', 'model'], (r) => {
      void unloadOllama(r.ollamaUrl, r.model);
    });
  }

  // Extension disabled while Ollama is the active provider → free memory.
  if (changes.enabled && changes.enabled.newValue === false) {
    chrome.storage.sync.get(['provider', 'ollamaUrl', 'model'], (r) => {
      if (r.provider === 'ollama') void unloadOllama(r.ollamaUrl, r.model);
    });
  }
});

async function initializeStoredDefaults(): Promise<void> {
  const existing = await chrome.storage.sync.get(['enabled', 'provider', 'model']);

  await chrome.storage.sync.set({
    enabled: existing.enabled !== false,
    provider: existing.provider || DEFAULT_PROVIDER,
    model: existing.model || DEFAULT_MODEL,
  });
}

function normalizeIgnoredIssues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }

      if (entry && typeof entry === 'object' && 'id' in entry && typeof entry.id === 'string') {
        return entry.id;
      }

      return null;
    })
    .filter((entry): entry is string => Boolean(entry));
}

async function storeActiveContext(
  sourceTabId: number,
  text: string,
  issues: AnalyzeResponse['issues'] = [],
): Promise<void> {
  const payload: EditorContext = {
    text,
    issues,
    sourceTabId,
    capturedAt: Date.now(),
  };

  await chrome.storage.local.set({ lastEditorContext: payload });
}

async function getActiveEditorContext(): Promise<EditorContext | null> {
  const result = await chrome.storage.local.get('lastEditorContext');
  return (result.lastEditorContext as EditorContext | undefined) || null;
}

async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const result = await chrome.storage.sync.get('analyticsSummary');
  return {
    ...DEFAULT_ANALYTICS,
    ...(result.analyticsSummary as AnalyticsSummary | undefined),
    totals: {
      ...DEFAULT_ANALYTICS.totals,
      ...((result.analyticsSummary as AnalyticsSummary | undefined)?.totals || {}),
    },
    domains: {
      ...((result.analyticsSummary as AnalyticsSummary | undefined)?.domains || {}),
    },
    providers: {
      ...((result.analyticsSummary as AnalyticsSummary | undefined)?.providers || {}),
    },
  };
}

async function trackAnalyticsEvent(
  eventType: AnalyticsEventType,
  payload?: { count?: number; domain?: string; provider?: string },
): Promise<void> {
  const summary = await getAnalyticsSummary();
  const count = payload?.count || 1;
  summary.totals[eventType] = (summary.totals[eventType] || 0) + count;

  if (payload?.domain) {
    summary.domains[payload.domain] = (summary.domains[payload.domain] || 0) + count;
  }

  if (payload?.provider) {
    summary.providers[payload.provider] = (summary.providers[payload.provider] || 0) + count;
  }

  summary.lastUpdatedAt = Date.now();
  await chrome.storage.sync.set({ analyticsSummary: summary });
}

function getDomainFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

// ─── D1: Badge ───────────────────────────────────────────────────────────────

async function updateBadge(issueCount: number, tabId?: number): Promise<void> {
  try {
    if (issueCount > 0) {
      const text = issueCount > 99 ? '99+' : String(issueCount);
      const color = issueCount > 5 ? '#DC2626' : issueCount > 0 ? '#F59E0B' : '#16A34A';
      await chrome.action.setBadgeText({ text, tabId });
      await chrome.action.setBadgeBackgroundColor({ color, tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (error) {
    // Badge API may not be available in all contexts
    console.debug('Badge update failed:', error);
  }
}

// ─── D4: Writing History ─────────────────────────────────────────────────────

interface WritingSessionEntry {
  date: string; // YYYY-MM-DD
  wordsChecked: number;
  issuesFound: number;
  issuesFixed: number;
  writingScore: number;
  sessionsCount: number;
  topErrors: Record<string, number>;
}

async function saveWritingSession(payload: {
  wordsChecked: number;
  issuesFound: number;
  issuesFixed: number;
  writingScore: number;
  errorTypes?: Record<string, number>;
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const result = await chrome.storage.local.get('writingHistory');
  const history: Record<string, WritingSessionEntry> = result.writingHistory || {};

  const existing = history[today] || {
    date: today,
    wordsChecked: 0,
    issuesFound: 0,
    issuesFixed: 0,
    writingScore: 0,
    sessionsCount: 0,
    topErrors: {},
  };

  existing.wordsChecked += payload.wordsChecked;
  existing.issuesFound += payload.issuesFound;
  existing.issuesFixed += payload.issuesFixed;
  existing.sessionsCount += 1;

  // Rolling average of writing score
  existing.writingScore = Math.round(
    (existing.writingScore * (existing.sessionsCount - 1) + payload.writingScore) /
      existing.sessionsCount,
  );

  // Aggregate error types
  if (payload.errorTypes) {
    for (const [type, count] of Object.entries(payload.errorTypes)) {
      existing.topErrors[type] = (existing.topErrors[type] || 0) + count;
    }
  }

  history[today] = existing;

  // Keep only last 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const key of Object.keys(history)) {
    if (key < cutoffStr) delete history[key];
  }

  await chrome.storage.local.set({ writingHistory: history });
}

async function getWritingHistory(days: number = 30): Promise<WritingSessionEntry[]> {
  const result = await chrome.storage.local.get('writingHistory');
  const history: Record<string, WritingSessionEntry> = result.writingHistory || {};

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return Object.values(history)
    .filter((entry) => entry.date >= cutoffStr)
    .sort((a, b) => a.date.localeCompare(b.date));
}
