import { z } from 'zod';
import { router, adminAuthProcedure } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import {
  periodSchema,
  periodWindows,
  periodSince,
  periodBucket,
  shortCode,
  toNum,
  PAID_STATUSES,
  type Period,
} from './period';

const EXPORT_LIMIT = 10_000;

type Window = { since: Date | null; until: Date };

async function summaryFor(w: Window) {
  const r = { ...(w.since ? { gte: w.since } : {}), lt: w.until };

  const [newUsers, newProfessionals, tasksCreated, tasksCompleted, paid] = await Promise.all([
    prisma.user.count({ where: { createdAt: r } }),
    prisma.taskerProfile.count({ where: { createdAt: r } }),
    prisma.task.count({ where: { createdAt: r } }),
    prisma.task.count({ where: { completedAt: r } }),
    prisma.payment.aggregate({
      where: { status: { in: [...PAID_STATUSES] }, paidAt: r },
      _sum: { amount: true, platformFee: true },
    }),
  ]);

  return {
    newUsers,
    newProfessionals,
    tasksCreated,
    tasksCompleted,
    gmv: toNum(paid._sum.amount),
    platformRevenue: toNum(paid._sum.platformFee),
  };
}

type Summary = Awaited<ReturnType<typeof summaryFor>>;

function growth(cur: Summary, prev: Summary | null) {
  const out = {} as Record<keyof Summary, number | null>;
  for (const k of Object.keys(cur) as (keyof Summary)[]) {
    out[k] = prev && prev[k] !== 0 ? (cur[k] - prev[k]) / prev[k] : null;
  }
  return out;
}

/** Truncate a date to the bucket start in UTC (mirrors Postgres date_trunc). */
function truncUtc(d: Date, bucket: 'day' | 'week' | 'month'): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  if (bucket === 'week') {
    const dow = (x.getUTCDay() + 6) % 7; // Monday = 0 (ISO week, like date_trunc)
    x.setUTCDate(x.getUTCDate() - dow);
  } else if (bucket === 'month') {
    x.setUTCDate(1);
  }
  return x;
}

function nextBucket(d: Date, bucket: 'day' | 'week' | 'month'): Date {
  const x = new Date(d);
  if (bucket === 'day') x.setUTCDate(x.getUTCDate() + 1);
  else if (bucket === 'week') x.setUTCDate(x.getUTCDate() + 7);
  else x.setUTCMonth(x.getUTCMonth() + 1);
  return x;
}

/** All bucket keys (YYYY-MM-DD) from `start` to now, so charts have no gaps. */
function bucketKeys(start: Date, bucket: 'day' | 'week' | 'month'): string[] {
  const keys: string[] = [];
  const end = truncUtc(new Date(), bucket);
  for (let d = truncUtc(start, bucket); d <= end && keys.length < 1000; d = nextBucket(d, bucket)) {
    keys.push(d.toISOString().slice(0, 10));
  }
  return keys;
}

const key = (d: Date) => d.toISOString().slice(0, 10);

// ---- CSV helpers -----------------------------------------------------------

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function fmtDate(d: Date | null | undefined): string {
  return d ? dateFmt.format(d) : '';
}

