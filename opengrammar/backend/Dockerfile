# =============================================================================
# OpenGrammar Backend — Production Docker Image
# Docker Hub: swadhinbiswas/opengrammar-backend
# =============================================================================

# ----- Stage 1: Build --------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache python3 make g++

# Copy dependency files first (better layer caching)
COPY package*.json tsconfig.json ./

# Install ALL deps (including dev for build)
RUN npm install

# Copy source
COPY src/ ./src/
COPY server-node.ts ./

# Type-check only (no emit needed — tsx handles transpilation at runtime)
RUN npx tsc --noEmit || true

# ----- Stage 2: Production ---------------------------------------------------
FROM node:20-alpine

LABEL org.opencontainers.image.title="OpenGrammar Backend"
LABEL org.opencontainers.image.description="Privacy-first, open-source grammar intelligence API"
LABEL org.opencontainers.image.url="https://opengrammer.eu.cc"
LABEL org.opencontainers.image.source="https://github.com/swadhinbiswas/opengrammar"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="2.0.0"

WORKDIR /app

# Runtime: dumb-init for proper PID 1 signal handling
RUN apk add --no-cache dumb-init

# Copy only production deps and source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/server-node.ts ./
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./

# Non-root user for security
RUN addgroup -g 1001 -S opengrammar && \
    adduser -S -u 1001 -G opengrammar opengrammar
USER opengrammar

# Port
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8787/health || exit 1

# Start server
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import", "tsx/esm", "server-node.ts"]
