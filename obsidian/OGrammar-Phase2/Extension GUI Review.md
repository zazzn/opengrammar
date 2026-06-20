---
tags: [ogrammar, phase-2, ux, review]
owner: UX Lead
---

> Part of [[00 - OGrammar Phase 2 - CEO Brief]] - under [[UX]]

# Extension GUI Review

I have everything I need to write the verdict.

Owner: UX Lead - Reports to: CEO

## Verdict

The two GUI surfaces work but read as unfinished and off-brand, and your specific complaint is real and fixable in one line. The single biggest problem: the **"Advanced settings" disclosure expands to an empty box for 6 of the 8 providers** (`popup.tsx:239`), because its only contents are gated to `custom` and `ollama` while the toggle that opens it always renders. That is the "advanced settings that do nothing" you are seeing. Underneath it sit three smaller embarrassments stacked in the same popup: the enable control is rendered **three times** for one boolean, the whole UI is still built on the old indigo/Inter system (so it visibly clashes with the new green identity), and the Options page shows every cloud user a large NVIDIA-VRAM Ollama GPU table they will never use.

## Ranked fix list

### P0 - ship-blockers (this includes your provider-settings gripe)

**P0-1. Advanced disclosure opens to nothing for 6 of 8 providers.**
- Problem: the toggle at `popup.tsx:239` renders for every provider; its body only has `custom` and `ollama` children, so openai/openrouter/groq/together/abacus/deepseek get an empty expanded panel. The dashed-border styling (`popup.css:293`) makes it look even more like a broken dropzone.
- Fix: gate the toggle on the same condition as its body - `const hasAdvanced = settings.provider === 'ollama' || settings.provider === 'custom';` and wrap both the `advanced-toggle` button and the `advanced-panel` in `{hasAdvanced && (…)}`. For the 6 cloud providers the control simply disappears.
- Files: `extension/src/popup/popup.tsx` (toggle at the `advanced-toggle` button, panel just below).

