# Admin Panel Fase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Criar painel admin web para gestão de usuários e aprovação KYC.

**Architecture:** Next.js 14 App Router em `apps/admin`, conectando via tRPC à API existente. Auth separada com JWT.

**Tech Stack:** Next.js 14, shadcn/ui, Tailwind, tRPC, Prisma, bcrypt

## Global Constraints

- Next.js 14 com App Router
- shadcn/ui para componentes
- JWT com 24h expiry, cookie httpOnly
- Senhas com bcrypt cost 12
- URLs KYC expiram em 5 minutos

---

### Task 1: Scaffold Next.js Admin App

**Files:**
- Create: `apps/admin/` (Next.js project)
- Create: `apps/admin/package.json`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/app/layout.tsx`

**Steps:**
- [ ] Initialize Next.js 14 in apps/admin
- [ ] Configure Tailwind + shadcn/ui
- [ ] Setup tRPC client connecting to API
- [ ] Add to turbo.json
- [ ] Commit

---

### Task 2: Database Schema — AdminUser + KycDecision

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

**Steps:**
- [ ] Add AdminUser model with email, passwordHash, role
- [ ] Add AdminRole enum (SUPER_ADMIN, OPERATOR, VIEWER)
- [ ] Add KycDecision model for audit trail
- [ ] Add relation to TaskerProfile
- [ ] Run prisma generate + push
- [ ] Commit

---

### Task 3: Admin Auth — Login Endpoint

**Files:**
- Create: `apps/api/src/modules/admin/auth.ts`
- Modify: `apps/api/src/modules/admin/router.ts`

**Steps:**
- [ ] Add login mutation (email/password → JWT)
- [ ] Add me query (validate token, return admin)
- [ ] Add adminProcedure middleware (verify JWT)
- [ ] Seed initial admin user
- [ ] Commit

---

### Task 4: Admin Login Page

**Files:**
- Create: `apps/admin/app/(auth)/login/page.tsx`
- Create: `apps/admin/app/(auth)/layout.tsx`
- Create: `apps/admin/lib/auth.ts`

**Steps:**
- [ ] Create login form with email/password
- [ ] Call tRPC login mutation
- [ ] Store JWT in httpOnly cookie
- [ ] Redirect to dashboard on success
- [ ] Commit

---

### Task 5: Dashboard Layout + Sidebar

**Files:**
- Create: `apps/admin/app/(dashboard)/layout.tsx`
- Create: `apps/admin/components/sidebar.tsx`
- Create: `apps/admin/components/header.tsx`
- Create: `apps/admin/middleware.ts`

**Steps:**
- [ ] Create sidebar with navigation (Dashboard, Usuários, KYC)
- [ ] Create header with admin name + logout
- [ ] Add middleware to protect /dashboard routes
- [ ] Commit

---

### Task 6: Dashboard Home — Stats

**Files:**
- Create: `apps/admin/app/(dashboard)/page.tsx`
- Modify: `apps/api/src/modules/admin/router.ts`

**Steps:**
- [ ] Add dashboardStats query (users count, KYC pending, tasks active)
- [ ] Create dashboard page with stat cards
- [ ] Commit

---

### Task 7: Users List Page

**Files:**
- Create: `apps/admin/app/(dashboard)/users/page.tsx`
- Create: `apps/admin/components/users-table.tsx`
- Modify: `apps/api/src/modules/admin/router.ts`

**Steps:**
- [ ] Add listUsers query with pagination, search, filters
- [ ] Create data table with shadcn
- [ ] Add search input and role filter
- [ ] Commit

---

### Task 8: User Details Page

**Files:**
- Create: `apps/admin/app/(dashboard)/users/[id]/page.tsx`
- Modify: `apps/api/src/modules/admin/router.ts`

**Steps:**
- [ ] Add getUser query (profile, tasks, reviews, balance)
- [ ] Create user detail page
- [ ] Add block/unblock actions
- [ ] Add role change dropdown
- [ ] Commit

---

### Task 9: KYC Queue Page

**Files:**
- Create: `apps/admin/app/(dashboard)/kyc/page.tsx`
- Modify: `apps/api/src/modules/admin/router.ts`

**Steps:**
- [ ] Add listPendingKyc query
- [ ] Create KYC queue table (name, phone, submitted date)
- [ ] Link to review page
- [ ] Commit

---

### Task 10: KYC Review Page

**Files:**
- Create: `apps/admin/app/(dashboard)/kyc/[id]/page.tsx`
- Modify: `apps/api/src/modules/admin/router.ts`
- Modify: `apps/api/src/modules/kyc/router.ts`

**Steps:**
- [ ] Add getKycDetails query (signed URLs for documents)
- [ ] Create review page with document viewer
- [ ] Add approve button → approveKyc mutation
- [ ] Add reject button with reason modal → rejectKyc mutation
- [ ] Create KycDecision record for audit
- [ ] Send push notification to tasker
- [ ] Commit

---

## Execution

Este plano tem 10 tasks. Para implementar:

```bash
# Em nova sessão Claude:
"Implementar o plano em docs/superpowers/plans/2026-07-01-admin-panel-fase1.md usando subagent-driven-development"
```

Ou execute task por task manualmente seguindo os steps.
