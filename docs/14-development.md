# Development Guide

How to build, run, and test both products, and where to pick up. Pair this with
[13-architecture.md](13-architecture.md) (how it fits together) and
[../ROADMAP.md](../ROADMAP.md) (what's left to build).

## Prerequisites

- **Extension / backend:** Node 18+ (or **Bun**, the project's preferred runtime/PM).
- **Desktop app:** Rust (stable) + Cargo, on **Windows** (it uses Win32 + UI Automation).
- An AI provider key (OpenAI / DeepSeek / Groq / OpenRouter / Together) or local Ollama —
  only needed to exercise the LLM tier.

## Product 1 — Browser extension

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

Optional backend: `cd opengrammar/backend && bun install && bun dev`.

## Product 2 — Desktop app (Windows)

```powershell
cd desktop
cargo build --release -p ograms-hotkey
.\target\release\ograms-hotkey.exe          # --quiet skips the startup popup
```
Configure provider/model/key + dialect + autocorrect + per-app exclusions from the tray's
**Settings** window. For dev you can supply the key via the `OG_LLM_KEY` env var instead of
the DPAPI store.

Tests:
```powershell
cargo test -p ograms-engine -p ograms-hotkey     # unit tests (autocorrect, LLM core, etc.)
# Engine CLI + parity harness (see desktop/ograms-engine/README.md):
cargo run -p ograms-engine --release -- --text "I recieved teh package."
node ograms-engine/scripts/parity-check.mjs --spell-engine harper
```

Key files: `ograms-engine/src/llm.rs` (LLM core + rewrite), `ograms-hotkey/src/`
(`windows_app.rs` monitor, `overlay.rs`, `suggestion.rs`, `autocorrect.rs`, `pill.rs`,
`tray.rs`, `settings.rs`, `config.rs`).

## Conventions

- **Parity:** the extension's LLM logic (`background/llmClient.ts`, `issuePolicy.ts`,
  `shared/protectedText.ts`) and the desktop engine (`ograms-engine/src/llm.rs`) must stay
  in sync — change both when you touch the prompt, routing, or protected-text rules.
- **Privacy:** never log user text or commit keys. Keys live in `chrome.storage` (extension)
  / DPAPI `%APPDATA%\OGrammar` (desktop). Desktop `target/` and any `apikey.bin`/`config.json`
  are git-ignored.
- **De-confliction:** keep browsers in the desktop exclusion list.

## Picking up where we left off

1. Read [30-products-overview.md](30-products-overview.md) and [13-architecture.md](13-architecture.md).
2. Check **[../ROADMAP.md](../ROADMAP.md)** — the "in progress / planned" items per product are
   the live work queue.
3. Reference notes: [24 — false-positive audit](24-og-rewrite-false-positive-audit.md),
   [25 — LLM model benchmark](25-local-llm-model-benchmark.md),
   [29 — OS-wide research](29-os-wide-grammar-checking-research.md).
