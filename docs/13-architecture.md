# Architecture

OGrammar is **two products sharing one grammar/LLM engine**. This doc orients a developer
to how everything fits together. For the product-level "what", see
[30-products-overview.md](30-products-overview.md); for build/run, see
[14-development.md](14-development.md).

## Repository layout

```
/                         root: README, ROADMAP, CONTRIBUTING, LICENSE, NOTICE
├─ opengrammar/
│  ├─ extension/          PRODUCT 1 — browser extension (TypeScript + React + Vite)
│  │  └─ src/
│  │     ├─ background/   service worker: Harper engine, LLM client, issue policy, context ranker
│  │     ├─ content/      content scripts: detection, highlighting, apply, autocomplete, autocorrect
│  │     ├─ options/      options UI (settings)
│  │     ├─ popup/        toolbar popup
│  │     ├─ shared/       apiKeyStore, protectedText, ollama models
│  │     └─ types.ts      shared data model (Issue, Settings, …)
│  └─ backend/            optional self-hosted Hono edge API (LLM routing)
├─ desktop/               PRODUCT 2 — Windows desktop app (Rust workspace)
│  ├─ ograms-engine/      grammar + LLM engine (library + CLI)
│  └─ ograms-hotkey/      the Windows app (monitor, overlay, tray, settings, …)
└─ docs/                  documentation (this folder)
```

## The shared two-tier engine

Both products run the same model:

1. **Harper (local, instant)** — on-device spelling/grammar/punctuation/style. No network.
2. **LLM tier (optional, BYOK)** — context/sentence review via the user's own provider key.
   Results are **merged with Harper and de-duplicated (Harper wins on overlap)**.

The **LLM correction logic is kept at parity** across products:
- Extension: `opengrammar/extension/src/background/llmClient.ts` (+ `issuePolicy.ts`, `harperEngine.ts`, `shared/protectedText.ts`).
- Desktop: `desktop/ograms-engine/src/llm.rs` is a Rust port of that logic — same system prompt, structured-correction normaliser, diff fallback, protected-text masking, and the tone-rewrite engine (`RewriteTone` / `llm_rewrite`).

> **Parity rule:** when you change the prompt, normaliser, routing, or protected-text rules
> in one product, mirror it in the other.

## Data model

The canonical issue shape (extension `src/types.ts`; desktop mirrors it in the engine):

`Issue { type, original, suggestion, reason, offset, length, confidence?, route?, source? }`
where `route ∈ {quick-fix, sentence-review, suppress}`. **`route === 'quick-fix'` is the
high-confidence class** (capitalization, punctuation, small-edit spelling) — used to gate
autocorrect and one-click fixes. `issuePolicy.ts` (extension) does this routing.

## Product 1 — Extension (data flow)

`input`/MutationObserver → debounce → background analyze (Harper + optional LLM, merged)
→ `content/highlighter.ts` underlines → user clicks → `content/editorAdapter.ts:applyFix()`
edits the field (execCommand-based; works in inputs, textareas, contenteditable).
- **Autocorrect:** `content/autocorrect.ts` — auto-applies `route==='quick-fix'` issues on
  freshly-typed text (caret at end), with exact-text revert-learning persisted in
  `chrome.storage.sync['autocorrectRejected']`. Called from `handleGrammarSuccess`.
- **Settings:** `chrome.storage.sync`; UI in `src/options/`; content reads via
  `loadUserSettings()` + an `onChanged` listener.

## Product 2 — Desktop (data flow)

`ograms-hotkey` runs a UI Automation **monitor** (`src/windows_app.rs`): on focus change /
debounced edits it reads the focused element's text + bounding rects, lints with Harper
(`ograms-engine`), schedules the async LLM tier on a worker thread, and posts results back
to the UI thread.
- **Overlay** (`src/overlay.rs`) — one transparent, click-through layered window draws the
  underlines (red Harper / blue-dotted LLM); shifts with window moves.
- **Card** (`src/suggestion.rs`) — click-to-fix popup (kicker + reason + candidates).
- **Autocorrect** (`src/autocorrect.rs`) — same model as the extension; persistent rejection
  ledger in `%APPDATA%\OGrammar\autocorrect_exceptions.json`.
- **Rewrite pill** (`src/pill.rs`) — Polish/Formalize/Casual → preview → Apply/Cancel.
- **Tray** (`src/tray.rs`), **settings** (`src/settings.rs`, pure Win32), **config + DPAPI key**
  (`src/config.rs`, `%APPDATA%\OGrammar`).
- Per-Monitor-V2 DPI so UIA rects and the overlay share one physical-pixel space.

## De-confliction

The desktop app **excludes browsers by default** (`config.rs` exclusion list) so the two
products never both check the same field. Add any app to the exclusion list in Settings.
