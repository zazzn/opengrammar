import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import OpenAI from 'openai';
import { LLMAnalyzer, RuleBasedAnalyzer } from './analyzer.js';
import { analyzeTone } from './nlp/tone-analyzer.js';
import { Rephraser, type RephraseGoal } from './rephraser.js';
import { detectWritingContext } from './rules/context-filter.js';
import type {
  AnalysisContext,
  AnalyzeRequest,
  AnalyzeResponse,
  AutocompleteRequest,
  Issue,
  LLMProvider,
} from './shared-types.js';
import { PROVIDERS } from './shared-types.js';

const app = new Hono();

// Middleware
app.use('/*', logger());
app.use('/*', cors());

// Root Landing Page
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenGrammar API</title>
  <meta name="description" content="OpenGrammar — open-source, privacy-first grammar intelligence engine running on the Edge.">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #09090b;
      --surface: rgba(24, 24, 27, 0.8);
      --border: rgba(255,255,255,0.07);
      --border-hover: rgba(255,255,255,0.14);
      --text: #fafafa;
      --muted: #71717a;
      --green: #22c55e;
      --green-bg: rgba(34,197,94,0.08);
      --green-border: rgba(34,197,94,0.2);
      --amber: #f59e0b;
      --amber-bg: rgba(245,158,11,0.08);
      --amber-border: rgba(245,158,11,0.2);
      --red: #ef4444;
      --red-bg: rgba(239,68,68,0.08);
      --red-border: rgba(239,68,68,0.2);
      --blue: #3b82f6;
    }

    html, body {
      height: 100%;
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      overflow-x: hidden;
    }

    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
    }

    /* Ambient background orbs */
    .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(120px);
      pointer-events: none;
      z-index: 0;
    }
    .orb-1 {
      width: 500px; height: 500px;
      background: radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%);
      top: -150px; left: -100px;
    }
    .orb-2 {
      width: 450px; height: 450px;
      background: radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%);
      bottom: -120px; right: -80px;
    }

    .page {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 680px;
    }

    /* Card */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 48px 40px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 0 0 1px rgba(255,255,255,0.03), 0 32px 64px rgba(0,0,0,0.5);
    }

    /* Hero */
    .hero { text-align: center; margin-bottom: 36px; }

    .logo-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px; height: 56px;
      border-radius: 16px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      margin-bottom: 20px;
      box-shadow: 0 8px 24px rgba(59,130,246,0.35);
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #e2e8f0 30%, #94a3b8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 12px;
    }

    .hero p {
      color: var(--muted);
      font-size: 1rem;
      max-width: 440px;
      margin: 0 auto 24px;
    }

    /* Status pill */
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      background: var(--green-bg);
      border: 1px solid var(--green-border);
      color: var(--green);
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 0.82rem;
      font-weight: 600;
    }
    .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--green);
      box-shadow: 0 0 8px var(--green);
      animation: pulse 2.5s ease-in-out infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.8); }
    }

    /* Endpoints */
    .endpoints {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
      margin: 24px 0;
    }
    .ep-tag {
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 0.8rem;
      color: #94a3b8;
      background: rgba(0,0,0,0.35);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 7px 14px;
      letter-spacing: 0.02em;
    }
    .ep-tag span {
      color: #60a5fa;
      margin-right: 6px;
      font-weight: 600;
    }

    /* Buttons */
    .btn-row {
      display: flex;
      gap: 10px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 36px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      border: 1px solid var(--border);
      color: var(--text);
      background: rgba(255,255,255,0.04);
      transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    }
    .btn:hover {
      background: rgba(255,255,255,0.08);
      border-color: var(--border-hover);
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.3);
    }
    .btn.primary {
      background: rgba(59,130,246,0.15);
      border-color: rgba(59,130,246,0.35);
      color: #93c5fd;
    }
    .btn.primary:hover {
      background: rgba(59,130,246,0.25);
      border-color: rgba(59,130,246,0.55);
    }

    /* Divider */
    .divider {
      height: 1px;
      background: var(--border);
      margin: 0 0 28px;
    }

    /* Section heading */
    .section-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .section-title {
      font-size: 0.82rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .refresh-hint {
      font-size: 0.75rem;
      color: var(--muted);
      opacity: 0.6;
    }

    /* Server grid */
    .server-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    @media (max-width: 560px) {
      .server-grid { grid-template-columns: 1fr; }
      .card { padding: 32px 24px; }
      h1 { font-size: 2rem; }
    }

    .server-card {
      background: rgba(0,0,0,0.25);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 14px 16px;
      transition: border-color 0.15s, transform 0.15s;
    }
    .server-card:hover {
      border-color: var(--border-hover);
      transform: translateY(-1px);
    }
    .sc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .sc-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--text);
    }
    .sc-meta {
      font-size: 0.76rem;
      color: var(--muted);
    }

    /* Status badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 600;
      border: 1px solid transparent;
    }
    .badge-dot { width: 5px; height: 5px; border-radius: 50%; }

    .badge.active  { background: var(--green-bg); color: var(--green); border-color: var(--green-border); }
    .badge-dot.active { background: var(--green); box-shadow: 0 0 6px var(--green); animation: pulse 2.5s infinite; }

    .badge.standby { background: var(--amber-bg); color: var(--amber); border-color: var(--amber-border); }
    .badge-dot.standby { background: var(--amber); }

    .badge.offline  { background: var(--red-bg); color: var(--red); border-color: var(--red-border); }
    .badge-dot.offline { background: var(--red); }

    .badge.checking { background: rgba(100,116,139,0.1); color: #64748b; border-color: rgba(100,116,139,0.2); }
    .badge-dot.checking { background: #64748b; animation: pulse 1s infinite; }

    /* Footer */
    .footer {
      text-align: center;
      margin-top: 20px;
      font-size: 0.78rem;
      color: var(--muted);
      opacity: 0.5;
    }

    @keyframes float {
      0% { transform: translate(0,0); }
      100% { transform: translate(30px, 20px); }
    }
  </style>