**P0-2. Three enable controls for one boolean.**
- Problem: header `status-pill` (`popup.tsx:612`), the inline `enable-row` right below it (`popup.tsx:617-627`, fully inline-styled with raw `#f0f0f0` so the theme can't touch it), and a third "Enable OGrammar" toggle inside `SettingsPanel` (`popup.tsx:142-156`) all flip `settings.enabled`.
- Fix: keep the header pill as the single source of truth; delete the `enable-row` block and the `SettingsPanel` toggle's `field-group`.
- Files: `extension/src/popup/popup.tsx`.

**P0-3. Rip out indigo + Inter; install the green identity.**
- Problem: `popup.css:6` imports Inter (spec is Geist); `popup.css:12-41` is an indigo token system (`--og-primary #4F46E5`, `--og-accent #7C3AED`, `--og-primary-light #EEF2FF`, indigo-tinted text `#1A1A2E`); the score ring hardcodes `#4F46E5`/`#EEF2FF` in JSX at `popup.tsx:41,46` (a CSS-var swap will miss these); the header logo is an indigo→violet gradient (`popup.css:79-86`) which alone violates "ONE accent"; and Options runs a *different* blue (`--primary #2563eb`, `options.css:8`) with a blue about-gradient (`options.css:578`). The two surfaces aren't even the same color today.
- Fix: one token set across both files - off-black text `#16181C`, off-white surface `#FAFAF8`, single accent `#1FA463` for fills/ring/focus only. Swap Inter→Geist. Replace the JSX hexes in `ScoreRing`. Replace the gradient logo with a flat green mark; remove the indigo wordmark span color (`popup.css:91-93`).
- Files: `extension/src/popup/popup.css`, `extension/src/popup/popup.tsx`, `extension/src/options/options.css`.

**P0-4. Contrast failures on text.**
- Problem: `field-label` uses `--og-text-3 #A0A3B1` on white (~2.4:1, fails AA); the inline `#aeaeb2` "stored locally" note (`popup.tsx:170`) and `#9ca3af` empty state (`options.css:630`) fail too. Note `#1FA463` itself is ~3.0:1 on white - fine for fills/ring/borders, fails for body text.
- Fix: raise label/hint text to a `#6b7280`-class neutral; use a darkened green (~`#17794c`) for any green *text/links*, reserve `#1FA463` for fills.
- Files: `popup.css`, `options.css`, the two inline hexes.

### P1

**P1-1. Options Ollama GPU guide shown to all users.** `index.html:230-287` is a 9-row VRAM table plus prose, irrelevant to the ~6 of 8 non-Ollama users. Fix: wrap in `<section id="ollamaGuideSection" hidden>`; in `options.tsx` read `provider` from `chrome.storage.sync` and subscribe to `chrome.storage.onChanged` to toggle `hidden = provider !== 'ollama'`. Files: `options/index.html`, `options/options.tsx`.

**P1-2. De-noise the score band.** Ring (`popup.tsx:41`) + headline + chips + a restating sentence are four readouts for one synthetic number (`writingScore = 100 - grammar*12 - style*6 - clarity*4`, `popup.tsx:599`). Fix: lead with the chips (honest, actionable) + one status line; drop or shrink the ring. Files: `popup.tsx`, `popup.css`.

**P1-3. Read-only AI Engine card is redundant / lies in the empty state.** `popup.tsx:632` always echoes `selectedProvider?.name || 'OpenAI'} · {settings.model}`, so a new user with no key sees "AI Engine: OpenAI · gpt-4o-mini" as if active. Fix: make it key-aware - "AI Engine: Off - add a key to enable AI suggestions" when `requiresApiKey && !apiKey`; "Local · {model}" for reachable Ollama; otherwise "Provider · model". Or merge it into the provider/model controls and cut the duplicate. Files: `popup.tsx`.

**P1-4. Emoji in functional controls.** `🔑`/`✅ Free` in `<option>` text (`popup.tsx:162`), `📊` (`index.html:247`), `❤️` (`index.html:378`). "Free" is also misleading - Ollama is `requiresApiKey:false` but needs a local server. Fix: drop the emoji; move requirement to a `field-hint` under the select ("Needs a free API key" / "Runs locally - needs Ollama installed" / "Bring your own OpenAI-compatible endpoint"). Files: `popup.tsx`, `index.html`.

**P1-5. Reconcile `llmProtectedMasking` default.** Options defaults `false` (`options.tsx:63`); background initializes `true` (`background:1121`). Pick one and match both; relabel it out of "Debug" into AI-safety. Files: `options.tsx`, `background/index.ts`, `index.html`.

### P2

**P2-1. Key-aware Model picker.** For a keyed cloud provider with an empty key, `loadModels` silently falls back to the curated list (`popup.tsx:601`), so the dropdown looks functional but every call will fail. Fix: when `requiresApiKey && !apiKey`, disable the select and show "Enter your API key to load models" (mirror the honest Ollama "no models found"). Files: `popup.tsx`.

**P2-2. Accessibility pass.** Toggles hide the checkbox with `display:none` (`popup.css:271`, `options.css:195`) - removes them from tab order; switch to visually-hidden + `:focus-visible` ring. Add `aria-label` to icon-only buttons (eye, scan `↻`, Test, Retry, Unload now), `aria-pressed` to the status pill, `aria-describedby`+Escape to the info bubble (`index.html:315`). Files: `popup.css`, `popup.tsx`, `options.css`, `index.html`.

**P2-3. Remove dead code.** API-key input has unreachable `placeholder/disabled` Ollama branches (`popup.tsx:176-178`) - the whole block is already gated on `requiresApiKey` and Ollama is `false`. Delete. Files: `popup.tsx`.

**P2-4. Extract a shared token/component layer.** Toggles, inputs, buttons, focus rings, and radii are forked between popup and options (toggle widths 42 vs 44px). Every fix currently has to be made twice. Files: new shared CSS, `popup.css`, `options.css`.

## Provider-aware settings

Final field-by-provider matrix (render = ✓, do not render = —):

| Field | openai / openrouter / groq / together / abacus / deepseek | ollama | custom |
|---|---|---|---|
| Enable toggle (single) | ✓ | ✓ | ✓ |
| AI Provider select | ✓ | ✓ | ✓ |
| API Key | ✓ | — | ✓ |
| Model select | ✓ (curated/live) | ✓ (live `/api/tags`) | ✓ (live or free-text) |
| **Advanced disclosure** | **—** | ✓ | ✓ |
| Custom Base URL | — | — | ✓ |
| Ollama Server URL + scan + status | — | ✓ | — |
| Ollama keep-alive + Unload now | — | ✓ | — |
| GPU guide (Options page) | — | ✓ | — |

Exact conditional rules:

```jsx
// popup.tsx
const hasAdvanced = settings.provider === 'ollama' || settings.provider === 'custom';

// API key block — already correct, keep as-is, but remove dead ollama branches:
{selectedProvider?.requiresApiKey && ( /* API Key field, no ollama placeholder/disabled */ )}

// Advanced — render the toggle ONLY when it has contents:
{hasAdvanced && (
  <>
    <button className="advanced-toggle" onClick={() => setAdvanced(v => !v)}>Advanced settings</button>
    {showAdvanced && (
      <div className="advanced-panel">
        {settings.provider === 'custom' && (/* Custom Base URL */)}
        {settings.provider === 'ollama' && (/* host + status + keep-alive + unload */)}
      </div>
    )}
  </>
)}
```

```js
// options.tsx — make the GPU guide provider-aware
chrome.storage.sync.get(['provider'], ({ provider }) => {
  document.getElementById('ollamaGuideSection').hidden = provider !== 'ollama';
});
chrome.storage.onChanged.addListener((c, area) => {
  if (area === 'sync' && c.provider)
    document.getElementById('ollamaGuideSection').hidden = c.provider.newValue !== 'ollama';
});
```

`resolveBaseUrl` (`llmClient.ts:35-43`) and `ollamaKeepAliveParam` (`llmClient.ts:50-57`) already prove `ollamaUrl`/`customBaseUrl`/`ollamaKeepAlive` are inert outside their provider, so hiding their fields loses nothing functionally - the UI just stops lying about what is configurable.

## Redesigned Options-page IA

Today it is one undifferentiated scroll of 10 equal-weight white cards in no clear order (API Keys, then Site Settings, then Dictionary, then the giant GPU table, then Debug). Replace with 4 grouped, sticky-tabbed sections:

1. **Writing** - autocomplete, autocorrect, both delays, dialect, and masking relabeled "AI correction safety" (moved out of Debug).
2. **Sites & Dictionary** - domain allowlist, custom dictionary, ignored suggestions.
3. **Privacy & Data** - "Remove all API keys" (demoted from its own top-level section - it is just a delete button today, `index.html:104-121`), export/import/reset, analytics, debug logging + copy log.
4. **Help & About** - Ollama GPU guidance (collapsed, Ollama-only per P1-1), version, links.

All four on the new tokens: off-white surfaces, off-black text, `#1FA463` only for the active tab indicator and primary actions.

## Quick wins (under ~1 hour each)

- **P0-1** `hasAdvanced` gate - one conditional, directly answers your complaint.
- **P0-2** delete the two duplicate enable controls.
- **P2-3** remove dead Ollama placeholder/disabled branches (`popup.tsx:176-178`).
- **P1-4** strip emoji from `<option>` labels and the `📊`/`❤️`; move requirement to a hint string.
- **P1-5** make `llmProtectedMasking` default consistent across `options.tsx:63` and `background:1121`.

## Implementation plan

Recommended order: ship the five quick wins first (they resolve your literal gripe and reclaim ~a third of the popup's vertical noise), then the structural pair.

1. **`extension/src/popup/popup.tsx`**
   - Add `const hasAdvanced = settings.provider === 'ollama' || settings.provider === 'custom';` and wrap the `advanced-toggle` button + `advanced-panel` in `{hasAdvanced && (…)}` (P0-1).
   - Delete the `enable-row` block (`612`-ish region shown above) and the `SettingsPanel` "Enable OGrammar" `field-group` (`142-156`); header pill stays (P0-2).
   - Remove `placeholder={... 'ollama' ...}` and `disabled={... 'ollama'}` from the API-key input (P2-3).
   - Replace `{p.requiresApiKey ? '🔑' : '✅ Free'}` in the option label with plain `{p.name}`; show requirement via the existing `field-hint` (P1-4).
   - Replace hardcoded `#4F46E5`/`#EEF2FF` in `ScoreRing` (`41,46`) with the green/neutral tokens (P0-3); make the AI Engine card key-aware (P1-3).

2. **`extension/src/popup/popup.css`**
   - Swap Inter→Geist import (`:6`); rewrite the token block (`:12-41`) to off-black/off-white + `#1FA463`; replace the gradient logo (`:79-86`) and wordmark color (`:91-93`); raise `--og-text-3` for labels; fix toggle a11y (`:271`) (P0-3, P0-4, P2-2).

3. **`extension/src/options/options.css`**
   - Replace `--primary #2563eb` (`:8`) and the blue about-gradient (`:578`) with the shared green tokens; switch the system-font stack to Geist; fix `#9ca3af` empty-state contrast (`:630`) (P0-3, P0-4).

4. **`extension/src/options/index.html`**
   - Wrap the GPU section (`230-287`) in `<section id="ollamaGuideSection" hidden>`; regroup the 10 cards into the 4 tabbed sections above; strip `📊` (`:247`) and `❤️` (`:378`); relabel the masking row out of "Debug" (P1-1, P1-4, P1-5, IA).

5. **`extension/src/options/options.tsx`**
   - Read `provider` from `chrome.storage.sync` on init and add the `chrome.storage.onChanged` listener to toggle the GPU section; set `llmProtectedMasking` default to match background's `true` (`:63`) (P1-1, P1-5).

6. **`extension/src/background/index.ts`** (only if you decide masking defaults `false` instead) - reconcile `:1121` with `options.tsx:63`. Pick one source of truth and document it (P1-5).

No `types.ts` change is required for any of this - the provider list and `requiresApiKey` flags already carry everything the conditionals need.

---

## Appendix A - GUI + provider map
I now have everything needed. Here is the precise map.

---

## OGrammar GUI Map

### 1. Options page settings (`options/index.html` + `options/options.tsx`)
Provider/model/key are NOT here — they live in the popup. The options page only has these persisted settings (defaults from `options.tsx:56-67`, stored in `chrome.storage.sync`):

| Setting | Control | Label / HTML id | Default | Effect |
|---|---|---|---|---|
| Autocomplete suggestions | checkbox | `autocompleteEnabled` (index.html:35) | `false` | Gates the LLM/heuristic autocomplete path (`background:599`) |
| Autocorrect as you type | checkbox | `autocorrectEnabled` (:46) | `false` | Consumed by content script (silent high-conviction fixes); not read in background/index.ts |
| Autocorrect delay | select 1000/1500/2000/3000/5000 ms | `autocorrectDelay` (:59) | `2000` | Debounce before autocorrect; content-script only |
| Autocomplete delay | select 400/700/1000/1500/2000 ms | `autocompleteDelay` (:76) | `700` | Debounce before autocomplete; content-script only |
| Spelling dialect | select American/British/Australian/Canadian | `harperDialect` (:94) | `American` | Rebuilds Harper linter (`background:1085`) |
| Debug logging | checkbox | `debugLogging` (:305) | `false` | Records last 200 events (`debugLog.ts`) |
| Mask protected text before AI correction | checkbox | `llmProtectedMasking` (:333) | initialized `true` in `background:1121` but options default object says `false` (`options.tsx:63`) — **inconsistency worth flagging** | Toggles masking vs. safe-edit path in `correctText` (`background:974`) |

Non-setting controls: **Remove all API keys** button (:116), domain allowlist add/remove (`disabledDomains`), custom **dictionary** add/remove, **ignored issues** list + Clear All, **Export/Import/Reset** settings, **Analytics** cards + Clear, a static **Ollama GPU guide** table, and **About**.

### 2. Provider config & relevance matrix
Providers (`types.ts:26-116`): `openai`, `openrouter`, `groq`, `together`, `abacus`, `deepseek`, `ollama`, `custom`. The popup `SettingsPanel` renders: Enable toggle, **AI Provider** select, **API Key** (only if `requiresApiKey`), **Model** select, then an **Advanced** disclosure.

Base URL resolution is centralized in `resolveBaseUrl` (`llmClient.ts:35-43`):
- `provider==='ollama'` → `ollamaV1(ollamaUrl)` — **`ollamaUrl` only matters for Ollama**
- `provider==='custom'` → `customBaseUrl` — **`customBaseUrl` only matters for Custom**
- everything else → the provider's hardcoded `baseUrl`; **both `ollamaUrl` and `customBaseUrl` are inert.**

`keepAlive`/`ollamaKeepAlive` is Ollama-only by construction (`ollamaKeepAliveParam` returns `{}` otherwise, `llmClient.ts:50-57`). API key is forced to literal `'ollama'` for Ollama in `listModels`/`chatCompletion` and the key field is `disabled` for Ollama (`popup.tsx:178`).

| Setting | openai | openrouter | groq | together | abacus | deepseek | ollama | custom |
|---|---|---|---|---|---|---|---|---|
| API key | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | inert (forced 'ollama') | ✓ |
| Model | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (live `/api/tags`) | ✓ |
| `customBaseUrl` | inert | inert | inert | inert | inert | inert | inert | **✓** |
| `ollamaUrl` | inert | inert | inert | inert | inert | inert | **✓** | inert |
| `ollamaKeepAlive` | inert | inert | inert | inert | inert | inert | **✓** | inert |

### 3. Display logic — the CEO's gripe
Conditional rendering in `SettingsPanel`:
- API Key block: `{selectedProvider?.requiresApiKey && …}` (`popup.tsx:168`) — correctly hidden for Ollama.
- **Custom Base URL**: gated `settings.provider === 'custom'` (`popup.tsx:246`) — correct.
- **Ollama Server URL + scan + status + keep-alive + Unload now**: gated `settings.provider === 'ollama'` (`popup.tsx:252`) — correct.

So the *advanced panel itself* IS provider-gated. **However:** when the provider is OpenAI/OpenRouter/Groq/Together/Abacus/DeepSeek, the Advanced toggle (`popup.tsx:239`) still renders and, when opened, the `advanced-panel` is **completely empty** — a disclosure that expands to nothing. That is the most visible defect: a dead "Advanced settings" control for 6 of 8 providers. The options page also shows a large static **"Ollama — Which model for my GPU?"** section (index.html:230) and GPU-unload guidance regardless of provider — irrelevant to all cloud users.

### 4. Popup structure (`popup.tsx`)
Header (brand + Active/Paused status pill, :607) → redundant **second Enable row** (:617, duplicates the pill) → **ScoreSection**: `ScoreRing` SVG (hardcoded indigo `#4F46E5`/amber/red, :41) + heading/subtext + **issue chips** (grammar/clarity/style/ "All clear", :101). Writing score is computed locally from `issueStats` (:599). → **AI card** (read-only: provider name · model, :632) → divider → **SettingsPanel** (enable, provider, key, model, advanced) → footer "Open full settings".

Rebrand notes: ScoreRing colors (`#4F46E5`), chip `#EEF2FF` track, popup logo, and the options logo/`.link`/`📊`/emoji are all old-indigo and need the off-black/off-white + single `#1FA463` treatment.

Key files (absolute): `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\popup\popup.tsx`, `…\src\options\index.html`, `…\src\options\options.tsx`, `…\src\types.ts`, `…\src\background\index.ts`, `…\src\background\llmClient.ts`.

## Appendix B - Settings / provider review
I have everything confirmed. Here is my review.

---

## Settings / Provider-Relevance UX Review

The CEO is right, but the diagnosis needs sharpening. The provider-specific *fields* (Ollama Host, Custom Base URL) are already correctly gated. The real defects are: (1) an **"Advanced settings" disclosure that expands to literally nothing for 6 of 8 providers**, (2) a large **always-on Ollama GPU guide** shown to every cloud user in Options, (3) a duplicated Enable control, and (4) no first-run / local-only story. Below is the ranked list, a provider-aware spec, empty-state guidance, and a quick-wins/structural split.

---

## Problems (ranked)

**P1 — "Advanced settings" expands to an empty box for 6 of 8 providers.** `popup.tsx:239` always renders the Advanced toggle. Its body (`popup.tsx:244-376`) contains only two children, gated `provider === 'custom'` and `provider === 'ollama'`. For openai / openrouter / groq / together / abacus / deepseek the panel renders `<div className="advanced-panel">` with no content. A disclosure that opens to nothing reads as a broken UI and is exactly the "advanced settings that do nothing" the CEO is describing. This is the single most visible defect.

**P2 — The Ollama GPU guide is shown to all users regardless of provider.** Options `index.html:230-287` renders a full "Ollama — Which model for my GPU?" section: prose, a 9-row GPU/VRAM table, gaming/unload guidance, and a benchmark link. For an OpenAI or DeepSeek user this is a large, irrelevant wall about NVIDIA VRAM. It is static HTML in the Options page, so it cannot read `provider` (provider lives in popup `chrome.storage.sync`) without new wiring.

**P3 — Duplicated Enable control.** The header status pill (`popup.tsx:612`, "Active/Paused") and the separate `enable-row` (`popup.tsx:617`, "On/Off") toggle the *same* `settings.enabled`. Immediately below, `SettingsPanel` renders a *third* enable control ("Enable OGrammar" toggle, `popup.tsx:142-156`). Three controls for one boolean, stacked within ~200px. Confusing and wasteful of popup height.

**P4 — `llmProtectedMasking` default inconsistency.** Options default object says `false` (`options.tsx:63`) but the MAP notes background initializes it `true` (`background:1121`). Whichever wins at runtime, the persisted-vs-initialized mismatch means the checkbox can render out of sync with actual behavior. Pick one source of truth.

**P5 — API Key field placeholder logic is dead for Ollama.** `popup.tsx:168` already gates the whole API-key block on `selectedProvider?.requiresApiKey`, and Ollama has `requiresApiKey: false` (`types.ts:105`). So the block never renders for Ollama. Yet inside it, `placeholder={settings.provider === 'ollama' ? 'Not required' : 'sk-…'}` and `disabled={settings.provider === 'ollama'}` (`popup.tsx:176-178`) are unreachable branches. Harmless but dead code that implies a state that cannot happen — remove it to avoid future confusion.

**P6 — "AI Engine" card shows a stale provider/model when AI is effectively unconfigured.** `popup.tsx:632` always shows `selectedProvider?.name || 'OpenAI'} · {settings.model}` (defaults to "OpenAI · gpt-4o-mini"). A brand-new user with no API key sees "AI Engine: OpenAI · gpt-4o-mini" as if AI were active, when in fact every LLM call will fail for lack of a key. There is no "needs key" / "local-only" state.

**P7 — Free vs key providers are only distinguished by an emoji in the dropdown.** `popup.tsx:162` appends `🔑` or `✅ Free` to each option label. Off-brand (the rebrand wants one green accent, not emoji), and it conflates "Free" — Ollama is `✅ Free` because `requiresApiKey:false`, but it requires a *local server*, which is a much bigger ask than a free cloud key. Misleading.

**P8 — Model picker offers no feedback for cloud providers when the key is empty.** For Ollama there is rich status (scanning, "no models found"). For a keyed cloud provider with no key, `loadModels` silently falls back to the static curated list (`popup.tsx:601`), so the Model dropdown looks fully populated and functional even though nothing will work until a key is entered. No "enter your key to load models" affordance.

**P9 — `ollamaUrl`, `customBaseUrl`, `ollamaKeepAlive` persist as live settings for every provider.** Confirmed inert outside their provider in `resolveBaseUrl` (`llmClient.ts:35-43`) and `ollamaKeepAliveParam` (`llmClient.ts:50-57`). They are correctly hidden in the UI, so this is not a display bug — but worth noting they are silently carried in `chrome.storage.sync` for all users. Not user-facing; no action required beyond awareness.

---

## Provider-aware settings spec

Principle: **progressive disclosure — show only what the chosen provider consumes.** An "Advanced" group appears only when it has at least one relevant field; otherwise it is not rendered at all.

Field visibility matrix (✓ = render, — = do not render):

| Field | openai / openrouter / groq / together / abacus / deepseek | ollama | custom |
|---|---|---|---|
| Enable toggle | ✓ (single, see P3) | ✓ | ✓ |
| AI Provider select | ✓ | ✓ | ✓ |
| API Key | ✓ | — | ✓ |
| Model select | ✓ (from curated/live list) | ✓ (live `/api/tags`) | ✓ (live or free-text) |
| **Advanced disclosure** | **— (not rendered)** | ✓ | ✓ |
| Custom Base URL | — | — | ✓ |
| Ollama Server URL + scan + status | — | ✓ | — |
| Ollama keep-alive + Unload now | — | ✓ | — |
| GPU model guide (Options) | — | ✓ | — |

Exact conditional logic:

```
const hasAdvanced =
  settings.provider === 'ollama' || settings.provider === 'custom';

// API key block — already correct, keep:
{selectedProvider?.requiresApiKey && ( /* API Key field */ )}
// (delete the dead provider==='ollama' placeholder/disabled branches, P5)

// Advanced toggle — only render when there is something inside:
{hasAdvanced && (
  <>
    <button className="advanced-toggle" ...>Advanced settings</button>
    {showAdvanced && (
      <div className="advanced-panel">
        {settings.provider === 'custom' && ( /* Custom Base URL */ )}
        {settings.provider === 'ollama' && ( /* Ollama host + status + keep-alive + unload */ )}
      </div>
    )}
  </>
)}
```

This single change (`hasAdvanced` gate at `popup.tsx:239`) kills P1 — the empty disclosure simply disappears for the 6 cloud providers.

For the Options GPU guide (P2): the Options page must learn the current provider. Read `provider` from `chrome.storage.sync` in `options.tsx` init and toggle the section:

```
chrome.storage.sync.get(['provider'], ({ provider }) => {
  document.getElementById('ollamaGuideSection').hidden = provider !== 'ollama';
});
```

Wrap `index.html:230-287` in `<section id="ollamaGuideSection" hidden>` so it is hidden by default and only appears for Ollama users. Re-show/hide on `chrome.storage.onChanged` for `provider`.

Provider dropdown labels (P7): drop the emoji. Show the real requirement as a `field-hint` under the select instead of in the option text — e.g. cloud-key providers: "Needs a free API key"; Ollama: "Runs locally — needs Ollama installed"; custom: "Bring your own OpenAI-compatible endpoint." Reserve the single `#1FA463` accent for the *selected/active* state, not as a per-row "Free" badge.

---

## First-run / empty states

What a brand-new user (no key, default `provider: 'openai'`) sees today: header + duplicate enable rows + a writing score ring + issue chips + an **"AI Engine: OpenAI · gpt-4o-mini"** card that looks active but will fail on the first LLM call, plus a Model dropdown pre-filled from the static list. Nothing tells them an LLM is optional, nor that the local engine (Harper + SymSpell + n-gram) already works with zero setup.

Make local-only mode obviously usable:

1. **Reframe the AI card as a status, not a fixed value (P6).** When `requiresApiKey` and the key is empty, the card should read **"AI Engine: Off — add a key to enable AI suggestions"** with the green accent only on a single "Add key" affordance. When a key is present: "AI Engine: DeepSeek · deepseek-chat." When provider is Ollama and reachable: "AI Engine: Local · {model}."

2. **Lead with the local-only promise.** A one-line banner on first run: "OGrammar checks spelling and grammar locally with no account or key. Add an AI provider below for deeper rewrites and suggestions (optional)." This makes the no-key state a feature, not a broken state.

3. **Gate the Model picker behind the key for cloud providers (P8).** When `requiresApiKey && !apiKey`, replace the populated Model dropdown with a disabled control reading "Enter your API key to load models" — mirroring the honest Ollama "no models found" treatment. Avoids the illusion that a model is selected and working.

4. **Default selection should not imply a cloud commitment.** Consider defaulting new installs to a local-first stance: keep `provider: 'openai'` for the picker but render the empty-key state prominently, OR surface Ollama as the recommended privacy path in the hint. Do not auto-show "OpenAI · gpt-4o-mini" as if configured.

5. **Custom provider empty state.** When `provider === 'custom'` and `customBaseUrl` is empty, the Model picker and any test should prompt "Enter your endpoint base URL in Advanced" rather than silently showing an empty/curated list.

---

## Quick wins vs structural changes

**Quick wins (small, localized edits):**
- **P1:** Gate the Advanced disclosure with `hasAdvanced` (one conditional at `popup.tsx:239`). Highest impact, lowest risk — directly answers the CEO.
- **P3:** Delete the redundant `enable-row` (`popup.tsx:617-627`) and the in-panel "Enable OGrammar" toggle (`popup.tsx:142-156`); keep the header status pill as the single enable control. Removes two of three duplicate toggles.
- **P5:** Remove the dead Ollama placeholder/disabled branches in the API-key input (`popup.tsx:176-178`).
- **P7:** Replace the `🔑` / `✅ Free` emoji in option labels with a single under-select hint string (`popup.tsx:162-165`).
- **P4:** Make `llmProtectedMasking` default consistent — set the same value in `options.tsx:63` and `background:1121` (and document which wins).

**Structural changes (new wiring / data flow):**
- **P2:** Make the Options GPU guide provider-aware — Options must read `provider` from `chrome.storage.sync` and subscribe to `chrome.storage.onChanged`. New code in `options.tsx`, plus an `id`/`hidden` wrapper in `index.html`. Bigger because the Options page currently has no notion of the popup-owned provider state.
- **P6 + P8 + first-run states:** Turn the AI Engine card and Model picker into key-aware status components ("Off / add key", "Enter key to load models", local vs cloud labeling). Requires threading key-presence and reachability state through to the card and dropdown — a modest refactor of the popup's render logic, not just a gate.
- **P9 (optional hygiene):** Stop persisting `ollamaUrl` / `customBaseUrl` / `ollamaKeepAlive` for providers that ignore them, or namespace them per-provider. Not user-facing; defer unless settings export/import cleanliness matters.

Recommended order: ship the five quick wins first (they resolve the CEO's literal complaint and reclaim popup height), then do P2 and the key-aware AI card as the structural follow-up.

Key files (absolute): `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\popup\popup.tsx`, `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\options\index.html`, `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\options\options.tsx`, `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\types.ts`, `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\background\llmClient.ts`.

## Appendix C - Visual / IA review
I now have the full picture of both surfaces. Here is the review.

---

## What reads as bad UI

**Indigo / Inter residue (the rebrand blocker).** Both surfaces are built on the old indigo system and will fight the new identity until ripped out.
- `popup.css:6` imports Inter from Google Fonts; the rebrand spec is Geist. Wrong typeface everywhere.
- `popup.css:12-41` is an entire indigo design system: `--og-primary #4F46E5`, `--og-accent #7C3AED` violet, `--og-primary-light #EEF2FF`, indigo-tinted shadows `rgba(79,70,229,...)`, and a near-black with "slight indigo" (`--og-text-1 #1A1A2E`). None of this is off-black/off-white + one green.
- `popup.tsx:41` hardcodes the score ring color `#4F46E5` (indigo) for the "good" state, with `#EEF2FF` as the track at line 46. Hardcoded in JSX, so a CSS variable swap will not catch it.
- The header logo is a `linear-gradient(135deg, indigo → violet)` circle with a drop shadow (`popup.css:79-86`). A two-color gradient mark directly violates "ONE signal-green accent." The brand wordmark `O<span>Grammar</span>` colors the span indigo (`popup.css:91-93`).
- Options page runs a *different* blue entirely: `--primary #2563eb` (`options.css:8`), system font stack (not Geist), and an `about-section` with a full `linear-gradient(135deg, var(--primary), #1d4ed8)` blue card (`options.css:578-581`). So the two surfaces are not even the same brand color as each other today.
- Emoji as UI: `🔑` / `✅ Free` inside the provider `<option>` (`popup.tsx:162`), `📊` (`index.html:247`), `❤️` in the footer (`index.html:378`). Emoji in functional controls reads amateur and renders inconsistently across platforms. Replace with the green dot/check or plain text.

**Hierarchy and redundancy.**
- The popup shows the enable control **three times**: the header `status-pill` (`popup.tsx:612`), a dedicated "Enable OGrammar" row right below it (`popup.tsx:617`), and a third toggle inside SettingsPanel (`popup.tsx:143`). Three controls for one boolean, stacked within ~200px of each other. This is the single most confusing thing in the popup.
- The enable-row at `popup.tsx:617` uses fully inlined styles (padding, border, hex `#f0f0f0`) instead of a class, so it is invisible to the theme system and will be missed in the rebrand.
- "Issues detected" / "Needs some work" headings plus a number ring plus chips plus a sentence ("N issues detected — click underlined text to fix") restate the same fact three ways in one 130px band.

**Label quality and weak affordances.**
- The dead **Advanced settings** disclosure: for 6 of 8 providers the panel (`popup.tsx:244-377`) renders to nothing. A control that expands to empty is the clearest "unfinished" signal in the product. The dashed-border styling (`popup.css:293`) already reads as a placeholder/dropzone, compounding it.
- The provider `<select>` mixes a human name with an emoji and the word "Free" as if it were part of the model name (`popup.tsx:162`). Relevance should be a separate badge, not concatenated text.
- Options `setting-label` is only `font-weight: 500` (`options.css:104`) while popup `field-label` is uppercase 11px 700 tracked (`popup.css:210-214`). Same product, two different label languages.

**Inconsistent components.** Toggles are defined twice (`.toggle-track` in popup vs `.toggle-slider` in options) with different widths (42 vs 44px) and offsets. Inputs, buttons (`.icon-btn` vs `.btn-primary/secondary/danger`), focus rings, and radii are all forked between the two files. There is no shared component layer, so every fix has to be made twice and will drift again.

## Popup specifically

The score band is **noisy and low-value**. The number itself is a fabricated heuristic (`writingScore = 100 - grammar*12 - style*6 - clarity*4`, `popup.tsx:599`) presented with Grammarly-grade authority (64px ring, 800-weight number, animated sweep). It is three competing readouts (ring + headline + chips + sentence) for one signal.

Cut to a single clear state:
- Keep **one** primary indicator. Either the ring **or** the chips, not both. The chips ("2 grammar, 1 clarity") are more actionable and honest than a synthetic 0-100 score; I would lead with chips and a one-line status, and drop the ring (or shrink it to a small inline glyph).
- Collapse the headline + subtext into one line: "All clear" or "3 issues — click underlined text to fix."
- The **AI Engine card** (`popup.tsx:632`) is read-only and just echoes "Provider · model" — the same thing the user just set two rows down in the provider/model selects. It is redundant in the popup. Either remove it or merge the provider/model selectors into it so it becomes the actual control, not a duplicate label.
- Remove two of the three enable controls. Keep the header status pill as the single source of truth (it is the most discoverable), delete the dedicated enable-row and the SettingsPanel toggle.

Net: header (brand + one status pill) → one status line + chips → provider/model (the real controls) → advanced (only when it has contents) → footer. That removes roughly a third of the vertical noise.

## Options page IA

It is one long undifferentiated scroll of 10 equal-weight card sections, ordered by no clear logic (API Keys before Site Settings before Dictionary before a giant GPU table before Debug). Problems:

- **API Keys section holds no key field** — it is a paragraph saying "keys are in the popup" plus a destructive "Remove all API keys" button (`index.html:104-121`). A whole top-level section whose only function is a delete button, placed second. Demote it into a "Privacy & Data" group next to Reset/Export.
- The **Ollama GPU table** (`index.html:230-287`) is a large, opinionated wall of prose + an 9-row table + 3 explainer paragraphs, shown to **every** user including the ~6 of 8 who never touch Ollama. It dominates the page by area. This belongs behind a disclosure that only appears when provider === ollama, or linked out to the benchmark doc, not inlined for cloud users.
- The masking toggle is a "Debug & Tuning" item (`index.html:289-345`) but it materially changes correction behavior and safety — it is not debug. And per the map there is a default inconsistency: background initializes it `true` (`background:1121`) while options defaults it `false` (`options.tsx:63`). Flag and reconcile.

Recommended structure — group into **4 sections with a left rail / tabs**, not one scroll:
1. **Writing** — autocomplete, autocorrect, both delays, dialect, masking (relabeled "AI correction safety", moved out of Debug).
2. **Sites & Dictionary** — domain allowlist, custom dictionary, ignored suggestions.
3. **Privacy & Data** — remove API keys, export/import/reset, analytics, debug logging + copy log.
4. **Help & About** — Ollama GPU guidance (collapsed), version, links.

At this page length, sticky-tabbed sections beat one 10-card scroll. The current "every section is an identical white card with a shadow" gives zero hierarchy — nothing tells the eye what matters.

## Accessibility

- **Contrast.** `field-label` is `--og-text-3 #A0A3B1` on white (`popup.css:212`) ≈ 2.4:1 — fails WCAG AA for text. Placeholder/hint text `--og-text-3` and the inline `#aeaeb2` "stored locally" note (`popup.tsx:170`) and `#9ca3af` empty-state (`options.css:630`) all fail. The green identity must verify `#1FA463` on white too: it is ~3.0:1, which **fails AA for normal text** — usable for large text / non-text UI (borders, the ring, dots) but not for body labels or links. Use a darkened green (around `#17794c`) for any green *text*, and reserve `#1FA463` for fills, the ring, and focus rings.
- **Toggles have no real control semantics.** Both toggles hide the checkbox with `display: none` (`popup.css:271`, `options.css:195`) and style a sibling `<span>`. `display:none` removes it from the accessibility tree and tab order in several engines; use `opacity:0; position:absolute` (visually hidden) instead so it stays focusable, and add a visible `:focus-visible` ring on the track. None of the toggle tracks have a focus style at all.
- **Header status pill** toggles enable/disable but its state lives only in color + the word Active/Paused; fine, but it needs `aria-pressed` and the same pill in the enable-row is a near-duplicate `title` ("Click to turn off" vs "Click to pause") for the same action — confusing for screen-reader users.
- **Icon-only buttons** (eye toggle, `↻` scan, Test, Retry, Unload now) rely on `title` only; `title` is not reliably announced. Add `aria-label`.
- **Info bubble** (`index.html:315`) is `tabindex="0"` with `role="tooltip"` shown on `:hover/:focus-within` only — keyboard users can focus the trigger but the tooltip has no `aria-describedby` linkage, and there is no way to dismiss on Escape. The `?` trigger color is the failing-contrast blue.
- **Select dropdown arrow** is a hardcoded gray SVG data-URI (`popup.css:230`) — fine, but it will not invert in dark mode; neither surface has a dark theme despite "off-black/off-white" implying a dark-capable system.

## Concrete fixes, ranked

Green identity = off-black `#16181C`-ish text, off-white `#FAFAF8` surfaces, one accent `#1FA463` (fills/ring/focus only), Geist.

**P0**
1. Kill the dead Advanced disclosure: render the toggle only when `settings.provider === 'custom' || 'ollama'` (the only two cases with content). Gate `popup.tsx:239` on the same condition as its body.
2. Remove the duplicate enable controls. Keep the header pill; delete the inline enable-row (`popup.tsx:617-627`) and the SettingsPanel toggle (`popup.tsx:143-156`). One enable, one place.
3. Rip out indigo + Inter. New token set in `popup.css:12-41` (off-black/off-white + `#1FA463`), swap the Google Fonts import to Geist, and replace the hardcoded `#4F46E5`/`#EEF2FF` in `ScoreRing` (`popup.tsx:41,46`) with green/neutral. Unify `options.css` to the same tokens (kill `#2563eb` and the blue about-gradient at `:578`).
4. Fix label/link contrast: darken green for text to ~`#17794c`; raise `--og-text-3` used on labels to at least `#6b7280`-class (AA). Verify the new green on white before shipping.

**P1**
5. Replace the green gradient/violet logo with a single flat green mark; remove the indigo wordmark span color.
6. De-noise the score band: one status line + chips, drop or shrink the ring, remove the redundant sentence. Decide whether the synthetic score stays at all.
7. Remove or repurpose the read-only AI Engine card (`popup.tsx:632`) — merge into the provider/model controls or cut.
8. Restructure options into 4 grouped/tabbed sections; move the Ollama GPU table behind an Ollama-only disclosure; move masking out of "Debug" into a "Writing / AI safety" group and reconcile its default (`true` vs `false`).
9. Strip emoji from `<option>` labels, the `📊`, and footer `❤️`; use the green dot or plain text badges.

**P2**
10. Accessibility pass: visually-hidden (not `display:none`) checkboxes with `:focus-visible` rings on all toggles; `aria-label` on every icon-only button; `aria-pressed` on the status pill; `aria-describedby` + Escape-to-dismiss on the info bubble.
11. Extract a shared component/token layer so popup and options stop forking toggles, inputs, buttons, and focus styles.
12. Add a real dark theme now that the palette is off-black/off-white (the data-URI select arrow and all hardcoded hexes need to be tokenized for this to work).

Key files (absolute): `\\wsl.localhost\ubuntu\home\zazzn\opengrammar\opengrammar\extension\src\popup\popup.tsx`, `…\src\popup\popup.css`, `…\src\options\index.html`, `…\src\options\options.css`.
