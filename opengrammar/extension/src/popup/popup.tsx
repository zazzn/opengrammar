/**
 * OpenGrammar Popup — Grammarly-faithful React UI
 * Layout: Header → Score ring → Issue chips → AI card →
 *         Quick actions → Enable toggle → Settings → Footer
 */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';
import type { ProviderConfig } from '../types';
import { getApiKey, setApiKey } from '../shared/apiKeyStore';

interface Settings {
  enabled: boolean;
  apiKey: string;
  model: string;
  provider: string;
  customBaseUrl: string;
  ollamaUrl: string;
  ollamaKeepAlive: string;
}

/** Normalize an Ollama server URL to its OpenAI-compatible /v1 base. */
export function ollamaV1(url: string): string {
  const b = (url || 'http://localhost:11434').trim().replace(/\/+$/, '');
  return /\/v1$/.test(b) ? b : `${b}/v1`;
}

/**
 * Best local models for grammar/writing correction, best → acceptable.
 * Strong instruction-following + low latency is what matters here.
 * qwen2.5:7b is the top pick: excellent at editing/rewriting, fast on
 * modest hardware. We match by prefix since installed names carry tags
 * (e.g. "qwen2.5:7b-instruct-q4_K_M").
 */
const RECOMMENDED_OLLAMA = [
  'qwen3', 'qwen2.5', 'llama3.1', 'llama3.2', 'gemma2', 'mistral-nemo', 'mistral', 'phi3.5', 'phi3',
];
function pickRecommended(installed: string[]): string | null {
  // Code/embedding variants are poor at prose grammar — skip them.
  const general = installed.filter(
    (m) => !/(coder|embed|vision|math|guard)/i.test(m),
  );
  for (const fam of RECOMMENDED_OLLAMA) {
    const hit = general.find((m) => m.toLowerCase().startsWith(fam));
    if (hit) return hit;
  }
  return general[0] || installed[0] || null;
}

/* ─── Score ring SVG component ─── */
function ScoreRing({ score, size = 64 }: { score: number; size?: number }) {
  const r      = (size - 6) / 2;
  const circ   = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  // Color theory: indigo=excellent, amber=good, red=issues
  const color  = score >= 80 ? '#4F46E5' : score >= 55 ? '#f59e0b' : '#e53935';

  return (
    <div className="score-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EEF2FF" strokeWidth={5} />
        <circle
          cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.65s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="score-number" style={{ fontSize: size < 60 ? 14 : 18, color }}>
        {score}
      </div>
    </div>
  );
}

/* ─── Icon components ─── */
const RewriteIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 8a6 6 0 1 1 1.5 4M2 12V8h4" />
  </svg>
);
const StatsIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <rect x="2" y="10" width="3" height="4" rx="0.5" fill="currentColor" stroke="none"/>
    <rect x="6.5" y="6" width="3" height="8" rx="0.5" fill="currentColor" stroke="none"/>
    <rect x="11" y="2" width="3" height="12" rx="0.5" fill="currentColor" stroke="none"/>
  </svg>
);
const EyeIcon = ({ show }: { show: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
    {!show && <line x1="1" y1="1" x2="23" y2="23" />}
  </svg>
);
const SettingsIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 6l4 4 4-4" />
  </svg>
);

/* ─── Score and Info Section ─── */
const ScoreSection = ({ issueStats, writingScore }: { issueStats: any, writingScore: number }) => (
  <>
    <div className="score-section">
      <ScoreRing score={writingScore} />
      <div className="score-info">
        <h2>
          {writingScore >= 88 ? 'Excellent writing!' :
            writingScore >= 70 ? 'Good writing' :
            writingScore >= 50 ? 'Needs some work' :
            'Issues detected'}
        </h2>
        <p>
          {issueStats.total === 0
            ? 'No issues found on this page.'
            : `${issueStats.total} issue${issueStats.total !== 1 ? 's' : ''} detected — click underlined text to fix.`}
        </p>
      </div>
    </div>
    <div className="issue-chips">
      {issueStats.total === 0 ? (
        <span className="chip ok"><span className="chip-dot" />All clear</span>
      ) : (
        <>
          {issueStats.grammar > 0 && <span className="chip grammar"><span className="chip-dot" />{issueStats.grammar} grammar</span>}
          {issueStats.clarity > 0 && <span className="chip clarity"><span className="chip-dot" />{issueStats.clarity} clarity</span>}
          {issueStats.style > 0 && <span className="chip style"><span className="chip-dot" />{issueStats.style} style</span>}
        </>
      )}
    </div>
  </>
);