</head>
<body>
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <div class="page">
    <div class="card">

      <!-- Hero -->
      <div class="hero">
        <div class="logo-ring">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <h1>OpenGrammar</h1>
        <p>Privacy-first, open-source grammar intelligence engine — running live on the global Edge network.</p>
        <div class="status-pill">
          <div class="dot"></div>
          API Operational
        </div>
      </div>

      <!-- Endpoints -->
      <div class="endpoints">
        <div class="ep-tag"><span>POST</span>/analyze</div>
        <div class="ep-tag"><span>POST</span>/autocomplete</div>
        <div class="ep-tag"><span>GET</span>/health</div>
        <div class="ep-tag"><span>GET</span>/providers</div>
      </div>

      <!-- Buttons -->
      <div class="btn-row">
        <a href="https://opengrammer.eu.cc/" target="_blank" class="btn primary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          Official Website
        </a>
        <a href="https://github.com/swadhinbiswas/opengrammar" target="_blank" class="btn">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          GitHub
        </a>
        <a href="/health" class="btn">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Health
        </a>
      </div>

      <!-- Divider -->
      <div class="divider"></div>

      <!-- Network Status -->
      <div class="section-head">
        <span class="section-title">Global Network</span>
        <span class="refresh-hint" id="last-updated">Checking…</span>
      </div>

      <div class="server-grid" id="server-grid">
        <div class="server-card">
          <div class="sc-header">
            <span class="sc-name">Cloudflare Edge</span>
            <span class="badge checking"><span class="badge-dot checking"></span>Checking</span>
          </div>
          <div class="sc-meta">Global CDN</div>
        </div>
        <div class="server-card">
          <div class="sc-header">
            <span class="sc-name">Vercel</span>
            <span class="badge checking"><span class="badge-dot checking"></span>Checking</span>
          </div>
          <div class="sc-meta">US East</div>
        </div>
        <div class="server-card">
          <div class="sc-header">
            <span class="sc-name">Render</span>
            <span class="badge checking"><span class="badge-dot checking"></span>Checking</span>
          </div>
          <div class="sc-meta">Frankfurt</div>
        </div>
      </div>

    </div>
    <div class="footer">OpenGrammar v2.0 · Cloudflare Workers · MIT License</div>
  </div>

  <script>
    const SERVERS = [
      { id: 'cf',     name: 'Cloudflare Edge', url: '/health',                                                              role: 'primary',  loc: 'Global CDN' },
      { id: 'vercel', name: 'Vercel',           url: 'https://opengrammar-backend-psi.vercel.app/health',            role: 'standby',  loc: 'US East'    },
      { id: 'render', name: 'Netlify',           url: 'https://clinquant-sherbet-151cc5.netlify.app/health',              role: 'standby',  loc: 'US East'    }
    ];

    function badgeHTML(state, label) {
      return '<span class="badge ' + state + '"><span class="badge-dot ' + state + '"></span>' + label + '</span>';
    }

    function cardHTML(s, state, ping) {
      const label = state === 'active'   ? (s.role === 'primary' ? 'Primary' : 'Active')
                  : state === 'standby'  ? 'Standby'
                  : state === 'offline'  ? 'Offline'
                  : 'Checking';
      const metaColor = state === 'offline' ? 'color:var(--red)' : 'color:var(--muted)';
      const pingStr   = (state === 'active' && ping != null) ? ' · ' + ping + 'ms' : (state === 'offline' ? ' · Unreachable' : '');
      return '<div class="server-card"><div class="sc-header"><span class="sc-name">' + s.name + '</span>' + badgeHTML(state, label) + '</div><div class="sc-meta" style="' + metaColor + '">' + s.loc + pingStr + '</div></div>';
    }

    async function ping(server) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        const t0 = performance.now();
        const res = await fetch(server.url, { signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        const ms = Math.round(performance.now() - t0);
        if (res.ok) return { state: 'active', ping: ms };
        return { state: 'offline', ping: null };
      } catch { return { state: 'offline', ping: null }; }
    }

    async function refresh() {
      const results = await Promise.all(SERVERS.map(s => ping(s)));
      const grid = document.getElementById('server-grid');
      if (grid) grid.innerHTML = SERVERS.map((s, i) => cardHTML(s, results[i].state, results[i].ping)).join('');
      const el = document.getElementById('last-updated');
      if (el) {
        const now = new Date();
        el.textContent = 'Updated ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    }

    refresh();
    setInterval(refresh, 15000);
  </script>
</body>
</html>`);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: (c.env as any)?.ENV || 'unknown',
    version: '2.0.0',
  });
});

// List available providers
app.get('/providers', (c) => {
  return c.json({
    providers: PROVIDERS,
  });
});

// Get models for a specific provider
app.post('/models', async (c) => {
  try {
    const { provider, apiKey, baseUrl } = await c.req.json();

    if (!provider) {
      return c.json({ error: 'Provider is required' }, 400);
    }

    // Get default models from config
    const providerConfig = PROVIDERS.find((p) => p.id === provider);
    const defaultModels = providerConfig?.models || [];

    // Try to fetch live models, but don't fail if it doesn't work
    let models = defaultModels;

    // Only try to fetch live models if API key is provided (except for Ollama)
    if ((apiKey && apiKey !== 'ollama') || provider === 'ollama') {
      try {
        const liveModels = await LLMAnalyzer.getModels(provider, apiKey, baseUrl);
        if (liveModels.length > 0) {
          models = liveModels;
        }
      } catch (fetchError) {
        // Silently use default models if fetch fails
        console.debug(`Using default models for ${provider}`);
      }
    }

    return c.json({
      provider,
      models: models,
    });
  } catch (error) {
    console.error('Failed to fetch models:', error);
    // Return default models for the provider
    const { provider } = await c.req.json().catch(() => ({}));
    const providerConfig = PROVIDERS.find((p) => p.id === provider);
    return c.json({
      provider,
      models: providerConfig?.models || [],
    });
  }
});

// Ollama reachability + model readiness. A model existing in /api/tags does
// NOT mean it's loaded — Ollama loads on first use. /api/ps reports what's
// actually running. With ?model and probe=true we do a 1-token generate to
// force-load and confirm the model truly works.
app.post('/ollama-status', async (c) => {
  let body: { baseUrl?: string; model?: string; probe?: boolean } = {};
  try {
    body = await c.req.json();
  } catch {
    /* empty body ok */
  }
  // Native Ollama API lives at the server root, not under /v1.
  const root = (body.baseUrl || 'http://localhost:11434')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/v1$/, '');

  const fetchJson = async (path: string, ms: number, init?: RequestInit) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(`${root}${path}`, { ...init, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  const tags = await fetchJson('/api/tags', 3000);
  if (!tags) {
    return c.json({ reachable: false, installed: [], running: [], modelReady: false });
  }
  const installed: string[] = (tags.models || []).map((m: any) => m.name);
  const psData = await fetchJson('/api/ps', 3000);
  const running: string[] = ((psData && psData.models) || []).map((m: any) => m.name);

  let modelReady = body.model ? running.includes(body.model) : false;
  let probeError: string | undefined;
  if (body.model && body.probe && !modelReady) {
    // Force-load with a tiny generation (model load can take a while).
    const gen = await fetchJson('/api/generate', 30000, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: body.model,
        prompt: 'ok',
        stream: false,
        options: { num_predict: 1 },
      }),
    });
    if (gen && (gen.response !== undefined || gen.done)) modelReady = true;
    else probeError = 'Model failed to load — check it is pulled and the server has resources.';
  }

  return c.json({ reachable: true, installed, running, modelReady, error: probeError });
});

// Main analysis endpoint
app.post('/analyze', async (c) => {
  const startTime = Date.now();

  try {
    const body: AnalyzeRequest = await c.req.json();
    const { text, apiKey, model, provider, baseUrl, context, disabledModules } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'Invalid request: text is required' }, 400);
    }

    if (text.length > 50000) {
      return c.json({ error: 'Text exceeds maximum length of 50,000 characters' }, 413);
    }

    // Detect writing context for smart rule filtering
    const writingContext = detectWritingContext(context?.domain);

    // Run rule-based analysis with context-aware filtering
    const ruleIssues = RuleBasedAnalyzer.analyze(text, { writingContext, disabledModules });
    let issues = enrichIssues(ruleIssues, 'rule', text, context);

    // Run LLM analysis if API key provided or using local Ollama
    if (apiKey || provider === 'ollama') {
      try {
        const llmProvider = (provider || 'openai') as LLMProvider;
        const llmIssues = await LLMAnalyzer.analyze(
          text,
          apiKey || '',
          model || 'gpt-4o-mini',
          llmProvider,
          baseUrl,
          context,
          ruleIssues,
        );
        issues = [...issues, ...enrichIssues(llmIssues, 'llm', text, context)];
      } catch (llmError) {
        console.error('LLM analysis failed:', llmError);
        // Continue with rule-based results only
      }
    }

    issues = dedupeAndRankIssues(issues, text, context);

    const duration = Date.now() - startTime;

    const response: AnalyzeResponse = {
      issues,
      metadata: {
        textLength: text.length,
        issuesCount: issues.length,
        processingTimeMs: duration,
        ...(context && { contextUsed: true }),
        ...(model && { model }),
        ...(provider && { provider }),
      },
    };

    return c.json(response);
  } catch (error) {
    console.error('Analysis error:', error);
    return c.json(
      {
        error: 'Failed to analyze text',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// ─── POST /tone — rule-based tone analysis ───────────────────────────────────
app.post('/tone', async (c) => {
  try {
    const body = await c.req.json();
    const { text, context } = body as { text: string; context?: { domain?: string } };
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'text is required' }, 400);
    }
    const writingContext = context?.domain
      ? detectWritingContext(context.domain)
      : undefined;
    const result = analyzeTone(text, writingContext);
    return c.json({
      dominant: result.dominant,
      score: result.score,
      signals: result.signals,
      tips: result.tips,
    });
  } catch (err) {
    console.error('Tone analysis error:', err);
    return c.json({ error: 'Failed to analyze tone' }, 500);
  }
});

// ─── POST /rephrase — AI-powered sentence alternatives ────────────────────────
app.post('/rephrase', async (c) => {
  try {
    const body = await c.req.json() as {
      sentence: string;
      goal?: RephraseGoal;
      apiKey: string;
      provider?: string;
      model?: string;
      baseUrl?: string;
    };
    const { sentence, goal = 'clarity', apiKey, provider = 'groq', model, baseUrl } = body;

    if (!sentence || typeof sentence !== 'string') {
      return c.json({ error: 'sentence is required' }, 400);
    }
    if (!apiKey) {
      return c.json({ error: 'apiKey is required for rephrase' }, 400);
    }

    const result = await Rephraser.rephrase(
      sentence,
      goal,
      apiKey,
      provider as any,
      model,
      baseUrl,
    );
    return c.json(result);
  } catch (err) {
    console.error('Rephrase error:', err);
    return c.json({ error: 'Failed to rephrase sentence' }, 500);
  }
});

// Whole-text correctness rewrite. The LLM sees full context and returns one
// coherent corrected version (errors only — no rephrasing/meaning change).
// This is the source of truth for the sentence-review panel, replacing the
// fragile offset-merge of heterogeneous rule/LLM fragment edits.
app.post('/correct', async (c) => {
  try {
    const { text, apiKey, model, provider, baseUrl } = (await c.req.json()) as {
      text: string;
      apiKey?: string;
      model?: string;
      provider?: string;
      baseUrl?: string;
    };
    if (!text || typeof text !== 'string') {
      return c.json({ error: 'text is required' }, 400);
    }
    // No LLM available → signal the extension to use its safe rule fallback.
    if (!apiKey && provider !== 'ollama') {
      return c.json({ original: text, corrected: text, llm: false });
    }

    const providerBaseUrl = baseUrl || getProviderBaseUrl(provider || 'openai');
    const openai = new (await import('openai')).OpenAI({
      apiKey: apiKey || 'ollama',
      baseURL: providerBaseUrl,
    });

    const completion = await openai.chat.completions.create({
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
      model: model || 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: Math.min(4000, Math.ceil(text.length / 2) + 600),
    });

    const corrected = completion.choices[0]?.message?.content?.trim() || text;
    return c.json({ original: text, corrected, llm: true });
  } catch (error) {
    console.error('Correct error:', error);
    // Fail safe: return the original so the extension falls back, never garbles.
    let original = '';
    try {
      original = ((await c.req.json()) as { text?: string }).text || '';
    } catch {
      /* noop */
    }
    return c.json({ original, corrected: original, llm: false });
  }
});

// Autocomplete / next-word suggestions
app.post('/autocomplete', async (c) => {
  try {
    const body: AutocompleteRequest = await c.req.json();
    const { text, cursor, apiKey, model, provider, baseUrl, context } = body;

    if (typeof text !== 'string') {
      return c.json({ error: 'Text is required' }, 400);
    }

    const safeCursor = Math.max(0, Math.min(cursor ?? text.length, text.length));
    const providerId = (provider || 'openai') as LLMProvider;

    if (apiKey || providerId === 'ollama') {
      const completion = await getLlmAutocomplete(
        text,
        safeCursor,
        apiKey || '',
        model,
        providerId,
        baseUrl,
        context,
      );
      return c.json(completion);
    }

    return c.json(getHeuristicAutocomplete(text, safeCursor));
  } catch (error) {
    console.error('Autocomplete error:', error);
    return c.json(
      {
        suggestion: '',
        confidence: 0,
        replaceStart: 0,
        replaceEnd: 0,
        source: 'heuristic',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// Tone rewriting endpoint
app.post('/rewrite', async (c) => {
  try {
    const { text, tone, apiKey, model, provider, baseUrl } = await c.req.json();

    if (!text || !tone) {
      return c.json({ error: 'Text and tone are required' }, 400);
    }

    const providerBaseUrl = baseUrl || getProviderBaseUrl(provider || 'openai');

    const openai = new (await import('openai')).OpenAI({
      apiKey: apiKey || 'ollama',
      baseURL: providerBaseUrl,
    });

    const toneInstructions: Record<string, string> = {
      formal: 'Make the text more formal and professional',
      casual: 'Make the text more casual and conversational',
      professional: 'Make the text more professional and business-appropriate',
      friendly: 'Make the text friendlier and warmer',
      concise: 'Make the text more concise and direct',
      detailed: 'Make the text more detailed and elaborate',
      persuasive: 'Make the text more persuasive and compelling',
      neutral: 'Keep the text neutral and objective',
    };

    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a writing assistant. ${toneInstructions[tone] || 'Improve the writing'}. Return ONLY the rewritten text, no explanations.`,
        },
        { role: 'user', content: text },
      ],
      model: model || 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 1000,
    });

    const rewrittenText = completion.choices[0]?.message?.content || text;

    return c.json({
      original: text,
      rewritten: rewrittenText,
      tone,
    });
  } catch (error) {
    console.error('Rewrite error:', error);
    return c.json(
      {
        error: 'Failed to rewrite text',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500,
    );
  }
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json(
    {
      error: 'Internal server error',
      message: err.message,
    },
    500,
  );
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

function getProviderBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    ollama: 'http://localhost:11434/v1',
    custom: '',
  };
  return urls[provider as string] ?? urls.openai;
}

