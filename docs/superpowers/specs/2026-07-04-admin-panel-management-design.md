# TRAMPO Admin Panel — Full Management System

**Date:** 2026-07-04
**Status:** Approved (design), Phase 1 in progress
**Scope:** Turn the current thin admin panel (auth, users, KYC, payments backoffice) into a complete app-management system: analytics dashboard, financial management, notification/email campaigns, marketing, integrations, and moderation.

## Context — current state

`apps/admin` (Next 15 + React 19, port 3001) talks to `apps/api` (Hono + tRPC) via a same-origin proxy. Existing admin surface:

- **Auth** — `admin.login` (email/password → 24h JWT), roles `SUPER_ADMIN` etc.
- **Dashboard** — raw counts only (users, taskers, KYC pending, active tasks, open disputes).
- **Users** — list/search/filter + detail, block/unblock, role change.
- **KYC** — review queue + approve/reject with `KycDecision` audit.
- **Financial (partial)** — settlement status, dead-letter queue, reconcile (backoffice only; no UI for payments/revenue/withdrawals).

DB models available: `User`, `Payment` (amount, platformFee, taskerAmount, escrow timestamps, status), `Withdrawal` (amount, pixKey, status), `Task`, `Dispute`, `Cancellation`, `Review`, `Notification`, `Category`, `ServiceArea`. Push via Expo (`integrations/push.ts`). No campaign/coupon/audit-log models. Resend is in env only (optional), not integrated.

## Architecture

Follow existing repo conventions; improve as we touch:

- **API** — split the monolithic `apps/api/src/modules/admin/router.ts` into domain sub-routers merged into one `adminRouter`:
  `admin/dashboard.ts`, `admin/finance.ts`, `admin/campaigns.ts`, `admin/marketing.ts`, `admin/integrations.ts`, `admin/moderation.ts` (+ existing users/kyc kept). Each file focused and independently testable. Shared helpers (auth procedures, serializers) stay in a small `admin/_shared.ts`.
- **Admin app** — new pages under `apps/admin/app/(dashboard)/…`, feature components in `components/`, primitives in `components/ui/`.
- **Sending** — `integrations/email.ts`: Resend adapter with an automatic **dev fallback** (logs instead of sending) chosen by presence of `RESEND_API_KEY`. Push reuses `integrations/push.ts`. Same dev/real pattern later applies to email.
- **Charts** — lightweight custom SVG components (bar, line, sparkline) in `components/ui/charts.tsx`. No new dependency (avoids Recharts × React 19 friction). MVP-grade.

## New data models (Prisma + migration)

- `Campaign` — id, name, channel (`PUSH`|`EMAIL`), segment (JSON filter descriptor), status (`DRAFT`|`SCHEDULED`|`SENDING`|`SENT`|`FAILED`), title, body, emailTemplateId?, scheduledAt?, sentAt?, counts (recipients, sent, failed), createdById, timestamps.
- `CampaignRecipient` — id, campaignId, userId, status (`PENDING`|`SENT`|`FAILED`), error?, sentAt?. Index (campaignId, status).
- `EmailTemplate` — id, name, subject, bodyHtml, variables (JSON), isActive, timestamps.
- `Coupon` — id, code (unique), kind (`PERCENT`|`FIXED`), value (int: percent 0–100 or centavos), maxUses?, usedCount, validFrom?, validUntil?, isActive, timestamps.
- `AuditLog` — id, actorAdminId, action (string), targetType, targetId?, metadata (JSON), createdAt. Index (createdAt), (targetType, targetId).
- `IntegrationSetting` — id, key (unique), value (JSON), updatedById, updatedAt. (For toggles; live status is read-only via health checks, not stored.)

User **segments** in MVP are **dynamic filter descriptors** (e.g. `{ role: "TASKER", kycStatus: "APPROVED" }`, `{ activeWithinDays: 30 }`) resolved to user lists at send time — no segment table (YAGNI).

## Cross-cutting rules

- Every write action records an `AuditLog` row (actor, action, target, metadata).
- Monetary values are integers (centavos) end-to-end; format to BRL only in the UI.
- RBAC (MVP): `SUPER_ADMIN` = all. Sensitive actions (pay withdrawal, role change, send campaign) gate on role via an `adminProcedure`-style guard.
- All list endpoints paginated + filterable, mirroring `listUsers`.

## Roadmap (each phase = one plan + a testable deliverable)

### Phase 1 — Analytics Dashboard + Financial
- **Dashboard**: GMV, platform revenue & commission, new-users time series, task funnel (open→accepted→completed→released), completion rate, disputes trend — with charts. Backed by `admin.dashboard.*` procedures aggregating `Payment`/`Task`/`User`.
- **Financial**: payments list (filter status/period, search), payment detail with escrow timeline, revenue/commission report (by period), **withdrawals** management (`Withdrawal`: approve → mark paid / reject with reason), refunds surface. Backed by `admin.finance.*`.
- Introduces `AuditLog` model + chart components + BRL/date formatters.

### Phase 2 — Campaigns (Push + Email)
- Push: create campaign → pick segment → preview → send/schedule (Redis job) → metrics. Real via Expo.
- Email: `EmailTemplate` CRUD + campaign → segment → preview → send (dev sender) → metrics.
- Introduces `Campaign`, `CampaignRecipient`, `EmailTemplate`, `integrations/email.ts`, send job/worker.

### Phase 3 — Marketing + Integrations + Moderation
- `Coupon` CRUD + activate. Integrations health panel (Asaas/Twilio/Redis/Resend/Expo) + `IntegrationSetting` toggles.
- Moderation: disputes resolve, tasks browse/act, categories CRUD, service areas, reviews moderation. Admin users + RBAC management + audit-log viewer.

## Testing / verification

- API procedures: exercised against the live Supabase dev DB (pooler) via the running API; verify aggregates against known rows.
- UI: drive each new page in the running admin (`:3001`) after implementing, confirm it renders real data and actions mutate state (verify skill before finishing each phase).
- No new external sends in dev (email uses dev logger; push only to seeded test tokens).

## Out of scope (for now)

- Real email sending until `RESEND_API_KEY` is provided.
- Persisted segment builder, A/B testing, multi-language templates, cohort analytics beyond basic time series.
