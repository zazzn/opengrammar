# Development Guide

How to build, run, and test the extension, and where to pick up. Pair this with
[13-architecture.md](13-architecture.md) (how it fits together) and
[../ROADMAP.md](../ROADMAP.md) (what's left to build).

## Prerequisites

- **Extension:** Node 18+ (or **Bun**, the project's preferred runtime/PM).
- An AI provider key (OpenAI / DeepSeek / Groq / OpenRouter / Together) or local Ollama —
  only needed to exercise the LLM tier.

## Browser extension

```bash
cd opengrammar/extension
bun install
bun run dev          # watch build
bun run build        # production build → dist/
bun x tsc --noEmit   # typecheck
```
Load it: `chrome://extensions` → Developer Mode → **Load unpacked** → select the build
(`dist/`). Open the extension's **Options** to set provider/key and toggle features
(including **Autocorrect**).

Key files (see [13-architecture.md](13-architecture.md) for the map):
`src/content/index.ts` (flow), `src/content/editorAdapter.ts` (apply), `src/content/autocorrect.ts`,
`src/content/highlighter.ts`, `src/background/{harperEngine,llmClient,issuePolicy}.ts`,
`src/options/`, `src/types.ts`.

The extension is bring-your-own-key and calls the selected LLM provider directly —
there is no backend service to run.

## Conventions

- **Privacy:** never log user text or commit keys. Keys live in `chrome.storage`.

## Picking up where we left off

1. Read [13-architecture.md](13-architecture.md).
2. Check **[../ROADMAP.md](../ROADMAP.md)** — the "in progress / planned" items are
   the live work queue.
3. Reference notes: [24 — false-positive audit](24-og-rewrite-false-positive-audit.md),
   [25 — LLM model benchmark](25-local-llm-model-benchmark.md).
