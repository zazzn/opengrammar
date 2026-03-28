/**
 * OpenGrammar Popup — Grammarly-faithful React UI
 * Layout: Header → Score ring → Issue chips → AI card →
 *         Quick actions → Enable toggle → Settings → Footer
 */
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';
import './popup.css';
import type { ProviderConfig } from '../types';

interface Settings {
  enabled: boolean;
  apiKey: string;
  model: string;
  backendUrl: string;
  provider: string;
  customBaseUrl: string;
  backendHealthy: boolean;
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

/* ─── Main Popup Component ─── */
const Popup = () => {
  const [settings, setSettings] = useState<Settings>({
    enabled: true,
    apiKey: '',
    model: 'gpt-4o-mini',
    backendUrl: 'http://localhost:8787',
    provider: 'openai',
    customBaseUrl: '',
    backendHealthy: true,
  });
  const [providerModelMemory, setProviderModelMemory] = useState<Record<string, string>>({});
  const [showApiKey, setShowApiKey]   = useState(false);
  const [loading, setLoading]         = useState(true);
  const [providers, setProviders]     = useState<ProviderConfig[]>([]);
  const [availableModels, setModels]  = useState<string[]>([]);
  const [fetchingModels, setFetching] = useState(false);
  const [showAdvanced, setAdvanced]   = useState(false);
  const [issueStats, setIssueStats]   = useState({ grammar: 0, style: 0, clarity: 0, total: 0 });
  const advancedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSettings();
    loadProviders();
    loadIssueStats();
  }, []);

  useEffect(() => {
    if (settings.provider) loadModels();
  }, [settings.provider]);

  const loadSettings = () => {
    chrome.storage.sync.get(
      ['enabled', 'apiKey', 'model', 'backendUrl', 'provider', 'customBaseUrl', 'backendHealthy', 'providerModelMemory'],
      (result) => {
        const memory           = (result.providerModelMemory || {}) as Record<string, string>;
        const selectedProvider = result.provider || 'openai';
        const rememberedModel  = memory[selectedProvider];
        setSettings({
          enabled:        result.enabled !== false,
          apiKey:         result.apiKey || '',
          model:          rememberedModel || result.model || 'gpt-4o-mini',
          backendUrl:     result.backendUrl || 'http://localhost:8787',
          provider:       selectedProvider,
          customBaseUrl:  result.customBaseUrl || '',
          backendHealthy: result.backendHealthy !== false,
        });
        setProviderModelMemory(memory);
        setLoading(false);
      },
    );
  };

  const loadProviders = async () => {
    try {
      const r = await chrome.runtime.sendMessage({ type: 'GET_PROVIDERS' });
      if (r.providers) setProviders(r.providers);
    } catch {}
  };

  const loadModels = async () => {
    setFetching(true);
    try {
      const r = await chrome.runtime.sendMessage({
        type: 'GET_MODELS',
        provider: settings.provider,
        apiKey: settings.apiKey,
        baseUrl: settings.provider === 'custom' ? settings.customBaseUrl : undefined,
      });
      if (r.models) setModels(r.models);
    } catch {}
    finally { setFetching(false); }
  };

  /** Pull last-session issue stats from storage */
  const loadIssueStats = () => {
    chrome.storage.local.get(['lastIssueStats'], (r) => {
      if (r.lastIssueStats) setIssueStats(r.lastIssueStats as typeof issueStats);
    });
  };

  const saveSettings = (updates: Partial<Settings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    const mem = { ...providerModelMemory, ...(next.provider ? { [next.provider]: next.model } : {}) };
    setProviderModelMemory(mem);
    chrome.storage.sync.set({
      enabled: next.enabled, apiKey: next.apiKey, model: next.model,
      backendUrl: next.backendUrl, provider: next.provider,
      customBaseUrl: next.customBaseUrl, providerModelMemory: mem,
    });
  };

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const p = e.target.value;
    const remembered = providerModelMemory[p];
    const def = providers.find((x) => x.id === p)?.models[0] || 'gpt-4o-mini';
    saveSettings({ provider: p, model: remembered || def });
  };

  /** Rough writing score based on issue counts */
  const writingScore = Math.max(
    10,
    100 - issueStats.grammar * 12 - issueStats.style * 6 - issueStats.clarity * 4,
  );

  const selectedProvider = providers.find((p) => p.id === settings.provider);
  const modelList        = availableModels.length > 0 ? availableModels : selectedProvider?.models || [];

  if (loading) {
    return (
      <div className="load-screen">
        <div className="spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Header ── */}
      <header className="popup-header">
        <div className="brand">
          {/* Indigo-violet quill logo */}
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              {/* Quill pen — represents writing & language */}
              <path d="M20 4C15 4 10 7 8 12L4 20l8-4c5-2 8-7 8-12z"
                fill="white" fill-opacity="0.92"/>
              <path d="M8 12 L4 20" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" strokeLinecap="round"/>
              {/* Checkmark nib */}
              <path d="M5 18l2 2 4-5" stroke="white" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
          </div>
          <span className="brand-name">Open<span>Grammar</span></span>
        </div>
        <button
          className={`status-pill ${settings.enabled ? 'active' : 'paused'}`}
          onClick={() => saveSettings({ enabled: !settings.enabled })}
          title={settings.enabled ? 'Click to pause' : 'Click to enable'}
        >
          <span className="dot" />
          {settings.enabled ? 'Active' : 'Paused'}
        </button>
      </header>

      {/* ── Writing score ring ── */}
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

      {/* ── Issue category chips ── */}
      <div className="issue-chips">
        {issueStats.total === 0 ? (
          <span className="chip ok">
            <span className="chip-dot" />
            All clear
          </span>
        ) : (
          <>
            {issueStats.grammar > 0 && (
              <span className="chip grammar">
                <span className="chip-dot" />
                {issueStats.grammar} grammar
              </span>
            )}
            {issueStats.clarity > 0 && (
              <span className="chip clarity">
                <span className="chip-dot" />
                {issueStats.clarity} clarity
              </span>
            )}
            {issueStats.style > 0 && (
              <span className="chip style">
                <span className="chip-dot" />
                {issueStats.style} style
              </span>
            )}
          </>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div className="quick-actions">
        <button
          className="action-btn"
          onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_REWRITE_PAGE' })}
        >
          <RewriteIcon />
          Rephrase
        </button>
        <button
          className="action-btn"
          onClick={() => chrome.runtime.sendMessage({ type: 'OPEN_STATS_PAGE' })}
        >
          <StatsIcon />
          Stats
        </button>
      </div>

      {/* ── AI provider info card ── */}
      <div className="ai-card">
        <div className="ai-card-left">
          <strong>AI Engine</strong>
          <span>{selectedProvider?.name || 'OpenAI'} · {settings.model}</span>
        </div>
        <span className={`backend-dot ${settings.backendHealthy ? 'ok' : 'err'}`} title={settings.backendHealthy ? 'Backend connected' : 'Backend offline'} />
      </div>

      <hr className="divider" />

      {/* ── Settings ── */}
      <div className={`settings-area ${!settings.enabled ? 'muted' : ''}`}>

        {/* Enable toggle */}
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

        {/* Provider selector */}
        <div className="field-group">
          <label className="field-label">AI Provider</label>
          <select value={settings.provider} onChange={handleProviderChange} className="select-input">
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.requiresApiKey ? '🔑' : '✅ Free'}
              </option>
            ))}
          </select>
          {selectedProvider && <p className="field-hint">{selectedProvider.description}</p>}
        </div>

        {/* API key */}
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
              <button type="button" onClick={() => setShowApiKey((v) => !v)} className="icon-btn" title={showApiKey ? 'Hide' : 'Show'}>
                <EyeIcon show={showApiKey} />
              </button>
            </div>
          </div>
        )}

        {/* Model selector */}
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
              : modelList.map((m) => <option key={m} value={m}>{m}</option>)
            }
          </select>
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          className={`advanced-toggle ${showAdvanced ? 'open' : ''}`}
          onClick={() => setAdvanced((v) => !v)}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SettingsIcon />
            Advanced settings
          </span>
          <ChevronIcon />
        </button>

        {showAdvanced && (
          <div className="advanced-panel" ref={advancedRef}>
            {settings.provider === 'custom' && (
              <div className="field-group">
                <label className="field-label">Custom Base URL</label>
                <input
                  type="url"
                  value={settings.customBaseUrl}
                  onChange={(e) => saveSettings({ customBaseUrl: e.target.value })}
                  placeholder="https://your-api.com/v1"
                  className="text-input"
                />
              </div>
            )}
            <div className="field-group">
              <label className="field-label">Backend URL</label>
              <p className="field-hint" style={{ marginBottom: 5 }}>Default: http://localhost:8787</p>
              <input
                type="url"
                value={settings.backendUrl}
                onChange={(e) => saveSettings({ backendUrl: e.target.value })}
                placeholder="http://localhost:8787"
                className="text-input"
              />
              <div className="backend-status-row">
                <span className={`backend-dot ${settings.backendHealthy ? 'ok' : 'err'}`} />
                <span className="status-text">
                  {settings.backendHealthy ? 'Connected' : 'Not connected'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

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
