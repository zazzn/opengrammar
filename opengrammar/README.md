<div align="center">
  <img src="https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/feather.svg" width="80" height="80" alt="OpenGrammar Logo" />

  <h1>OpenGrammar</h1>

  <p><strong>A blazingly fast, privacy-first, open-source grammar and writing engine.</strong></p>

  <p>
    <a href="https://github.com/swadhinbiswas/opengrammar/actions"><img src="https://github.com/swadhinbiswas/opengrammar/actions/workflows/ci.yml/badge.svg" alt="CI Status"></a>
    <a href="https://codefactor.io/repository/github/swadhinbiswas/opengrammar"><img src="https://www.codefactor.io/repository/github/swadhinbiswas/opengrammar/badge" alt="CodeFactor" /></a>
    <a href="https://opensource.org/licenses/Apache-2.0"><img src="https://img.shields.io/badge/License-Apache%202.0-blue.svg" alt="License"></a>
    <img src="https://img.shields.io/badge/Rules-814+-success" alt="Rules Active">
  </p>
</div>

---

**OpenGrammar** is an advanced grammar, style, and spell-checking engine built to be completely self-hosted. Unlike commercial exact-match grammar tools that vacuum up your keystrokes, OpenGrammar processes text either locally using deterministic Regex/NLP rules, or through an LLM provider of your choice (OpenAI, Local Ollama, Groq, OpenRouter).

## ✨ Features

- ⚡ **Blazingly Fast Engine**: Core engine analyzes 10,000 words in **< 650ms**.
- 🧠 **Hybrid Architecture**: Combines ultra-fast Regex pattern matching with `compromise` NLP for intelligent syntax analysis.
- 📚 **Massive Rule Library**: Ships with **814+ built-in rules** spanning:
  - Subject-Verb Agreement, Irregular Verbs, Subjunctives
  - Business Writing, Academic Tone, Inclusive Language
  - Clarity, Redundancy, Readability, and Clichés
- 🎯 **Context-Aware Filtering**: Automatically detects where you are writing (Slack = Chat, GitHub = Technical, Gmail = Email) and dynamically turns off nagging style rules when you're just typing casually.
- 🎛️ **Granular Toggles**: Fully configurable rules via the Chrome Extension UI.
- ☁️ **Bring Your Own LLM**: Optionally hook up OpenAI, Groq, or a completely offline local **Ollama** model for deep contextual analysis and AI sentence rewriting.

## 🚀 Getting Started

OpenGrammar is split into two parts: an **API Backend** (built with Hono + Bun) and a **Chrome Extension** (built with React + Vite).

### 1. Start the Backend

The engine runs on a lightweight [Hono](https://hono.dev/) server using [Bun](https://bun.sh/).

```bash
cd backend
bun install
bun run dev
```
*Server starts on `http://localhost:8787`*

### 2. Load the Chrome Extension

```bash
cd extension
npm install
npm run build
```

Then load it into your browser:
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right toggle).
3. Click **Load unpacked** and select the `/extension/dist` folder.

---

## ☁️ Deployment

The backend is built on standard Web APIs and runs perfectly on edge networks.

### Deploy to Cloudflare Workers (Recommended)
```bash
cd backend
npm run deploy
```
*This uses `wrangler` to instantly deploy your engine globally via Cloudflare.*

---

## 🛠️ Performance Architecture

OpenGrammar prioritizes offline, instant feedback without the latency of an AI roundtrip:
1. **Spellchecker Segment**: Loads a custom dictionary tree (120k+ words) for instant typo detection.
2. **NLP Tagger Segment**: `compromise` tags parts of speech (Nouns, Verbs, Quotations) to prevent false positives.
3. **Regex Engine**: Matches 800+ deterministic error patterns in a single pass.
4. **Deduplicator**: Ranks overlapping issues (Grammar > Spelling > Clarity > Style) and drops lower-priority items.

## 🤝 Contributing

We welcome contributions of all kinds! The heartbeat of this project is its `CORE_RULES` rule registry.
Adding a new grammar or style rule is as easy as writing a regex expression in TypeScript.

Please read our [Contributing Guide](CONTRIBUTING.md) to learn how the engine handles rules, how to write tests, and how to submit a PR!

## 📜 License

Apache 2.0 License - see the [LICENSE](LICENSE) file for details.
