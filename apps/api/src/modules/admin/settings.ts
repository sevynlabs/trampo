import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { TASK_CONSTANTS } from '@trampo/contracts';
import { logAudit } from '../../lib/audit';
import { hashPassword } from './auth';

const SETTINGS_KEY = 'platform';

/** Minimum withdrawal enforced by payments.requestWithdrawal (centavos). */
const WITHDRAWAL_MIN_AMOUNT = 1000;

/**
 * Platform settings stored as JSON in IntegrationSetting(key='platform').
 *
 * NOTE: these are INFORMATIONAL for now. Pricing still uses TASK_CONSTANTS
 * (packages/contracts) and the withdrawal minimum is hard-coded in the
 * payments router; changing these values does NOT change fees, minimums or
 * maintenance behaviour yet. Defaults mirror the real constants.
 */
const percent = z.number().min(0).max(100);
const platformSettingsSchema = z.object({
  platformName: z.string().trim().min(1).max(60).default('Trampo'),
  supportEmail: z.string().trim().email().or(z.literal('')).default(''),
  supportPhone: z.string().trim().max(30).default(''),
  clientFeePercent: percent.default(TASK_CONSTANTS.CLIENT_FEE * 100),
  taskerFeePercent: percent.default(TASK_CONSTANTS.TASKER_FEE * 100),
  urgencyFeePercent: percent.default(TASK_CONSTANTS.URGENCY_FEE * 100),
  minTaskValue: z.number().int().min(0).default(TASK_CONSTANTS.MIN_VALUE),
  withdrawalMinAmount: z.number().int().min(0).default(WITHDRAWAL_MIN_AMOUNT),
  notifications: z
    .object({
      emailOnNewDispute: z.boolean().default(true),
      emailOnKycSubmitted: z.boolean().default(true),
      dailySummary: z.boolean().default(false),
    })
    .default({}),
  maintenanceMode: z.boolean().default(false),
});

export type PlatformSettings = z.infer<typeof platformSettingsSchema>;

const settingsUpdateSchema = platformSettingsSchema
  .omit({ notifications: true })
  .partial()
  .extend({
    notifications: z
      .object({
        emailOnNewDispute: z.boolean(),
        emailOnKycSubmitted: z.boolean(),
        dailySummary: z.boolean(),
      })
      .partial()
      .optional(),
  });

/** Stored JSON merged over defaults; invalid stored fields fall back to defaults. */
export async function getPlatformSettings(): Promise<{
  settings: PlatformSettings;
  updatedAt: string | null;
  updatedById: string | null;
}> {
  const row = await prisma.integrationSetting.findUnique({ where: { key: SETTINGS_KEY } });
  const stored = (row?.value && typeof row.value === 'object' && !Array.isArray(row.value) ? row.value : {}) as Record<
    string,
    unknown
  >;
  const parsed = platformSettingsSchema.safeParse(stored);
  let settings: PlatformSettings;
  if (parsed.success) {
    settings = parsed.data;
  } else {
    // Drop the offending top-level keys and keep the rest.
    const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
    const cleaned = Object.fromEntries(Object.entries(stored).filter(([k]) => !bad.has(k)));
    settings = platformSettingsSchema.parse(cleaned);
  }
  return {
    settings,
    updatedAt: row?.updatedAt.toISOString() ?? null,
    updatedById: row?.updatedById ?? null,
  };
}

const ROLE_INFO = [
  {
    role: 'SUPER_ADMIN' as const,
    label: 'Super administrador',
    description: 'Acesso total, incluindo configurações da plataforma e gestão de administradores.',
    permissions: [
      'Ver todos os módulos e relatórios',
      'Aprovar e reprovar verificações (KYC)',
      'Bloquear usuários e alterar perfis',
      'Gerenciar serviços, solicitações e avaliações',
      'Resolver disputas',
      'Pagar e recusar saques',
      'Criar e enviar campanhas e banners',
      'Exportar relatórios (CSV)',
      'Alterar configurações da plataforma',
      'Criar, promover e desativar administradores',
    ],
  },
  {
    role: 'OPERATOR' as const,
    label: 'Operador',
    description: 'Operação do dia a dia: verificações, usuários, serviços, solicitações, avaliações e disputas.',
    permissions: [
      'Ver todos os módulos e relatórios',
      'Aprovar e reprovar verificações (KYC)',
      'Bloquear usuários e alterar perfis',
      'Gerenciar serviços, solicitações e avaliações',
      'Resolver disputas',
      'Recusar saques',
      'Criar e enviar campanhas e banners',
      'Exportar relatórios (CSV)',
    ],
  },
  {
    role: 'VIEWER' as const,
    label: 'Visualizador',
    description: 'Somente leitura: acompanha painéis, listas e relatórios sem alterar nada.',
    permissions: ['Ver todos os módulos e relatórios', 'Exportar relatórios (CSV)'],
  },
];

