# opengrammar-server

> Privacy-first, open-source grammar intelligence server — run it on **any device**.

[![npm version](https://img.shields.io/npm/v/opengrammar-server)](https://www.npmjs.com/package/opengrammar-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Turn **any device** into a local OpenGrammar API server — your old Android phone via Termux, a Raspberry Pi, an old laptop, or any VPS.

## Quick Start

```bash
# Run instantly (no install needed)
npx opengrammar-server

# Or install globally
npm install -g opengrammar-server
opengrammar-server
```

That's it. Your server is live at `http://localhost:8787` 🎉

## Options

```bash
opengrammar-server --port 3000          # Custom port
opengrammar-server --host 127.0.0.1    # Localhost only (more secure)
opengrammar-server --help               # Show all options
opengrammar-server --version            # Show version
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/`            | Status dashboard |
| `GET`  | `/health`      | Health check |
| `POST` | `/analyze`     | Grammar analysis |
| `POST` | `/autocomplete`| Text completion |
| `GET`  | `/providers`   | List AI providers |

### Example

```bash
# Check health
curl http://localhost:8787/health

# Analyze text
curl -X POST http://localhost:8787/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Me and him went to store yesterday"}'
```

## 🤖 Run on Android (Termux)

Turn your old Android phone into a grammar server!

```bash
# 1. Install Termux from F-Droid (not Play Store)
# 2. Inside Termux:
pkg update && pkg install nodejs
npx opengrammar-server --port 8787
```

Your phone is now a grammar server accessible on your local network at `http://<phone-ip>:8787`.

## 🍓 Run on Raspberry Pi

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
npx opengrammar-server
```

## 🐳 Docker

```bash
docker run -p 8787:8787 swadhinbiswas/opengrammar-backend:latest
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: `8787`) |
| `HOST` | Bind host (default: `0.0.0.0`) |
| `GROQ_API_KEY` | Groq API key for AI features (optional) |
| `OPENAI_API_KEY` | OpenAI API key (optional) |

## Links

- 🌐 **Website:** https://opengrammer.eu.cc
- 📦 **GitHub:** https://github.com/swadhinbiswas/opengrammar
- 🐛 **Issues:** https://github.com/swadhinbiswas/opengrammar/issues
- ☁️ **Hosted API:** https://opengrammar-backend-production.thelabrats-dev.workers.dev
