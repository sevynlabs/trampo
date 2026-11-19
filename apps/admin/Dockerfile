# Painel + site público (Next.js standalone). Build from the repo root:
#   docker build -f apps/admin/Dockerfile .
FROM node:24-alpine AS base
RUN apk add --no-cache openssl libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@9.4.0 --activate

# ---------------------------------------------------------------- build stage
FROM base AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Every workspace package.json is needed for pnpm's frozen lockfile
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
COPY apps/mobile/package.json apps/mobile/
COPY packages/db/package.json packages/db/
COPY packages/contracts/package.json packages/contracts/

# The panel imports the API's router types, so the API workspace comes along
RUN pnpm install --frozen-lockfile --filter "@trampo/admin..."

COPY packages packages
COPY apps/api apps/api
COPY apps/admin apps/admin

# Prisma client types are part of the API router types used by the panel
RUN pnpm --filter @trampo/db generate \
  && pnpm --filter @trampo/admin build

# -------------------------------------------------------------- runtime stage
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/privacidade" > /dev/null || exit 1

CMD ["node", "apps/admin/server.js"]