/* ─── Settings Panel ─── */
const SettingsPanel = ({
  settings,
  saveSettings,
  providers,
  selectedProvider,
  modelList,
  fetchingModels,
  handleProviderChange,
  showApiKey,
  setShowApiKey,
  showAdvanced,
  setAdvanced,
  advancedRef,
  scanModels,
  scannedCount,
  ollamaStatus,
  testOllama,
}: any) => (
  <div className={`settings-area ${!settings.enabled ? 'muted' : ''}`}>
    <div className="field-group">
      <label className="toggle-label">
        <div className="toggle-text">
          <strong>Enable OpenGrammar</strong>
          <span>Check grammar on every page</span>
        </div>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => saveSettings({ enabled: e.target.checked })}
          className="toggle-input"
        />
        <span className="toggle-track" />
      </label>
    </div>

    <div className="field-group">
      <label className="field-label">AI Provider</label>
      <select value={settings.provider} onChange={handleProviderChange} className="select-input">
        {providers.map((p: any) => (
          <option key={p.id} value={p.id}>{p.name} {p.requiresApiKey ? '🔑' : '✅ Free'}</option>
        ))}
      </select>
      {selectedProvider && <p className="field-hint">{selectedProvider.description}</p>}
    </div>

    {selectedProvider?.requiresApiKey && (
      <div className="field-group">
        <label className="field-label">API Key <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#aeaeb2' }}>— stored locally</span></label>
        <div className="input-row">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={settings.apiKey}
            onChange={(e) => saveSettings({ apiKey: e.target.value })}
            placeholder={settings.provider === 'ollama' ? 'Not required' : 'sk-…'}
            className="text-input"
            disabled={settings.provider === 'ollama'}
          />
          <button type="button" onClick={() => setShowApiKey((v: boolean) => !v)} className="icon-btn" title={showApiKey ? 'Hide' : 'Show'}>
            <EyeIcon show={showApiKey} />
          </button>
        </div>
      </div>
    )}

    <div className="field-group">
      <label className="field-label">Model</label>
      <select
        value={settings.model}
        onChange={(e) => saveSettings({ model: e.target.value })}
        className="select-input"
        disabled={fetchingModels}
      >
        {fetchingModels
          ? <option>Loading…</option>
          : modelList.map((m: string) => {
              const rec = settings.provider === 'ollama' && m === pickRecommended(modelList);
              return <option key={m} value={m}>{m}{rec ? '  (Recommended)' : ''}</option>;
            })}
      </select>
      {settings.provider === 'ollama' && pickRecommended(modelList) && (
        <p className="field-hint" style={{ marginTop: 5 }}>
          Recommended for grammar: <strong>{pickRecommended(modelList)}</strong>
        </p>
      )}
    </div>

    <button type="button" className={`advanced-toggle ${showAdvanced ? 'open' : ''}`} onClick={() => setAdvanced((v: boolean) => !v)}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><SettingsIcon /> Advanced settings</span>
      <ChevronIcon />
    </button>

    {showAdvanced && (
      <div className="advanced-panel" ref={advancedRef}>
        {settings.provider === 'custom' && (
          <div className="field-group">
            <label className="field-label">Custom Base URL</label>
            <input type="url" value={settings.customBaseUrl} onChange={(e) => saveSettings({ customBaseUrl: e.target.value })} placeholder="https://your-api.com/v1" className="text-input" />
          </div>
        )}
        {settings.provider === 'ollama' && (
          <div className="field-group">
            <label className="field-label">Ollama Server URL</label>
            <p className="field-hint" style={{ marginBottom: 5 }}>Default: http://localhost:11434</p>
            <div className="input-row">
              <input
                type="url"
                value={settings.ollamaUrl}
                onChange={(e) => saveSettings({ ollamaUrl: e.target.value })}
                onBlur={() => scanModels()}
                placeholder="http://localhost:11434"
                className="text-input"
              />
              <button
                type="button"
                className="icon-btn"
                title="Scan installed models"
                onClick={() => scanModels()}
                disabled={fetchingModels}
              >↻</button>
            </div>
            <p className="field-hint" style={{ marginTop: 5 }}>
              {fetchingModels
                ? 'Scanning…'
                : scannedCount > 0
                  ? `${scannedCount} model${scannedCount !== 1 ? 's' : ''} found`
                  : 'No models found — is Ollama running at this URL?'}
            </p>
            {(() => {
              const st = ollamaStatus || {};
              const color = st.testing
                ? '#f59e0b'
                : !st.reachable
                  ? '#e53935'
                  : st.modelReady
                    ? '#16a34a'
                    : '#f59e0b';
              const label = st.testing
                ? 'Testing model…'
                : !st.reachable
                  ? 'Server offline'
                  : st.modelReady
                    ? 'Ready · model loaded'
                    : 'Online · model not loaded (loads on first use)';
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span className="status-text" style={{ flex: 1 }}>{label}</span>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 'auto', padding: '3px 9px', fontSize: 12 }}
                    title="Load the selected model and confirm it responds"
                    onClick={() => testOllama && testOllama()}
                    disabled={st.testing || !st.reachable}
                  >Test</button>
                </div>
              );
            })()}
            <div style={{ marginTop: 10 }}>
              <label className="field-label">Unload model when idle</label>
              <select
                className="select-input"
                value={settings.ollamaKeepAlive}
                onChange={(e) => saveSettings({ ollamaKeepAlive: e.target.value })}
              >
                <option value="0">Immediately after each use</option>
                <option value="30s">After 30 seconds idle</option>
                <option value="2m">After 2 minutes idle</option>
                <option value="5m">After 5 minutes idle</option>
                <option value="-1">Never — keep loaded</option>
              </select>
              <p className="field-hint" style={{ marginTop: 5 }}>
                Returns system/VRAM when not in use. Shorter frees memory sooner;
                longer keeps repeat checks fast.
              </p>
            </div>
          </div>
        )}
      </div>
    )}
  </div>
);