function fmtMoney(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  // BOM so Excel opens the UTF-8 file with accents intact.
  return '﻿' + [headers, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmado',
  HELD: 'Retido',
  RELEASED: 'Liberado',
  REFUNDED: 'Reembolsado',
  DISPUTED: 'Em disputa',
  EXPIRED: 'Expirado',
};

const TASK_LABEL: Record<string, string> = {
  OPEN: 'Aberta',
  ACCEPTED: 'Aceita',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
  RELEASED: 'Paga',
  CANCELLED: 'Cancelada',
  DISPUTED: 'Em disputa',
};

const ROLE_LABEL: Record<string, string> = { CLIENT: 'Cliente', TASKER: 'Profissional', BOTH: 'Cliente e profissional' };

function createdWhere(period: Period) {
  const since = periodSince(period);
  return since ? { createdAt: { gte: since } } : {};
}

/** "Relatórios": period comparisons, series, breakdowns and CSV exports. */
export const reportsAdminRouter = router({
  summary: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const w = periodWindows(input.period);
      const [current, previous] = await Promise.all([
        summaryFor(w.current),
        w.previous ? summaryFor(w.previous) : Promise.resolve(null),
      ]);
      return {
        period: input.period,
        range: {
          since: w.current.since?.toISOString() ?? null,
          until: w.current.until.toISOString(),
          previousSince: w.previous?.since?.toISOString() ?? null,
          previousUntil: w.previous?.until.toISOString() ?? null,
        },
        current,
        previous,
        growth: growth(current, previous),
      };
    }),

  /** GMV / revenue (paid payments by paidAt) and tasks created, per bucket. */
  revenueSeries: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const since = periodSince(input.period);
      const bucket = periodBucket(input.period);

      const [money, tasks] = await Promise.all([
        prisma.$queryRaw<{ bucket: Date; gmv: bigint | null; revenue: bigint | null }[]>`
          SELECT date_trunc(${bucket}::text, paid_at) AS bucket,
                 COALESCE(SUM(amount), 0)       AS gmv,
                 COALESCE(SUM(platform_fee), 0) AS revenue
          FROM payments
          WHERE paid_at IS NOT NULL
            AND status IN ('CONFIRMED', 'HELD', 'RELEASED')
            AND (${since}::timestamp IS NULL OR paid_at >= ${since}::timestamp)
          GROUP BY 1
        `,
        prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
          SELECT date_trunc(${bucket}::text, created_at) AS bucket, COUNT(*) AS count
          FROM tasks
          WHERE (${since}::timestamp IS NULL OR created_at >= ${since}::timestamp)
          GROUP BY 1
        `,
      ]);

      const map = new Map<string, { gmv: number; revenue: number; tasks: number }>();
      const get = (k: string) => {
        let v = map.get(k);
        if (!v) map.set(k, (v = { gmv: 0, revenue: 0, tasks: 0 }));
        return v;
      };
      for (const r of money) Object.assign(get(key(r.bucket)), { gmv: toNum(r.gmv), revenue: toNum(r.revenue) });
      for (const r of tasks) get(key(r.bucket)).tasks = toNum(r.count);

      const start =
        since ??
        [...money.map((r) => r.bucket), ...tasks.map((r) => r.bucket)].sort((a, b) => a.getTime() - b.getTime())[0];
      const keys = start ? bucketKeys(start, bucket) : [];
      return {
        granularity: bucket,
        points: keys.map((k) => ({ bucket: k, ...(map.get(k) ?? { gmv: 0, revenue: 0, tasks: 0 }) })),
      };
    }),

  /** Tasks created in the period and paid GMV (by paidAt) per category. */
  byCategory: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const since = periodSince(input.period);
      const [categories, tasks, gmv] = await Promise.all([
        prisma.category.findMany({ select: { id: true, name: true } }),
        prisma.task.groupBy({
          by: ['categoryId'],
          where: since ? { createdAt: { gte: since } } : undefined,
          _count: { _all: true },
        }),
        prisma.$queryRaw<{ category_id: string; gmv: bigint | null }[]>`
          SELECT t.category_id, COALESCE(SUM(p.amount), 0) AS gmv
          FROM payments p
          JOIN tasks t ON t.id = p.task_id
          WHERE p.status IN ('CONFIRMED', 'HELD', 'RELEASED')
            AND p.paid_at IS NOT NULL
            AND (${since}::timestamp IS NULL OR p.paid_at >= ${since}::timestamp)
          GROUP BY t.category_id
        `,
      ]);
      const taskMap = new Map(tasks.map((t) => [t.categoryId, t._count._all]));
      const gmvMap = new Map(gmv.map((g) => [g.category_id, toNum(g.gmv)]));
      return categories
        .map((c) => ({
          categoryId: c.id,
          name: c.name,
          tasks: taskMap.get(c.id) ?? 0,
          gmv: gmvMap.get(c.id) ?? 0,
        }))
        .filter((c) => c.tasks > 0 || c.gmv > 0)
        .sort((a, b) => b.gmv - a.gmv || b.tasks - a.tasks);
    }),

  /** New users and new professional profiles per bucket. */
  usersSeries: adminAuthProcedure
    .input(z.object({ period: periodSchema }).default({}))
    .query(async ({ input }) => {
      const since = periodSince(input.period);
      const bucket = periodBucket(input.period);
      const [users, pros] = await Promise.all([
        prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
          SELECT date_trunc(${bucket}::text, created_at) AS bucket, COUNT(*) AS count
          FROM users
          WHERE (${since}::timestamp IS NULL OR created_at >= ${since}::timestamp)
          GROUP BY 1
        `,
        prisma.$queryRaw<{ bucket: Date; count: bigint }[]>`
          SELECT date_trunc(${bucket}::text, created_at) AS bucket, COUNT(*) AS count
          FROM tasker_profiles
          WHERE (${since}::timestamp IS NULL OR created_at >= ${since}::timestamp)
          GROUP BY 1
        `,
      ]);
      const uMap = new Map(users.map((r) => [key(r.bucket), toNum(r.count)]));
      const pMap = new Map(pros.map((r) => [key(r.bucket), toNum(r.count)]));
      const start =
        since ?? [...users.map((r) => r.bucket), ...pros.map((r) => r.bucket)].sort((a, b) => a.getTime() - b.getTime())[0];
      const keys = start ? bucketKeys(start, bucket) : [];
      return {
        granularity: bucket,
        points: keys.map((k) => ({ bucket: k, newUsers: uMap.get(k) ?? 0, newProfessionals: pMap.get(k) ?? 0 })),
      };
    }),

  /**
   * CSV export (`;` separator, pt-BR headers, UTF-8 with BOM, money in reais
   * "1234,56", dates in America/Sao_Paulo). Capped at 10.000 rows. Never
   * includes CPF or KYC document paths.
   */
  exportCsv: adminAuthProcedure
    .input(z.object({ period: periodSchema, kind: z.enum(['payments', 'requests', 'users']) }))
    .query(async ({ input }) => {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `trampo-${input.kind}-${input.period}-${stamp}.csv`;
      const where = createdWhere(input.period);

      if (input.kind === 'payments') {
        const rows = await prisma.payment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: EXPORT_LIMIT,
          select: {
            id: true,
            status: true,
            amount: true,
            platformFee: true,
            taskerAmount: true,
            createdAt: true,
            paidAt: true,
            releasedAt: true,
            refundedAt: true,
            task: { select: { id: true, title: true, category: { select: { name: true } } } },
            user: { select: { name: true } },
          },
        });
        const csv = toCsv(
          ['ID', 'Solicitação', 'Título', 'Categoria', 'Pagador', 'Status', 'Valor (R$)', 'Taxa plataforma (R$)', 'Repasse profissional (R$)', 'Criado em', 'Pago em', 'Liberado em', 'Reembolsado em'],
          rows.map((p) => [
            p.id,
            shortCode(p.task.id),
            p.task.title,
            p.task.category.name,
            p.user.name ?? '',
            PAYMENT_LABEL[p.status] ?? p.status,
            fmtMoney(p.amount),
            fmtMoney(p.platformFee),
            fmtMoney(p.taskerAmount),
            fmtDate(p.createdAt),
            fmtDate(p.paidAt),
            fmtDate(p.releasedAt),
            fmtDate(p.refundedAt),
          ])
        );
        return { filename, csv, rows: rows.length, truncated: rows.length === EXPORT_LIMIT };
      }

      if (input.kind === 'requests') {
        const rows = await prisma.task.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: EXPORT_LIMIT,
          select: {
            id: true,
            title: true,
            status: true,
            isUrgent: true,
            baseValue: true,
            serviceFee: true,
            urgencyFee: true,
            totalValue: true,
            taskerValue: true,
            createdAt: true,
            scheduledAt: true,
            completedAt: true,
            cancelledAt: true,
            category: { select: { name: true } },
            client: { select: { name: true } },
            assignment: { select: { tasker: { select: { name: true } } } },
            payment: { select: { status: true } },
          },
        });
        const csv = toCsv(
          ['Código', 'Título', 'Categoria', 'Cliente', 'Profissional', 'Status', 'Urgente', 'Valor base (R$)', 'Taxa de serviço (R$)', 'Taxa de urgência (R$)', 'Total (R$)', 'Repasse profissional (R$)', 'Pagamento', 'Criada em', 'Agendada para', 'Concluída em', 'Cancelada em'],
          rows.map((t) => [
            shortCode(t.id),
            t.title,
            t.category.name,
            t.client.name ?? '',
            t.assignment?.tasker.name ?? '',
            TASK_LABEL[t.status] ?? t.status,
            t.isUrgent ? 'Sim' : 'Não',
            fmtMoney(t.baseValue),
            fmtMoney(t.serviceFee),
            fmtMoney(t.urgencyFee),
            fmtMoney(t.totalValue),
            fmtMoney(t.taskerValue),
            t.payment ? (PAYMENT_LABEL[t.payment.status] ?? t.payment.status) : '',
            fmtDate(t.createdAt),
            fmtDate(t.scheduledAt),
            fmtDate(t.completedAt),
            fmtDate(t.cancelledAt),
          ])
        );
        return { filename, csv, rows: rows.length, truncated: rows.length === EXPORT_LIMIT };
      }

      const rows = await prisma.user.findMany({
        where: where as Prisma.UserWhereInput,
        orderBy: { createdAt: 'desc' },
        take: EXPORT_LIMIT,
        select: {
          id: true,
          publicCode: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          identity: { select: { status: true } },
          taskerProfile: { select: { kycStatus: true, rating: true, totalTasks: true } },
        },
      });
      const csv = toCsv(
        ['ID', 'Código público', 'Nome', 'E-mail', 'Telefone', 'Perfil', 'Ativo', 'Identidade', 'Verificação profissional', 'Nota', 'Trampos concluídos', 'Cadastrado em'],
        rows.map((u) => [
          u.id,
          u.publicCode,
          u.name ?? '',
          u.email ?? '',
          u.phone,
          ROLE_LABEL[u.role] ?? u.role,
          u.isActive ? 'Sim' : 'Não',
          u.identity?.status ?? 'PENDING',
          u.taskerProfile?.kycStatus ?? '',
          u.taskerProfile ? u.taskerProfile.rating.toFixed(2).replace('.', ',') : '',
          u.taskerProfile?.totalTasks ?? '',
          fmtDate(u.createdAt),
        ])
      );
      return { filename, csv, rows: rows.length, truncated: rows.length === EXPORT_LIMIT };
    }),
});
