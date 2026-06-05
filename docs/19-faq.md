# Frequently Asked Questions

Common questions about OGrammar.

---

## General

### What is OGrammar?

OGrammar is a free, open-source, privacy-first writing assistant. It ships as **two
products** that share one engine:

- a **browser extension** for Chromium browsers (Chrome / Brave / Edge), and
- a **Windows desktop app** that works OS-wide in any text field.

It's a local-first, bring-your-own-key alternative to premium grammar tools.

### Is it really free?

Yes — 100% free and open-source (Apache 2.0). The local **Harper** engine works with no
key and no network. AI features are bring-your-own-key (pay only your provider's usage),
or fully free and offline with local Ollama.

### How is it different from Grammarly?

| | Grammarly | OGrammar |
|---|---|---|
| **Cost** | Paid premium | Free |
| **Privacy** | Sends text to its servers | Local-first; no OGrammar backend |
| **Open source** | No | Yes (Apache 2.0) |
| **Offline** | Limited | Full (Harper local engine) |
| **AI** | Grammarly's only | Your choice of provider, or local Ollama |
| **Coverage** | Browser + apps | Browser extension **and** OS-wide Windows app |

### What browsers does the extension support?

Chromium browsers — Chrome (88+), Brave (1.20+), Edge (88+). Other Chromium browsers
(Opera, Vivaldi) should work via "Load unpacked" but are untested. **Firefox/Safari**
ports are on the [roadmap](../ROADMAP.md).

### Does OGrammar work outside the browser?

Yes — that's the **desktop app**. On Windows it checks native apps (Notepad, Word, Slack
desktop, chat boxes, IDE fields) via UI Automation. It excludes browsers by default, so
the extension owns the browser and the desktop app owns everything else. See
[31-desktop-app.md](31-desktop-app.md). macOS/Linux are not built yet.

---

## Installation & setup

### How do I install it?

- **Extension:** build it and load `dist/` unpacked — see
  [04-browser-extension-setup.md](04-browser-extension-setup.md).
- **Desktop:** build the Rust app and run it — see [31-desktop-app.md](31-desktop-app.md).

### Do I need to deploy a backend?

**No.** There is no backend. The extension (and desktop app) call your chosen AI provider
directly with your own key, or talk to your local Ollama server. Three ways to run:

1. **On-device only** — Harper grammar/spelling/punctuation, no key, offline.
2. **Bring your own key** — add a Groq/OpenAI/etc. key for the LLM tier.
3. **Local LLM (Ollama)** — free, offline AI.

### How long does setup take?

About 5–10 minutes for the extension. Add ~15–30 minutes if you set up local Ollama.

---

## Features & usage

### What does it check?

A **two-tier engine**:

- **Harper (local):** spelling, grammar, punctuation, capitalization, and style —
  on-device, no key.
- **LLM tier (optional, BYOK):** context/sentence-level review and tone rewriting.

LLM findings are merged with Harper's and de-duplicated (Harper wins on overlap). There's
no built-in rule file — Harper replaced the old rule-based engine. See
[GRAMMAR_RULES.md](../GRAMMAR_RULES.md).

### Does it work offline?

Yes. Harper runs fully offline. Cloud AI providers need internet, but local Ollama gives
you offline AI too.

### What websites does the extension work on?

Most sites with editable text: Gmail, Google Docs, Notion, Reddit, X, LinkedIn, and
generic text boxes. Some sites with custom/canvas inputs may not be supported. You can
disable specific sites in Options → Site settings.

### Can I use it on mobile?

No — OGrammar targets **desktop**. Mobile browser extensions are too limited.

### Can I add custom words?

Yes — Options → Custom dictionary (or **Add to dictionary** from any suggestion card).

---

## Privacy & security

### Is my data safe?

- **Harper checking:** 100% local; nothing leaves your machine.
- **LLM tier:** your text goes **directly** to the provider you chose — there is no
  OGrammar intermediary server, no database, and no account.

### Do you store my API keys?

No. Keys are stored locally and encrypted at rest — `chrome.storage` for the extension,
Windows DPAPI (`%APPDATA%\OGrammar`) for the desktop app. They're only used to
authenticate with your provider.

### Can I run everything locally?

Yes: Harper for grammar + Ollama for the LLM tier = 100% offline, 100% private.

### Is the code auditable?

Yes — it's open-source under Apache 2.0.

---

## AI providers

### Which provider should I use?

- **Free & fast:** Groq.
- **Best quality:** OpenAI.
- **Cheapest capable:** DeepSeek.
- **Most privacy:** Ollama (local).
- **Most variety:** OpenRouter.

See [07-ai-providers.md](07-ai-providers.md) for setup and current model picks.

### Do I need an API key?

Not for Harper checking. For the LLM tier, yes — or run Ollama locally (no key).

### Can I switch providers?

Anytime — change the provider/model (and key) in Options (extension) or Settings
(desktop).

---

## Troubleshooting

### Why isn't it working?

Usual suspects: extension disabled, site disabled, or a missing/invalid API key (for the
LLM tier only). See [18-troubleshooting.md](18-troubleshooting.md).

### Why are there false positives?

Usually out-of-dictionary names, proper nouns, or jargon. Add them to your custom
dictionary. Residual FP work is tracked in the
[false-positive audit](24-og-rewrite-false-positive-audit.md).

### How do I report a bug?

Open a [GitHub issue](https://github.com/swadhinbiswas/opengrammar/issues) with a
description, repro steps, expected behavior, and any console errors.

---

## Contributing

### How can I help?

Report bugs, suggest features, improve docs, or contribute code. See
[CONTRIBUTING.md](../CONTRIBUTING.md) and the [roadmap](../ROADMAP.md).

### How do I add grammar rules?

See [GRAMMAR_RULES.md](../GRAMMAR_RULES.md). Grammar/spelling is handled by Harper plus the
LLM tier; the extension's logic lives in `opengrammar/extension/src/background/`
(`harperEngine.ts`, `issuePolicy.ts`, `llmClient.ts`). Mirror LLM prompt/routing changes
in the desktop engine (`desktop/ograms-engine/src/llm.rs`) to keep parity.

---

## Technical

### What's the tech stack?

- **Extension:** React + TypeScript + Vite, Manifest V3, Harper (WASM); calls AI providers
  directly via OpenAI-compatible APIs.
- **Desktop:** Rust (Win32 + UI Automation), sharing the Harper + LLM logic with the
  extension (`ograms-engine` is a Rust port of the extension's LLM core).

See [13-architecture.md](13-architecture.md).

### Is there a hosted API?

No. OGrammar is a browser extension and a Windows desktop app — there's no hosted HTTP
API. The desktop `ograms-engine` Rust crate does expose a CLI, and the extension's modules
are reusable in the codebase.

### What's the roadmap?

See [ROADMAP.md](../ROADMAP.md). In short: the shared engine, extension, and Windows
desktop app are shipping; planned work includes Firefox/Safari ports, deeper desktop
capture for Electron apps, selection-scoped rewrite, and packaging/installers.

---

## Cost

### Is there a premium version?

No premium tier, no subscriptions, no hidden costs. Your only spend is your own AI
provider's usage (zero if you use Harper-only or local Ollama).

### Will it stay free?

Yes — Apache 2.0, community-driven, no monetization plans.

---

## More questions?

- Docs index: [00-index.md](00-index.md)
- [GitHub Discussions](https://github.com/swadhinbiswas/opengrammar/discussions)
- [GitHub Issues](https://github.com/swadhinbiswas/opengrammar/issues)
