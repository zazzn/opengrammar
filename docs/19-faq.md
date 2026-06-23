# Frequently Asked Questions

Common questions about OGrammar.

---

## General

### What is OGrammar?

OGrammar is a free, open-source, privacy-first writing assistant. It's a **browser
extension** for Chromium browsers (Chrome / Brave / Edge), and a local-first,
bring-your-own-key alternative to premium grammar tools.

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

### What browsers does the extension support?

Chromium browsers — Chrome (88+), Brave (1.20+), Edge (88+). Other Chromium browsers
(Opera, Vivaldi) should work via "Load unpacked" but are untested. **Firefox/Safari**
ports are on the [roadmap](../ROADMAP.md).

---

## Installation & setup

### How do I install it?

Build the extension and load `dist/` unpacked — see
[04-browser-extension-setup.md](04-browser-extension-setup.md).

### Do I need to deploy a backend?

**No.** There is no backend. The extension calls your chosen AI provider
directly with your own key, or talks to your local Ollama server. Three ways to run:

1. **On-device only** — Harper grammar/spelling/punctuation, no key, offline.
2. **Bring your own key** — add a Groq/OpenAI/etc. key for the LLM tier.
3. **Local LLM (Ollama)** — free, offline AI.

### How long does setup take?

About 5–10 minutes. Add ~15–30 minutes if you set up local Ollama.

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

No — OGrammar targets **Chromium browsers on computers**. Mobile browser extensions are
too limited.

### Can I add custom words?

Yes — Options → Custom dictionary (or **Add to dictionary** from any suggestion card).

---

## Privacy & security

### Is my data safe?

- **Harper checking:** 100% local; nothing leaves your machine.
- **LLM tier:** your text goes **directly** to the provider you chose — there is no
  OGrammar intermediary server, no database, and no account.

### Do you store my API keys?

No. Keys are stored locally and encrypted at rest in `chrome.storage`. They're only used
to authenticate with your provider.

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

Anytime — change the provider/model (and key) in Options.

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
(`harperEngine.ts`, `issuePolicy.ts`, `llmClient.ts`).

---

## Technical

### What's the tech stack?

React + TypeScript + Vite, Manifest V3, Harper (WASM); calls AI providers directly via
OpenAI-compatible APIs.

See [13-architecture.md](13-architecture.md).

### Is there a hosted API?

No. OGrammar is a browser extension — there's no hosted HTTP API. The extension's modules
are reusable in the codebase.

### What's the roadmap?

See [ROADMAP.md](../ROADMAP.md). In short: the engine and extension are shipping; planned
work includes Firefox/Safari ports and residual false-positive guards.

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
