# =============================================================================
# OpenGrammar Backend — Lean Production Docker Image
# Docker Hub: zazzn/opengrammar-backend
# Fork:       https://github.com/zazzn/opengrammar
# Upstream:   https://github.com/swadhinbiswas/opengrammar
# =============================================================================
# Stateless Hono API (no DB, no volumes). Runs the TypeScript source directly
# via tsx. Multi-stage so the final image carries ONLY production deps + tsx
# (no typescript / wrangler / cloudflare / netlify dev tooling).

# ----- Stage 1: typecheck (uses full deps, discarded) ------------------------
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
# server.ts is the real Node entrypoint: it serves the full fork app
# (src/index.ts: /correct, /rewrite, /rephrase, Ollama mgmt, Abacus).
# NOT server-node.ts, which is a stripped stub missing the LLM routes.
COPY server.ts ./
# Blocking typecheck — a type error fails the build (source passes clean today).
RUN npx tsc --noEmit

# ----- Stage 2: production node_modules only ---------------------------------
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# Production deps only, then add tsx (runtime TS loader; it is a devDependency
# in package.json, required here because we run the .ts entrypoint directly).
RUN npm ci --omit=dev \
 && npm install --no-save tsx@4 \
 && npm cache clean --force

# ----- Stage 3: runtime ------------------------------------------------------
FROM node:20-alpine

LABEL org.opencontainers.image.title="OpenGrammar Backend"
LABEL org.opencontainers.image.description="Privacy-first, open-source grammar intelligence API (fork)"
LABEL org.opencontainers.image.url="https://github.com/zazzn/opengrammar"
LABEL org.opencontainers.image.source="https://github.com/zazzn/opengrammar"
LABEL org.opencontainers.image.licenses="Apache-2.0"
LABEL org.opencontainers.image.version="2.0.0"

WORKDIR /app

# dumb-init = proper PID 1 signal handling (clean Ctrl+C / docker stop)
RUN apk add --no-cache dumb-init

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder   /app/src          ./src
COPY --from=builder   /app/server.ts    ./
COPY package.json tsconfig.json ./

# Non-root user
RUN addgroup -g 1001 -S opengrammar \
 && adduser  -S -u 1001 -G opengrammar opengrammar
USER opengrammar

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import", "tsx/esm", "server.ts"]
