# Painel Admin Web — Fase 1 (Usuários + KYC)

**Data:** 2026-07-01
**Status:** Aprovado
**Escopo:** Autenticação admin, gestão de usuários, aprovação KYC, dashboard básico

---

## Resumo

Criar painel web administrativo para TRAMPO usando Next.js 14 + shadcn/ui. Fase 1 foca em autenticação separada para admins, gestão de usuários e fluxo de aprovação KYC.

## Decisões Técnicas

| Decisão | Escolha |
|---------|---------|
| Framework | Next.js 14 (App Router) |
| UI | shadcn/ui + Tailwind |
| Localização | `apps/admin` no monorepo |
| Auth | Email/senha separado, JWT 24h |
| API | tRPC client conectando na API existente |

---

## Arquitetura

```
apps/admin/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx       # Form email/senha
│   │   └── layout.tsx           # Layout sem sidebar
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar + header
│   │   ├── page.tsx             # Dashboard home
│   │   ├── users/
│   │   │   ├── page.tsx         # Lista usuários
│   │   │   └── [id]/page.tsx    # Detalhes usuário
│   │   └── kyc/
│   │       ├── page.tsx         # Fila KYC
│   │       └── [id]/page.tsx    # Revisar documento
│   └── api/
│       └── auth/[...nextauth]/  # NextAuth ou custom JWT
├── components/
│   ├── ui/                      # shadcn components
│   ├── sidebar.tsx
│   ├── data-table.tsx
│   └── user-card.tsx
├── lib/
│   ├── trpc.ts                  # tRPC client
│   ├── auth.ts                  # JWT utils
│   └── utils.ts
├── middleware.ts                # Proteção de rotas
├── tailwind.config.ts
└── package.json
```

---

## Modelo de Dados

### Nova tabela: AdminUser

```prisma
model AdminUser {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String   @map("password_hash")
  name         String
  role         AdminRole @default(OPERATOR)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  lastLoginAt  DateTime? @map("last_login_at")

  // Audit trail
  kycDecisions KycDecision[]

  @@map("admin_users")
}

enum AdminRole {
  SUPER_ADMIN  // Tudo
  OPERATOR     // Usuários, KYC, disputas
  VIEWER       // Somente leitura
}

model KycDecision {
  id              String   @id @default(cuid())
  taskerProfileId String   @map("tasker_profile_id") @db.Uuid
  adminUserId     String   @map("admin_user_id")
  decision        KycStatus
  reason          String?
  createdAt       DateTime @default(now()) @map("created_at")

  adminUser     AdminUser     @relation(fields: [adminUserId], references: [id])
  taskerProfile TaskerProfile @relation(fields: [taskerProfileId], references: [id])

  @@map("kyc_decisions")
}
```

---

## Funcionalidades

### 1. Autenticação Admin

**Endpoint:** `POST /api/auth/login`

```typescript
input: { email: string, password: string }
output: { token: string, admin: { id, email, name, role } }
```

- Verifica email/senha contra `AdminUser`
- Gera JWT com 24h expiry
- Armazena em httpOnly cookie
- Middleware valida token em todas as rotas `/dashboard/*`

**Seed inicial:**
```typescript
{
  email: "admin@trampo.app",
  password: "Admin@123", // Hash com bcrypt
  name: "Admin TRAMPO",
  role: "SUPER_ADMIN"
}
```

### 2. Gestão de Usuários

**Lista:** `GET /admin/users`
- Paginação (20 por página)
- Busca: nome, telefone, email
- Filtros: role, isActive
- Ordenação: createdAt, name

**Detalhes:** `GET /admin/users/:id`
- Dados do perfil
- TaskerProfile (se aplicável)
- Histórico de tasks (últimas 10)
- Reviews recebidas
- Saldo disponível (se tasker)
- Status KYC

**Ações:**
- `PATCH /admin/users/:id/block` — Desativa usuário
- `PATCH /admin/users/:id/unblock` — Reativa usuário
- `PATCH /admin/users/:id/role` — Altera role

### 3. Aprovação KYC

**Fila:** `GET /admin/kyc/pending`
- Lista TaskerProfiles com `kycStatus = SUBMITTED`
- Ordenado por data de submissão (mais antigo primeiro)
- Mostra: nome, telefone, data submissão

**Revisar:** `GET /admin/kyc/:taskerProfileId`
- Documento frente (URL assinada, 5min)
- Documento verso (URL assinada, 5min)
- Selfie (URL assinada, 5min)
- Dados do usuário
- Histórico de decisões anteriores

**Aprovar:** `POST /admin/kyc/:id/approve`
- Atualiza `kycStatus = APPROVED`
- Cria registro em `KycDecision`
- Envia push notification ao tasker

**Rejeitar:** `POST /admin/kyc/:id/reject`
- Input: `{ reason: string }`
- Atualiza `kycStatus = REJECTED`
- Cria registro em `KycDecision` com motivo
- Envia push notification com motivo

### 4. Dashboard

**Métricas exibidas:**
- Total usuários (CLIENT, TASKER, BOTH)
- Usuários ativos (último login 7 dias)
- KYC pendentes (badge vermelho se > 0)
- Tasks ativas (OPEN, ACCEPTED, IN_PROGRESS)
- Disputas abertas
- Saques pendentes

**Query otimizada:**
```typescript
// Single query com counts
SELECT
  COUNT(*) FILTER (WHERE role = 'CLIENT') as clients,
  COUNT(*) FILTER (WHERE role = 'TASKER') as taskers,
  COUNT(*) FILTER (WHERE role = 'BOTH') as both,
  ...
FROM users
```

---

## Rotas API (tRPC)

Expandir `apps/api/src/modules/admin/router.ts`:

```typescript
export const adminRouter = router({
  // Auth
  login: publicProcedure.input(loginInput).mutation(...),
  me: adminProcedure.query(...),

  // Users
  listUsers: adminProcedure.input(listUsersInput).query(...),
  getUser: adminProcedure.input(z.object({ id: z.string().uuid() })).query(...),
  blockUser: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(...),
  unblockUser: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(...),
  updateUserRole: adminProcedure.input(updateRoleInput).mutation(...),

  // KYC
  listPendingKyc: adminProcedure.query(...),
  getKycDetails: adminProcedure.input(z.object({ id: z.string().uuid() })).query(...),
  approveKyc: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(...),
  rejectKyc: adminProcedure.input(rejectKycInput).mutation(...),

  // Dashboard
  dashboardStats: adminProcedure.query(...),

  // Existentes (disputas)
  ...existingDisputeRoutes
});
```

---

## UI Components (shadcn)

Instalar:
- `button`, `input`, `label` — Forms
- `card` — Dashboard cards
- `table` — Data tables
- `dialog` — Confirmações
- `badge` — Status tags
- `avatar` — User avatars
- `dropdown-menu` — Ações
- `toast` — Notificações
- `skeleton` — Loading states

---

## Segurança

- Senhas hash com bcrypt (cost 12)
- JWT assinado com secret separado (`ADMIN_JWT_SECRET`)
- Cookies httpOnly, secure, sameSite=strict
- Rate limit: 5 tentativas de login por minuto
- Audit log de ações críticas (block user, KYC decision)
- URLs de documentos KYC expiram em 5 minutos

---

## Fora do Escopo (Fases Futuras)

- Fase 2: Disputas + Tarefas
- Fase 3: Financeiro (pagamentos, saques, reconciliação)
- Fase 4: Categorias CRUD
- Fase 5: Relatórios e Analytics
- Fase 6: Configurações do sistema