const ADMIN_ROLE = z.enum(['SUPER_ADMIN', 'OPERATOR', 'VIEWER']);

function serializeAdmin(a: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    name: a.name,
    email: a.email,
    role: a.role as z.infer<typeof ADMIN_ROLE>,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.AdminUserSelect;

/** "Configurações": platform settings + admin users + role matrix. */
export const settingsAdminRouter = router({
  get: adminAuthProcedure.query(() => getPlatformSettings()),

  update: requireAdminRole('SUPER_ADMIN')
    .input(settingsUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { settings: current } = await getPlatformSettings();
      const next = platformSettingsSchema.parse({
        ...current,
        ...input,
        notifications: { ...current.notifications, ...(input.notifications ?? {}) },
      });

      await prisma.integrationSetting.upsert({
        where: { key: SETTINGS_KEY },
        create: { key: SETTINGS_KEY, value: next as unknown as Prisma.InputJsonValue, updatedById: ctx.admin.id },
        update: { value: next as unknown as Prisma.InputJsonValue, updatedById: ctx.admin.id },
      });

      const changed = Object.fromEntries(
        Object.entries(next).filter(
          ([k, v]) => JSON.stringify(v) !== JSON.stringify((current as Record<string, unknown>)[k])
        )
      );
      await logAudit({
        actorId: ctx.admin.id,
        action: 'settings.update',
        targetType: 'integration_setting',
        targetId: SETTINGS_KEY,
        metadata: { changed: changed as Prisma.InputJsonValue },
      });

      return getPlatformSettings();
    }),

  listAdmins: adminAuthProcedure.query(async () => {
    const admins = await prisma.adminUser.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      select: adminSelect,
    });
    return admins.map(serializeAdmin);
  }),

  updateAdmin: requireAdminRole('SUPER_ADMIN')
    .input(
      z
        .object({ id: z.string().uuid(), role: ADMIN_ROLE.optional(), isActive: z.boolean().optional() })
        .refine((v) => v.role !== undefined || v.isActive !== undefined, 'Nada para alterar')
    )
    .mutation(async ({ ctx, input }) => {
      const target = await prisma.adminUser.findUnique({ where: { id: input.id }, select: adminSelect });
      if (!target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Administrador não encontrado' });

      if (target.id === ctx.admin.id) {
        if (input.isActive === false) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode desativar a própria conta' });
        }
        if (input.role && input.role !== target.role) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Você não pode alterar o próprio papel' });
        }
      }

      const willBeSuper = (input.role ?? target.role) === 'SUPER_ADMIN' && (input.isActive ?? target.isActive);
      const wasActiveSuper = target.role === 'SUPER_ADMIN' && target.isActive;

      const updated = await prisma.$transaction(async (tx) => {
        if (wasActiveSuper && !willBeSuper) {
          const others = await tx.adminUser.count({
            where: { role: 'SUPER_ADMIN', isActive: true, id: { not: target.id } },
          });
          if (others === 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'É preciso manter pelo menos um super administrador ativo',
            });
          }
        }
        return tx.adminUser.update({
          where: { id: input.id },
          data: {
            ...(input.role ? { role: input.role } : {}),
            ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          },
          select: adminSelect,
        });
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'admin_user.update',
        targetType: 'admin_user',
        targetId: target.id,
        metadata: {
          before: { role: target.role, isActive: target.isActive },
          after: { role: updated.role, isActive: updated.isActive },
        },
      });

      return serializeAdmin(updated);
    }),

  createAdmin: requireAdminRole('SUPER_ADMIN')
    .input(
      z.object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().toLowerCase().email(),
        role: ADMIN_ROLE,
        password: z.string().min(10, 'A senha deve ter pelo menos 10 caracteres').max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const exists = await prisma.adminUser.findUnique({ where: { email: input.email }, select: { id: true } });
      if (exists) throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um administrador com este e-mail' });

      const created = await prisma.adminUser.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash: await hashPassword(input.password),
        },
        select: adminSelect,
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'admin_user.create',
        targetType: 'admin_user',
        targetId: created.id,
        metadata: { email: created.email, role: created.role },
      });

      return serializeAdmin(created);
    }),

  roles: adminAuthProcedure.query(() => ROLE_INFO),
});
