# TRAMPO - Project Instructions

## Overview
TRAMPO is a P2P on-demand services marketplace for the Triangulo Mineiro region (Uberlandia, Uberaba, Araguari).
Built with Expo (mobile) + Hono/tRPC (backend) + Supabase (database/auth).

## Architecture

```
apps/
  api/          # Hono + tRPC backend (Railway)
  mobile/       # Expo + React Native app
packages/
  db/           # Prisma schema + migrations
  contracts/    # Shared zod schemas + tRPC types
```

## Tech Stack
- **Mobile**: Expo SDK 51+, Expo Router, NativeWind, tRPC client
- **Backend**: Hono, tRPC v11, Prisma
- **Database**: PostgreSQL + PostGIS (Supabase)
- **Auth**: Supabase Auth + Twilio Verify (OTP)
- **Payments**: Asaas (Pix + escrow via split)
- **Cache/Queue**: Redis (Upstash)
- **Realtime**: Supabase Realtime (chat + status updates)

## Security Rules (CRITICAL)

### Never do:
- Expose `SUPABASE_SERVICE_ROLE_KEY` to mobile
- Store tokens in AsyncStorage (use `expo-secure-store`)
- Trust values from client for pricing (recalculate server-side)
- Skip webhook signature validation
- Store PII unencrypted (CPF must be encrypted with pgcrypto)

### Always do:
- Use Row Level Security (RLS) on all Supabase tables
- Validate Asaas webhook signature before processing
- Use signed URLs with short TTL for KYC documents
- Use optimistic locking for task acceptance (prevent double-accept)
- Store monetary values as integers (centavos), never floats

## Business Rules (Immutable)

| Rule | Value |
|------|-------|
| Minimum task value | R$ 50.00 (5000 centavos) |
| Tasker commission | 15% |
| Client service fee | 5% |
| Urgency fee (<1h) | +30% |
| Escrow release | 1h after completion |
| Free cancellation | Up to 30min before |
| Cancellation penalty | 20% |

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Run all apps in dev mode
pnpm dev:api          # Run only backend
pnpm dev:mobile       # Run only mobile
pnpm db:generate      # Generate Prisma client
pnpm db:push          # Push schema to database
pnpm db:studio        # Open Prisma Studio
```

## Folder Structure (Backend)

```
apps/api/src/
  index.ts            # Hono app + tRPC adapter
  trpc.ts             # tRPC router, context, middlewares
  modules/
    auth/             # OTP login, session
    profiles/         # User profiles
    kyc/              # Document upload, verification
    tasks/            # Task CRUD
    feed/             # Geographic feed (PostGIS)
    matching/         # Accept/start/complete
    chat/             # Realtime messages
    reviews/          # Bilateral ratings
    payments/         # Asaas integration
    cancellations/    # Cancel + penalty
  domain/             # Pure business logic (pricing, state machine)
  integrations/       # External services (asaas, twilio, etc)
  jobs/               # Redis workers (escrow release)
  lib/                # Utilities (redis, prisma, env)
```

## Categories (Dynamic from DB)
Initial categories: Limpeza, Reparos, Mudanca, Entregas, Pet care, Aulas, Eventos, Beleza

## Task State Machine
```
open -> accepted -> in_progress -> completed -> released
         |              |              |
         v              v              v
     cancelled      disputed       disputed
```

## Environment Variables
Copy `.env.example` to `.env` and fill in values. NEVER commit `.env`.
