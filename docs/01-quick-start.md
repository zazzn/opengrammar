# Quick Start

Get the OGrammar **browser extension** running fast. It is built on one Harper + LLM
engine and works in Chrome / Brave / Edge.

---

## Do I need an API key?

No — not to start. OGrammar's local **Harper** engine checks spelling, grammar,
punctuation, capitalization, and style **on-device, with no key and no network**.

Add your own provider key only if you also want the optional **LLM tier**
(context/sentence review and tone rewriting). It's bring-your-own-key: the extension
calls the provider directly — there is no OGrammar backend. See
[07-ai-providers.md](07-ai-providers.md) for the options (OpenAI, DeepSeek, Groq,
OpenRouter, Together, or local Ollama).

---

## Build & load the extension (about 5 minutes)

### 1. Build

```bash
# Clone the repository
git clone https://github.com/swadhinbiswas/opengrammar.git
cd opengrammar/opengrammar/extension

# Install dependencies (Bun is the project's preferred runtime/PM; Node 18+ also works)
bun install

# Build the extension → dist/
bun run build
```

### 2. Load in your browser (Chrome / Brave / Edge)

1. Open `chrome://extensions/` (or `brave://extensions/` / `edge://extensions/`)
2. Enable **Developer mode** (toggle, top-right)
3. Click **Load unpacked**
4. Select the `opengrammar/extension/dist` folder
5. The OGrammar icon appears in your toolbar.

### 3. (Optional) Add an AI provider key

1. Open the extension's **Options** (right-click the icon → **Options**).
2. Pick a **Provider**, paste your **API key**, and choose a **Model**.
3. For **Ollama** or a **Custom** endpoint, set the base URL instead of a key.

### 4. Start writing

1. Open any text box — Gmail, Google Docs, Notion, Reddit, a web editor.
2. Type something with a mistake, e.g. `i recieved teh package`.
3. A **red underline** marks the issue (Harper). LLM context suggestions, if enabled,
   appear as a separate **blue-dotted** layer.
4. Click an underline and apply the fix.

---

## What's next?

| I want to... | Read |
|--------------|------|
| Use AI fully offline | [AI providers](07-ai-providers.md) → Ollama (local, no key) |
| Rewrite text in different tones | [Tone rewriting](10-tone-rewriting.md) |
| See every feature | [Using OGrammar](09-using-opengrammar.md) |

---

## Need help?

- **Something not working?** [Troubleshooting](18-troubleshooting.md)
- **Questions?** [GitHub Discussions](https://github.com/swadhinbiswas/opengrammar/discussions)
- **Found a bug?** [GitHub Issues](https://github.com/swadhinbiswas/opengrammar/issues)
