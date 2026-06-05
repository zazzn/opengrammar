> **Fork notice.** This is a **modified fork** of
> [OpenGrammar](https://github.com/swadhinbiswas/opengrammar) by Swadhin
> Biswas, distributed under the **Apache License 2.0**. It contains
> substantial changes (a new Harper-based inline engine, a local n-gram
> context re-ranker, re-architected LLM correction, encrypted API-key
> storage, additional providers, a proactive sentence-review flow, and an
> all-new **OS-wide desktop app** — see [`NOTICE`](NOTICE) for the full list
> of modifications). It is **not affiliated with or endorsed by the original
> author**. The original `LICENSE` and `NOTICE` are retained as required by
> Apache-2.0.

<div align="center">
  <img src="logo.svg" alt="OGrammar Logo" width="120" height="120">

  # 🪶 OGrammar

  **Your privacy-first, open-source writing assistant — now everywhere you type.**
  *A free, local-first, bring-your-own-key alternative to premium grammar tools.*

  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
</div>

---

## Two products, one engine

OGrammar now ships as **two distinct products** that share the same Harper + LLM
engine but run in completely different places:

### 🧩 1. Browser Extension  — *writing in the browser*
A Grammarly-style assistant for Chrome / Brave / Edge. Inline underlines, proactive
sentence review, autocomplete, tone rewriting, writing stats, and opt-in autocorrect —
in Gmail, Google Docs, Notion, Reddit, and any web editor.
→ **[Install](docs/04-browser-extension-setup.md)** · source in [`opengrammar/extension/`](opengrammar/extension/)

### 🖥️ 2. Desktop App (Windows)  — *writing everywhere else*
A native (Rust, no Electron) **OS-wide** proofreader that works in **any** focused text
field — Notepad, Word, Slack desktop, chat boxes, IDE fields — via UI Automation. True
OS overlay underlines, click-to-fix cards, opt-in autocorrect, and an LLM **rewrite pill**
(Polish / Formalize / Casual, with preview before apply).
→ **[Overview](docs/31-desktop-app.md)** · **[Build](desktop/README.md)** · source in [`desktop/`](desktop/)

> 📖 **[Full two-product overview →](docs/30-products-overview.md)**

The two are **de-conflicted**: the desktop app excludes browsers by default, so the
extension owns the browser and the desktop app owns everything else. Run both for
end-to-end coverage.

---

## What they share

- **Harper (local, instant):** the [Harper](https://writewithharper.com) engine runs
  100% on-device — spelling, grammar, punctuation, capitalization, style — no network,
  no account.
- **LLM context tier (optional, BYOK):** add your own key (OpenAI, DeepSeek, Groq,
  OpenRouter, Together, or local Ollama) for context/sentence review. The model's
  findings are merged with Harper's and de-duplicated (Harper wins on overlap).
- **Parity:** the desktop's Rust `ograms-engine` is a direct port of the extension's LLM
  correction core, so the prompt, normaliser, diff fallback, and protected-text masking
  stay in sync across both.
- **Privacy:** local-first, bring-your-own-key, no text telemetry. Keys are encrypted at
  rest (extension: `chrome.storage`; desktop: Windows DPAPI in `%APPDATA%\OGrammar`).

---

## Quick start

**Extension:** build `opengrammar/extension`, then in `chrome://extensions` enable
Developer Mode → **Load unpacked** → select the built extension. Open its options to add
your AI key. See [docs/04-browser-extension-setup.md](docs/04-browser-extension-setup.md).

**Desktop (Windows):**
```powershell
cd desktop
cargo build --release -p ograms-hotkey
.\target\release\ograms-hotkey.exe
```
Then open **Settings** from the tray icon to set your dialect, AI provider/model, and key.
See [desktop/README.md](desktop/README.md).

---

## Documentation

Start at **[docs/30-products-overview.md](docs/30-products-overview.md)**, or the full
index at **[docs/00-index.md](docs/00-index.md)**.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [ROADMAP.md](./ROADMAP.md).

## License

Apache 2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). OGrammar is a modified fork
of [OpenGrammar](https://github.com/swadhinbiswas/opengrammar).
