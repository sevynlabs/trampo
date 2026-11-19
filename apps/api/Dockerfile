# API image (Railway). Build from the repo root:
#   docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@9.4.0 --activate

# ---------------------------------------------------------------- build stage
FROM base AS builder
WORKDIR /app

# Workspace manifests first (better layer cache). pnpm needs every workspace
# package.json to accept the frozen lockfile, even the ones we don't build.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/contracts/package.json packages/contracts/

# Only the API and what it depends on
RUN pnpm install --frozen-lockfile --filter "@trampo/api..."

COPY packages/db packages/db
COPY packages/contracts packages/contracts
COPY apps/api apps/api

RUN pnpm --filter @trampo/db generate \
  && pnpm --filter @trampo/api build

# -------------------------------------------------------------- runtime stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
USER node
EXPOSE 3000

# Railway also probes /health before switching traffic (zero-downtime deploys)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-${API_PORT:-3000}}/health" > /dev/null || exit 1

CMD ["node", "dist/index.js"]
