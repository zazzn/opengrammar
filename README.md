<div align="center">
  <img src="logo.svg" alt="OpenGrammar Logo" width="120" height="120">
  
  # 🪶 OpenGrammar 2.0

  **Your privacy-first, open-source writing assistant.**  
  *The completely free, zero-compromise Grammarly alternative you can host yourself.*

  [![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
  [![NPM Package](https://img.shields.io/npm/v/opengrammar-server)](https://www.npmjs.com/package/opengrammar-server)
  [![Docker Pulls](https://img.shields.io/docker/pulls/swadhinbiswas/opengrammar-backend)](https://hub.docker.com/r/swadhinbiswas/opengrammar-backend)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

  🌐 **[Official Website](https://opengrammer.eu.cc)** | 📖 **[Documentation](https://opengrammer.eu.cc/docs)**
</div>

---

Writing clearly matters. But achieving perfect grammar shouldn't mean sacrificing your privacy or paying a premium monthly subscription to a tech giant. 

**OpenGrammar** is a powerful, robust intelligent writing assistant built from the ground up to match the premium writing tools you already know, but with one massive difference: **You own your data, and it runs completely for free.**

## 🌟 Why OpenGrammar?

1. **The Zero-Cost Foundation:** Out of the box, our core engine runs 100% locally in your browser. With a massive 156,000-word offline dictionary, it instantly catches misspellings, passive voice, and weak phrasing without ever pinging a server.
2. **Bring Your Own Brain (BYOK):** Want deep, context-aware AI corrections? Just plug in your own API key (OpenAI, Groq, Together, OpenRouter, or even local models via Ollama). You pay fractions of a cent exclusively for what you use.
3. **Paranoid-Level Privacy:** We don't have a database. We don't want your user data. Your API key never leaves your browser storage. Text processed through the AI is immediately deleted via stateless edge functions.
4. **Deploy It Yourself:** You own the entire pipeline. Host our lightweight backend instantly via Docker, npm, Cloudflare, Vercel, or Netlify.

---

## 🚀 Live Production Endpoints

Don't want to host the backend yourself? OpenGrammar comes with incredibly fast, globally-distributed public edge deployments that you can connect your browser extension to instantly:

- ☁️ **Cloudflare Workers:** [`https://cf.opengrammer.eu.cc/`](https://cf.opengrammer.eu.cc/)
- △ **Vercel Edge:** [`https://vercel.opengrammer.eu.cc/`](https://vercel.opengrammer.eu.cc/)
- 🟩 **Netlify Functions:** [`https://nl.opengrammer.eu.cc/`](https://nl.opengrammer.eu.cc/)

---

## 🛠️ Installation & Self-Hosting

Our backend is natively multi-platform. Choose the environment that best fits your workflow.

### 📦 Option 1: NPM / Mobile / Node Environments
Run the OpenGrammar server on any machine with Node.js. You can effortlessly run this on an old laptop, a VPS, or even an Android phone using Termux!

```bash
# Run instantly without installing
npx opengrammar-server

# Or install globally for persistent usage
npm install -g opengrammar-server
opengrammar-server --port 8787
```

### 🐳 Option 2: Docker
We maintain a highly optimized, multi-architecture Docker image. This is the recommended route for standard server environments or local homelabs.

```bash
# Pull the production image
docker pull swadhinbiswas/opengrammar-backend:latest

# Run the container (exposes port 8787)
docker run -d -p 8787:8787 --name opengrammar swadhinbiswas/opengrammar-backend:latest
```

### 🧩 Option 3: Browser Extension (For Users)

1. Download the latest release from the `opengrammar/extension/dist` build.
2. Open Chrome/Brave/Edge and navigate to `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Click **Load unpacked** and select the extension folder.
5. Click the OpenGrammar feather icon in your toolbar, input your custom AI API keys, and link it to one of the **Live Production Endpoints** listed above!

---

## ✨ Core Features

- **The Dual-Engine Architecture:** A blazing fast local (offline) RegEx + Dictionary matching engine, paired securely with a configurable LLM router framework for tone rewriting and smart context adjustments.
- **Deduplication Logic:** The AI is fully synchronized with the local spellchecker. It never wastes expensive AI tokens re-checking typos already caught locally.
- **Smart Context Awareness:** Automatically detects if you are writing a casual tweet, a technical document, or a formal business email, scaling its strictness appropriately.
- **Dynamic Writing Score:** Evaluates your text dynamically (0-100) based on Correctness, Readability, Engagement, and Sentence Delivery.
- **Flawless Integrations:** Securely injects into rich-text editors including Gmail, Google Docs, Notion, and Reddit.

---

## 🤝 Join the Rebellion 

**We need your help to unseat the monopolies and make OpenGrammar the definitive open-source writing assistant.**

Whether you are a TypeScript developer wanting to optimize edge latency, or a language nerd looking to build out our offline Regex `GRAMMAR_RULES.md`—we want you! 

- Read our [CONTRIBUTING.md](./CONTRIBUTING.md) guide.
- Check our `ROADMAP.md` to see what we are currently building.
- Open an issue for bugs or start a thread in our Discussions tab.

## 📄 License

This project is proudly open-source under the **Apache 2.0 License**. See the `LICENSE` file for details. Let's build the future of writing together.
