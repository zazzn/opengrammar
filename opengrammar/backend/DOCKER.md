# OpenGrammar Backend — Docker

Lean container image for the OpenGrammar backend API.

- **Docker Hub:** `zazzn/opengrammar-backend`
- **GitHub fork (source):** https://github.com/zazzn/opengrammar
- **Upstream project:** https://github.com/swadhinbiswas/opengrammar
- **License:** Apache-2.0 (see `LICENSE` and `NOTICE` at the repo root)

## What this is

A **stateless** HTTP API (Hono). It is an LLM proxy plus a rule/NLP engine.
It powers the extension's **Grammar/Tone button** (`/correct`, `/rephrase`,
`/rewrite`) and the legacy `/analyze` fallback. Inline spell/grammar checking
runs in the extension itself (Harper/WASM) and does **not** need this backend.

- No database, no volumes, no disk writes.
- No secrets required to start — the extension sends the LLM API key per
  request. Env keys below are optional, for testing only.
- Needs outbound network to whatever LLM provider you use (OpenAI / Groq /
  OpenRouter / Together / Abacus over the internet, and/or Ollama).

## Quick start

```bash
docker pull zazzn/opengrammar-backend:latest

docker run -d --name opengrammar-backend \
  -p 8787:8787 \
  --restart unless-stopped \
  zazzn/opengrammar-backend:latest

# verify
curl http://localhost:8787/health
```

Then set the extension's **Backend URL** (Options page) to
`http://<docker-host>:8787`.

## Environment variables (all optional)

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Listen port |
| `NODE_ENV` | `production` | Node environment |
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Local Ollama endpoint — see note below |
| `GROQ_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `TOGETHER_API_KEY` | — | Test-only fallback keys; normally the extension supplies the key per request |

### Ollama note (important if you use local models)

Inside a container, `localhost` is the **container itself**, not your host or
LAN. If Ollama runs elsewhere, point the backend at its real address:

```bash
docker run -d --name opengrammar-backend -p 8787:8787 \
  -e OLLAMA_BASE_URL=http://192.168.1.8:11434/v1 \
  zazzn/opengrammar-backend:latest
```

Use `host.docker.internal` if Ollama runs on the same machine as Docker. If
you only use cloud providers, ignore this — those work with no config.

## docker compose

The repo ships a `docker-compose.yml` (one level up) that can also start a
bundled Ollama (`--profile local-llm`). Cloud-only is just:

```bash
docker compose up -d opengrammar-backend
```

## Endpoints

`GET /health` · `GET /providers` · `POST /analyze` · `POST /correct` ·
`POST /rephrase` · `POST /rewrite` · `POST /ollama-status` ·
`POST /ollama-unload` · `POST /models`

## Image notes

- Multi-stage `node:20-alpine`; final image carries only production deps +
  `tsx` (no typescript/wrangler/cloudflare/netlify dev tooling).
- Non-root user, `dumb-init` PID 1, built-in `HEALTHCHECK` on `/health`.
- Typecheck is blocking at build time (`tsc --noEmit` must pass).

## Build & publish (maintainers)

```bash
cd backend
docker build -t zazzn/opengrammar-backend:latest \
             -t zazzn/opengrammar-backend:2.0.0 .
docker login
docker push zazzn/opengrammar-backend:latest
docker push zazzn/opengrammar-backend:2.0.0
```
