> **Fork notice.** This is a **modified fork** of
> [OpenGrammar](https://github.com/swadhinbiswas/opengrammar) by Swadhin
> Biswas, distributed under the **Apache License 2.0**. It contains
> substantial changes (a new Harper-based inline engine, a local n-gram
> context re-ranker, re-architected LLM correction, encrypted API-key
> storage, additional providers, and a proactive sentence-review flow — see
> [`NOTICE`](NOTICE) for the full list
> of modifications). It is **not affiliated with or endorsed by the original
> author**. The original `LICENSE` and `NOTICE` are retained as required by
> Apache-2.0.

<div align="center">
  <img src="logo.svg" alt="OGrammar Logo" width="120" height="120">

  # 🪶 OGrammar

  **Your privacy-first, open-source writing assistant for the browser.**
  *A free, local-first, bring-your-own-key alternative to premium grammar tools.*

  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
</div>

---

## What it is

A Grammarly-style **browser extension** for Chrome / Brave / Edge. Inline underlines,
proactive sentence review, autocomplete, tone rewriting, writing stats, and opt-in
autocorrect — in Gmail, Google Docs, Notion, Reddit, and any web editor.

→ **[Install](docs/04-browser-extension-setup.md)** · source in [`opengrammar/extension/`](opengrammar/extension/)

---

## How it works

- **Harper (local, instant):** the [Harper](https://writewithharper.com) engine runs
  100% on-device — spelling, grammar, punctuation, capitalization, style — no network,
  no account.
- **LLM context tier (optional, BYOK):** add your own key (OpenAI, DeepSeek, Groq,
  OpenRouter, Together, or local Ollama) for context/sentence review. The model's
  findings are merged with Harper's and de-duplicated (Harper wins on overlap).
- **Privacy:** local-first, bring-your-own-key, no text telemetry. Keys are encrypted at
  rest in `chrome.storage`.

---

## Quick start

Build `opengrammar/extension`, then in `chrome://extensions` enable
Developer Mode → **Load unpacked** → select the built extension. Open its options to add
your AI key. See [docs/04-browser-extension-setup.md](docs/04-browser-extension-setup.md).

---

## Documentation

Start at **[docs/01-quick-start.md](docs/01-quick-start.md)**, or the full
index at **[docs/00-index.md](docs/00-index.md)**.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) and [ROADMAP.md](./ROADMAP.md).

## License

Apache 2.0 — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). OGrammar is a modified fork
of [OpenGrammar](https://github.com/swadhinbiswas/opengrammar).
