# OGrammer

**Version 0.9** — a privacy-first, open-source writing assistant browser
extension. A fork of [OpenGrammar](https://github.com/swadhinbiswas/opengrammar).

- Fork: <https://github.com/zazzn/opengrammar>
- License: Apache-2.0 (see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE))

## What it does

Two strictly separated tiers:

1. **Inline (mechanical only) — fully offline, no network.**
   Spelling, capitalization and punctuation are checked on-device by the
   [Harper](https://github.com/Automattic/harper) engine (Rust → WebAssembly,
   Apache-2.0) running inside the extension's service worker. Instant,
   private, works with no API key and no internet. A local n-gram
   re-ranker improves spelling-candidate ordering.

2. **Grammar & Tone — an explicit button.**
   Whole-text correction and tone rewriting use an LLM. **As of v0.9 the
   extension calls your chosen LLM provider directly — there is no backend
   service.** Your API key is stored encrypted on your device
   (AES-GCM, never synced) and sent only to the provider you select.

Inline checking never calls the network. The LLM is only used when you
press the Grammar/Tone button (or the floating-bubble alternatives).

## No backend required

Earlier versions proxied LLM calls through a self-hosted backend. That
dependency has been removed: the background service worker calls the
provider's OpenAI-compatible `/v1/chat/completions` endpoint itself.

The `backend/` directory and its Docker image are **retained but
optional** — only useful if you specifically want a self-hosted proxy
(e.g. to keep API keys off client machines). The extension does not need
it and has no "Backend URL" setting.

## Supported providers

OpenAI · OpenRouter · Groq · Together AI · Abacus RouteLLM · Ollama
(local) · any custom OpenAI-compatible endpoint. Choose the provider,
model and key in the extension popup.

### Local Ollama note

Browsers block plain-HTTP requests from an extension to a private LAN IP.
To use an Ollama box on your network, expose it at `http://localhost:11434`
on the machine running Chrome — e.g. an SSH local forward:

```bash
ssh -L 11434:localhost:11434 your-ollama-host
```

Then set the Ollama URL to `http://localhost:11434`. Cloud providers need
none of this (they are public HTTPS).

## Install (unpacked)

```bash
cd extension
npm install
npm run build
```

Then in Chrome: `chrome://extensions` → enable **Developer mode** →
**Load unpacked** → select `extension/dist`. Open the popup and set your
provider + API key (or Ollama). No backend URL is needed.

## Privacy

- Inline mechanical checks are 100% local — text never leaves the device.
- The Grammar/Tone button sends text only to the LLM provider you choose.
- API keys are encrypted at rest on the device and never synced.
- Google Docs is intentionally out of scope (canvas-rendered).

## Attribution

OGrammer is a derivative work of OpenGrammar by Swadhin Biswas, used
under the Apache License 2.0. It bundles the Automattic Harper engine
(Apache-2.0). Significant changes from upstream are summarized in
[`NOTICE`](NOTICE). You must retain `LICENSE` and `NOTICE` when
redistributing.
