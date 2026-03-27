<div align="center">
  <img src="logo.svg" alt="OpenGrammar Logo" width="120" height="120">
  
  # 🪶 OpenGrammar 2.0

  **Your privacy-first, open-source writing assistant.**  
  *The completely free, zero-compromise Grammarly alternative you can host yourself.*

  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
  [![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
</div>

---

Writing clearly matters. But achieving perfect grammar shouldn't mean sacrificing your privacy or paying a premium monthly subscription to a tech giant. 

Welcome to **OpenGrammar**—a powerful, robust browser extension built from the ground up to match the premium writing tools you already know, but with one massive difference: **You own your data, and it runs completely for free.**

## 🌟 Why OpenGrammar?

For too long, the industry standard has been to quietly siphon every keystroke you type to remote servers, locking advanced features behind hefty paywalls. OpenGrammar is our answer to that:

1. **The Zero-Cost Foundation:** Out of the box, our core engine runs 100% locally in your browser. With a massive 156,000-word offline dictionary, it instantly catches misspellings, passive voice, and weak phrasing without ever pinging a server.
2. **Bring Your Own Brain (BYOK):** Want deep, context-aware AI corrections? Just plug in your own API key (OpenAI, Groq, Together, OpenRouter, or even local open-source models via Ollama). You pay fractions of a cent exclusively for what you use, cutting out the middleman entirely.
3. **Paranoid-Level Privacy:** We don't have a database. We don't want your user data. Your API key never leaves your browser storage. If you choose to use the AI features, your text is processed through a stateless edge function and immediately deleted. 
4. **Deploy It Yourself:** Trust no one? Perfect. You can deploy our lightweight backend to Cloudflare Workers or Vercel Edge for free, in a single command. You own the entire pipeline.

## ✨ Under The Hood

OpenGrammar 2.0 isn't just a wrapper—it's a dual-engine powerhouse.

- **Blazing Fast & Works Everywhere:** We seamlessly inject directly into text inputs, textareas, and complex rich-text editors (Gmail, Google Docs, Notion, Reddit). Built on React, Vite, and Manifest V3 so it never bogs down your browser.
- **The Dual-Engine Architecture:**
  1. *The Offline Sentinel:* A Damerau-Levenshtein edit-distance and phonetic matching spellchecker catches immediate typos. 40+ granular grammar rules instantly flag subject-verb agreement issues, sentence fragments, and commonly confused words (like affect/effect). 
  2. *The AI Enforcer:* An intelligent LLM router. Thanks to our **Deduplication Logic**, the AI is completely aware of what the Offline Sentinel already caught. It *never* wastes expensive tokens repeating basic fixes.
- **Smart Context Awareness:** Are you writing a casual tweet, a highly technical documentation page, or a formal business email? The engine automatically detects your domain and scales its strictness appropriately.
- **Deep Analytics & History:**
  - **Dynamic Writing Score:** Evaluates your text dynamically from 0-100 based on your Correctness, Readability, Engagement (vocabulary diversity), and Sentence Delivery variation.
  - **Private Daily Tracking:** Silently logs your writing history, words checked, and average daily score directly to your local extension storage.
- **Tone & Style Rewriting:** Right-click context menus or a quick `Ctrl+Shift+R` to instantly rethink highlighted text into 8 different tones.
- **Flawless UI:** The classic red, yellow, and blue squiggly underlines you grew up with, paired with slick, interactive click-to-apply tooltips and a gorgeous stats dashboard.

## 🚀 Getting Started (For Users)

*Note: As an open-source tool in active development, OpenGrammar is currently installed via developer mode.*

1. **Download the Extension:** Grab the latest release or clone this repository.
2. **Open Extensions Page:** In Chrome/Brave/Edge, navigate to `chrome://extensions/`.
3. **Enable Developer Mode:** Toggle the switch in the top right corner.
4. **Load Unpacked:** Click the "Load unpacked" button and select the `opengrammar/extension/dist` folder you built or downloaded.
5. **Configure:** Click the OpenGrammar feather icon in your browser toolbar. Paste in your OpenAI, Groq, or OpenRouter API key to unlock the advanced AI engine.

## 💻 Developer Guide: Build & Deploy

Want to build OpenGrammar from scratch or deploy your own serverless backend? Let's get to it.

### Prerequisites

- Node.js (v18 or newer)
- [Bun](https://bun.sh/) (Highly Recommended) or npm/pnpm

### 1. Set up the Backend (Serverless Edge API)

Our backend isn't a bloated server. It's an ultra-lightweight Hono API that securely masks and handles AI routing.

```bash
# Navigate to the backend folder
cd opengrammar/backend

# Install dependencies lightning fast with Bun
bun install

# Run locally for testing (runs on http://localhost:8787)
bun run dev

# Deploy globally to Cloudflare Workers (requires a free Cloudflare account)
bun run deploy
```

### 2. Set up the Chrome Extension

```bash
# Navigate to the extension folder
cd opengrammar/extension

# Install dependencies
bun install

# Build the extension into an optimized bundle
bun run build
```

The build process will generate a `dist/` folder. Load this folder into your browser following the user instructions above!

## 🤝 Join the Rebellion 

**We need your help to unseat the monopolies and make OpenGrammar the definitive open-source writing assistant.**

Our biggest mission right now is building the ultimate library of local (offline) grammar and style rules. You don't even need to be a software engineer to contribute—if you're a language nerd with a good eye for grammar, we want you!

- **📚 Add Grammar Rules:** Help us expand `analyzer.ts` with more regex-based rules for common mistakes, style improvements, and clarity checks. See our [GRAMMAR_RULES.md](./GRAMMAR_RULES.md) guide.
- **🐛 Hunt Bugs:** Found a weird website where the text highlighting breaks? Open an issue.
- **💡 Dream Up Features:** Have an idea for something cool? Start a thread in our Discussions tab.

Check out our [CONTRIBUTING.md](./CONTRIBUTING.md) and peek at the `ROADMAP.md` to see where we're headed next.

## 📄 License

This project is open-source and proudly licensed under the Apache 2.0 License. See the LICENSE file for details. Let's build the future of writing together.
