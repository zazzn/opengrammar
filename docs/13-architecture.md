# Architecture

OGrammar is a **browser extension** built on one grammar/LLM engine. This doc orients a
developer to how everything fits together. For build/run, see
[14-development.md](14-development.md).

## Repository layout

```
/                         root: README, ROADMAP, CONTRIBUTING, LICENSE, NOTICE
├─ opengrammar/
│  ├─ extension/          browser extension (TypeScript + React + Vite)
│  │  └─ src/
│  │     ├─ background/   service worker: Harper engine, LLM client, issue policy, context ranker
│  │     ├─ content/      content scripts: detection, highlighting, apply, autocomplete, autocorrect
│  │     ├─ options/      options UI (settings)
│  │     ├─ popup/        toolbar popup
│  │     ├─ shared/       apiKeyStore, protectedText, ollama models
│  │     └─ types.ts      shared data model (Issue, Settings, …)
└─ docs/                  documentation (this folder)
```

## The two-tier engine

1. **Harper (local, instant)** — on-device spelling/grammar/punctuation/style. No network.
2. **LLM tier (optional, BYOK)** — context/sentence review via the user's own provider key.
   Results are **merged with Harper and de-duplicated (Harper wins on overlap)**.

The LLM correction logic lives in
`opengrammar/extension/src/background/llmClient.ts` (+ `issuePolicy.ts`, `harperEngine.ts`,
`shared/protectedText.ts`) — the system prompt, structured-correction normaliser, diff
fallback, protected-text masking, and the tone-rewrite engine.

## Data model

The canonical issue shape (extension `src/types.ts`):

`Issue { type, original, suggestion, reason, offset, length, confidence?, route?, source? }`
where `route ∈ {quick-fix, sentence-review, suppress}`. **`route === 'quick-fix'` is the
high-confidence class** (capitalization, punctuation, small-edit spelling) — used to gate
autocorrect and one-click fixes. `issuePolicy.ts` does this routing.

## Data flow

`input`/MutationObserver → debounce → background analyze (Harper + optional LLM, merged)
→ `content/highlighter.ts` underlines → user clicks → `content/editorAdapter.ts:applyFix()`
edits the field (execCommand-based; works in inputs, textareas, contenteditable).
- **Autocorrect:** `content/autocorrect.ts` — auto-applies `route==='quick-fix'` issues on
  freshly-typed text (caret at end), with exact-text revert-learning persisted in
  `chrome.storage.sync['autocorrectRejected']`. Called from `handleGrammarSuccess`.
- **Settings:** `chrome.storage.sync`; UI in `src/options/`; content reads via
  `loadUserSettings()` + an `onChanged` listener.
