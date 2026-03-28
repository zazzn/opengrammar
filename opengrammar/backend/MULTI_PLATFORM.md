# 🚀 OpenGrammar Backend — Multi-Platform Deployment

The backend is a [Hono](https://hono.dev) application with a **single shared codebase** that runs on multiple platforms via thin adapters.

## Architecture

```
backend/src/index.ts          ← Shared Hono app (all routes & logic)
         │
         ├── wrangler.toml          → Cloudflare Workers  (edge, V8 isolates)
         ├── api/index.ts           → Vercel              (Node.js serverless)
         ├── netlify/functions/     → Netlify             (Node.js serverless)
         ├── server-deno.ts         → Deno Deploy         (edge, Deno runtime)
         ├── server-node.ts         → Render / Railway    (long-running Node.js)
         └── Dockerfile             → Docker Hub / self-host
```

## 🌍 Live Deployments

| Platform | URL | Status |
|---|---|---|
| ☁️ Cloudflare Workers | `https://opengrammar-backend-production.thelabrats-dev.workers.dev` | ✅ Primary |
| △ Vercel | `https://opengrammar-backend-psi.vercel.app` | ✅ Live |
| 🟩 Netlify | `https://opengrammar-backend.netlify.app` | ⏳ Pending setup |
| 🦕 Deno Deploy | `https://opengrammar-backend.deno.dev` | ⏳ Pending setup |
| 🐳 Docker Hub | `docker pull swadhinbiswas/opengrammar-backend` | ⏳ Pending setup |

## 🤖 Automated CI/CD

Every push to `main` that changes `backend/**` automatically deploys to **all platforms** via GitHub Actions.

**Workflow file:** `.github/workflows/deploy-backend.yml`

You can also trigger a manual deployment to a specific platform:
1. Go to **Actions** tab on GitHub
2. Select **"Deploy Backend — All Platforms"**  
3. Click **"Run workflow"** → choose a specific platform

## 🔑 Required GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | How to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens) → Create Token → "Edit Cloudflare Workers" |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard → Right sidebar on any domain |
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) |
| `VERCEL_ORG_ID` | `cat backend/.vercel/project.json` → `orgId` |
| `VERCEL_PROJECT_ID` | `cat backend/.vercel/project.json` → `projectId` |
| `NETLIFY_AUTH_TOKEN` | [app.netlify.com/user/applications](https://app.netlify.com/user/applications) → Personal access tokens |
| `NETLIFY_SITE_ID` | Netlify Dashboard → Site → Settings → General → Site ID |
| `DENO_DEPLOY_TOKEN` | [dash.deno.com/account#access-tokens](https://dash.deno.com/account#access-tokens) |
| `DOCKERHUB_USERNAME` | Your Docker Hub username (`swadhinbiswas`) |
| `DOCKERHUB_TOKEN` | [hub.docker.com/settings/security](https://hub.docker.com/settings/security) → New Access Token |

## 🐳 Docker Hub

### Pull and run (anyone can do this)
```bash
docker run -p 8787:8787 swadhinbiswas/opengrammar-backend:latest
```

### With environment variables
```bash
docker run -p 8787:8787 \
  -e GROQ_API_KEY=your_key \
  -e OPENAI_API_KEY=your_key \
  swadhinbiswas/opengrammar-backend:latest
```

### Build locally
```bash
cd backend
docker build -t opengrammar-backend .
docker run -p 8787:8787 opengrammar-backend
```

## 🌐 Platform Details

### Cloudflare Workers (Primary)
- **Runtime:** V8 isolates (no Node.js)
- **Cold start:** ~0ms (always warm)
- **Free tier:** 100,000 req/day
- **Global:** 300+ PoPs — runs at the CDN edge

### Vercel
- **Runtime:** Node.js 20 serverless functions
- **Cold start:** ~200-500ms
- **Free tier:** 100GB-hours/month

### Netlify
- **Runtime:** Node.js serverless functions (AWS Lambda)
- **Cold start:** ~300-700ms
- **Free tier:** 125,000 function calls/month

### Deno Deploy
- **Runtime:** Deno (Web Standard APIs, same as CF Workers)
- **Cold start:** ~0ms (always warm)
- **Free tier:** 100,000 req/day

### Docker / Self-hosted
- **Runtime:** Node.js 20 + tsx
- **Port:** 8787
- **OS:** linux/amd64 and linux/arm64 (multi-arch)

## 📡 Can I use it as a CDN?

The API is **dynamic** — it processes different text on every request, so you can't cache it like static files. However:

- **Cloudflare Workers** runs inside Cloudflare's global CDN network at 300+ edge locations
- Users in Asia get served from Singapore, US users from New York — **CDN-level latency**
- Static endpoints like `/health` and `/providers` can have `Cache-Control` headers added to truly cache at the edge

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Status dashboard |
| `GET` | `/health` | Health check |
| `GET` | `/providers` | List AI providers |
| `POST` | `/analyze` | Grammar analysis |
| `POST` | `/autocomplete` | Text completion |
| `POST` | `/rewrite` | Tone rewriting |

### Example
```bash
curl -X POST https://opengrammar-backend-psi.vercel.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"text": "Me and him went to store yesterday"}'
```

## 🛠️ Local Development

```bash
cd backend

# Bun (fastest)
bun run dev

# Node.js
npm run dev:node

# Cloudflare Workers local emulation
bun run wrangler dev
```