function enrichIssues(
  issues: Issue[],
  source: Issue['source'],
  text: string,
  context?: AnalysisContext,
): Issue[] {
  return issues.map((issue) => {
    const confidence = getConfidence(issue, source, context);
    const priority = getPriority(issue, confidence, text, context);
    return {
      ...issue,
      source,
      confidence,
      priority,
      id: issue.id || `${source}-${issue.type}-${issue.offset}-${issue.original}`,
    };
  });
}

/**
 * Drop issues that would corrupt or confuse:
 *  - `original` not actually present in the analyzed text (the LLM
 *    sometimes hallucinates a span — applying it garbles the sentence),
 *  - long grammar/clarity "rewrites" that discard most of the original
 *    words (they change meaning, not fix an error). Small targeted fixes
 *    keep high word-overlap and pass.
 */
// URLs, emails, @handles, #hashtags, file paths, code-ish tokens — not prose.
const NON_PROSE =
  /(https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.\w|\b[\w-]+\.(?:com|org|net|io|dev|co|gov|edu|us|uk|ca)\b|[\\/][\w.-]+[\\/]|\b[a-z]:\\|<\/?\w+>|`[^`]+`|\$\{)/i;

function sanitizeIssues(issues: Issue[], text: string): Issue[] {
  const normText = text.toLowerCase().replace(/\s+/g, ' ');
  const words = (s: string) =>
    s.toLowerCase().match(/[a-z0-9']+/g) || [];
  return issues.filter((i) => {
    const orig = (i.original || '').trim();
    if (orig) {
      const normOrig = orig.toLowerCase().replace(/\s+/g, ' ');
      if (!normText.includes(normOrig)) return false; // hallucinated span
    }
    // Grammar/clarity must only touch real prose — never "fix" inside a URL,
    // email, path, handle, or code token (and not the surrounding fragment).
    if (i.type === 'grammar' || i.type === 'clarity' || i.type === 'style') {
      if (NON_PROSE.test(orig) || NON_PROSE.test(i.suggestion || '')) return false;
    }
    if ((i.type === 'grammar' || i.type === 'clarity') && orig.length > 25) {
      const ow = words(orig);
      const sw = new Set(words(i.suggestion || ''));
      if (ow.length >= 5) {
        const kept = ow.filter((w) => sw.has(w)).length / ow.length;
        if (kept < 0.4) return false; // rewrite loses the original meaning
      }
    }
    return true;
  });
}

function dedupeAndRankIssues(issues: Issue[], text: string, context?: AnalysisContext): Issue[] {
  issues = sanitizeIssues(issues, text);
  const deduped = new Map<string, Issue>();

  for (const issue of issues) {
    const key = `${issue.type}|${issue.offset}|${issue.original.toLowerCase()}|${issue.suggestion.toLowerCase()}`;
    const existing = deduped.get(key);
    if (!existing || (issue.priority || 0) > (existing.priority || 0)) {
      deduped.set(key, issue);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const priorityDiff = (b.priority || 0) - (a.priority || 0);
    if (priorityDiff !== 0) return priorityDiff;
    const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
    if (confidenceDiff !== 0) return confidenceDiff;
    return a.offset - b.offset;
  });
}

function getConfidence(issue: Issue, source: Issue['source'], context?: AnalysisContext): number {
  const baseByType: Record<Issue['type'], number> = {
    spelling: 0.96,
    grammar: 0.9,
    clarity: 0.82,
    style: 0.78,
  };

  let confidence = baseByType[issue.type];

  if (source === 'llm') confidence -= 0.04;
  if (/consider/i.test(issue.suggestion) || /consider/i.test(issue.reason)) confidence -= 0.08;
  if (issue.original.length <= 2) confidence -= 0.05;
  if (context?.activeSentence && context.activeSentence.includes(issue.original))
    confidence += 0.03;

  return Math.max(0.5, Math.min(0.99, Number(confidence.toFixed(2))));
}

function getPriority(
  issue: Issue,
  confidence: number,
  text: string,
  context?: AnalysisContext,
): number {
  const severityWeight: Record<Issue['type'], number> = {
    spelling: 1,
    grammar: 0.95,
    clarity: 0.8,
    style: 0.72,
  };

  let priority = confidence * 100 * severityWeight[issue.type];

  const occurrenceCount = issue.original
    ? text.toLowerCase().split(issue.original.toLowerCase()).length - 1
    : 1;
  if (occurrenceCount > 1) priority += Math.min(occurrenceCount * 2, 8);
  if (
    context?.fullTextExcerpt &&
    context.fullTextExcerpt.toLowerCase().includes(issue.original.toLowerCase())
  ) {
    priority += 4;
  }

  return Number(priority.toFixed(2));
}

async function getLlmAutocomplete(
  text: string,
  cursor: number,
  apiKey: string,
  model: string | undefined,
  provider: LLMProvider,
  baseUrl?: string,
  context?: AnalysisContext,
) {
  const openai = new OpenAI({
    apiKey: apiKey || 'ollama',
    baseURL: baseUrl || getProviderBaseUrl(provider),
  });

  const prefix = text.slice(0, cursor);
  const suffix = text.slice(cursor);

  const completion = await openai.chat.completions.create({
    messages: [
      {
        role: 'system',
        content:
          'You are a writing assistant. Predict the next short continuation for the user. Return ONLY JSON with keys suggestion and confidence. Keep suggestion under 12 words and do not repeat the existing text.',
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
    model: model || 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    max_tokens: 80,
    temperature: 0.5,
  });

  const content = completion.choices[0]?.message?.content || '{"suggestion":"","confidence":0.5}';
  const parsed = JSON.parse(content.replace(/^```json\s*/, '').replace(/\s*```$/, ''));

  return {
    suggestion: typeof parsed.suggestion === 'string' ? parsed.suggestion.trim() : '',
    confidence:
      typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.72,
    replaceStart: cursor,
    replaceEnd: cursor,
    source: 'llm' as const,
  };
}

function getHeuristicAutocomplete(text: string, cursor: number) {
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
        source: 'heuristic' as const,
      };
    }
  }

  const endsWithSentence = /[.!?]$/.test(trimmed);
  return {
    suggestion: endsWithSentence ? ' This helps keep the writing clear.' : '',
    confidence: endsWithSentence ? 0.42 : 0,
    replaceStart: cursor,
    replaceEnd: cursor,
    source: 'heuristic' as const,
  };
}

export default app;