/* ─── Main Popup Component ─── */
const Popup = () => {
  const [settings, setSettings] = useState<Settings>({
    enabled: true, apiKey: '', model: 'gpt-4o-mini',
    provider: 'openai', customBaseUrl: '', ollamaUrl: 'http://localhost:11434', ollamaKeepAlive: '2m',
  });
  const [providerModelMemory, setProviderModelMemory] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [providers, setProviders]     = useState<ProviderConfig[]>([]);
  const [availableModels, setModels]  = useState<string[]>([]);
  const [fetchingModels, setFetching] = useState(false);
  const [showAdvanced, setAdvanced]   = useState(false);
  const [issueStats, setIssueStats]   = useState({ grammar: 0, style: 0, clarity: 0, total: 0 });
  const [ollamaStatus, setOllamaStatus] = useState<{ reachable: boolean; running: string[]; modelReady: boolean; testing: boolean }>({ reachable: false, running: [], modelReady: false, testing: false });
  const advancedRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSettings(); loadProviders(); loadIssueStats(); }, []);
  useEffect(() => { if (settings.provider) loadModels(); }, [settings.provider]);
  useEffect(() => {
    if (settings.provider === 'ollama' && settings.ollamaUrl) checkOllama(false);
  }, [settings.provider, settings.ollamaUrl, settings.model]);

  const loadSettings = () => {
    chrome.storage.sync.get(['enabled', 'model', 'provider', 'customBaseUrl', 'ollamaUrl', 'ollamaKeepAlive', 'providerModelMemory'], (result) => {
      const memory = (result.providerModelMemory || {}) as Record<string, string>;
      const selectedProvider = result.provider || 'openai';
      setSettings({
        enabled: result.enabled !== false, apiKey: '', model: memory[selectedProvider] || result.model || 'gpt-4o-mini',
        provider: selectedProvider, customBaseUrl: result.customBaseUrl || '',
        ollamaUrl: result.ollamaUrl || 'http://localhost:11434',
        ollamaKeepAlive: result.ollamaKeepAlive || '2m',
      });
      setProviderModelMemory(memory);
      setLoading(false);
      // API key lives in the encrypted store (chrome.storage.local), not sync.
      void getApiKey().then((k) => setSettings((s) => ({ ...s, apiKey: k })));
    });
  };

  const loadProviders = async () => { try { const r = await chrome.runtime.sendMessage({ type: 'GET_PROVIDERS' }); if (r.providers) setProviders(r.providers); } catch {} };

  const loadModels = async () => {
    setFetching(true);
    const baseUrl =
      settings.provider === 'custom'
        ? settings.customBaseUrl
        : settings.provider === 'ollama'
          ? ollamaV1(settings.ollamaUrl)
          : undefined;
    try {
      const r = await chrome.runtime.sendMessage({ type: 'GET_MODELS', provider: settings.provider, apiKey: settings.apiKey, baseUrl });
      const models: string[] = r?.models || [];
      if (models.length) setModels(models);
      // For Ollama, default to the recommended model if the user hasn't
      // explicitly picked one that's actually installed.
      if (settings.provider === 'ollama' && models.length) {
        const rec = pickRecommended(models);
        if (rec && !models.includes(settings.model)) saveSettings({ model: rec });
      }
    } catch {} finally { setFetching(false); }
  };

  const checkOllama = async (probe: boolean) => {
    if (probe) setOllamaStatus((s) => ({ ...s, testing: true }));
    try {
      const r = await chrome.runtime.sendMessage({
        type: 'GET_OLLAMA_STATUS',
        baseUrl: ollamaV1(settings.ollamaUrl),
        model: settings.model,
        probe,
      });
      setOllamaStatus({
        reachable: !!r?.reachable,
        running: r?.running || [],
        modelReady: !!r?.modelReady,
        testing: false,
      });
    } catch {
      setOllamaStatus({ reachable: false, running: [], modelReady: false, testing: false });
    }
  };

  const loadIssueStats = () => { chrome.storage.local.get(['lastIssueStats'], (r) => { if (r.lastIssueStats) setIssueStats(r.lastIssueStats as typeof issueStats); }); };

  const saveSettings = (updates: Partial<Settings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    const mem = { ...providerModelMemory, ...(next.provider ? { [next.provider]: next.model } : {}) };
    setProviderModelMemory(mem);
    // The API key never goes to chrome.storage.sync — it's encrypted at rest
    // in chrome.storage.local via the shared keyStore.
    const { apiKey: _apiKey, ...syncable } = next;
    chrome.storage.sync.set({ ...syncable, providerModelMemory: mem });
    if ('apiKey' in updates) void setApiKey(updates.apiKey ?? '');
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    saveSettings({ provider: p, model: providerModelMemory[p] || providers.find((x) => x.id === p)?.models[0] || 'gpt-4o-mini' });
  };

  const writingScore = Math.max(10, 100 - issueStats.grammar * 12 - issueStats.style * 6 - issueStats.clarity * 4);
  const selectedProvider = providers.find((p) => p.id === settings.provider);
  const modelList = availableModels.length > 0 ? availableModels : selectedProvider?.models || [];

  if (loading) return <div className="load-screen"><div className="spinner" /><p>Loading…</p></div>;

  return (
    <div>
      <header className="popup-header">
        <div className="brand">
          <div className="brand-icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 4C15 4 10 7 8 12L4 20l8-4c5-2 8-7 8-12z" fill="white" fillOpacity="0.92"/><path d="M8 12 L4 20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round"/><path d="M5 18l2 2 4-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></div>
          <span className="brand-name">Open<span>Grammar</span></span>
        </div>
        <button className={`status-pill ${settings.enabled ? 'active' : 'paused'}`} onClick={() => saveSettings({ enabled: !settings.enabled })} title={settings.enabled ? 'Click to pause' : 'Click to enable'}>
          <span className="dot" />{settings.enabled ? 'Active' : 'Paused'}
        </button>
      </header>

      <ScoreSection issueStats={issueStats} writingScore={writingScore} />

      <div className="quick-actions">
        <button className="action-btn" onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_REWRITE_PAGE' })}><RewriteIcon />Rephrase</button>
        <button className="action-btn" onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_STATS_PAGE' })}><StatsIcon />Stats</button>
      </div>

      <div className="ai-card">
        <div className="ai-card-left"><strong>AI Engine</strong><span>{selectedProvider?.name || 'OpenAI'} · {settings.model}</span></div>
      </div>

      <hr className="divider" />
      
      <SettingsPanel
        settings={settings} saveSettings={saveSettings} providers={providers} selectedProvider={selectedProvider} modelList={modelList}
        fetchingModels={fetchingModels} handleProviderChange={handleProviderChange} showApiKey={showApiKey} setShowApiKey={setShowApiKey}
        showAdvanced={showAdvanced} setAdvanced={setAdvanced} advancedRef={advancedRef}
        scanModels={loadModels} scannedCount={availableModels.length}
        ollamaStatus={ollamaStatus} testOllama={() => checkOllama(true)}
      />

      {/* ── Footer ── */}
      <footer className="popup-footer">
        <button onClick={() => chrome.runtime.openOptionsPage()} className="footer-btn">
          <SettingsIcon />
          Open full settings
        </button>
      </footer>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
