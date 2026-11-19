import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma, Prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';
import { toNum } from './period';

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use apenas letras minúsculas, números e hífens');

const baseFields = {
  name: z.string().trim().min(2).max(80),
  slug: slugSchema.optional(),
  icon: z.string().trim().max(60).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
};

async function assertSlugFree(slug: string, exceptId?: string) {
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw new TRPCError({ code: 'CONFLICT', message: 'Já existe um serviço com este slug' });
  }
}

/**
 * "Serviços" of the platform = task categories. CRUD + per-category metrics.
 * Money in centavos.
 */
export const servicesAdminRouter = router({
  list: adminAuthProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(120).optional(),
          status: z.enum(['all', 'active', 'inactive']).default('all'),
        })
        .default({})
    )
    .query(async ({ input }) => {
      const where: Prisma.CategoryWhereInput = {};
      if (input.search) {
        where.OR = [
          { name: { contains: input.search, mode: 'insensitive' } },
          { slug: { contains: input.search, mode: 'insensitive' } },
        ];
      }
      if (input.status === 'active') where.isActive = true;
      if (input.status === 'inactive') where.isActive = false;

      const categories = await prisma.category.findMany({
        where,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { taskerProfiles: true, tasks: true } } },
      });
      const ids = categories.map((c) => c.id);
      if (ids.length === 0) return [];

      const [taskAgg, completedAgg, gmvRows] = await Promise.all([
        prisma.task.groupBy({
          by: ['categoryId'],
          where: { categoryId: { in: ids } },
          _avg: { totalValue: true },
        }),
        prisma.task.groupBy({
          by: ['categoryId'],
          where: { categoryId: { in: ids }, status: { in: ['COMPLETED', 'RELEASED'] } },
          _count: { _all: true },
        }),
        prisma.$queryRaw<{ category_id: string; gmv: bigint | null }[]>`
          SELECT t.category_id, COALESCE(SUM(p.amount), 0) AS gmv
          FROM payments p
          JOIN tasks t ON t.id = p.task_id
          WHERE p.status IN ('CONFIRMED', 'HELD', 'RELEASED')
          GROUP BY t.category_id
        `,
      ]);

      const avgMap = new Map(taskAgg.map((a) => [a.categoryId, a._avg.totalValue ?? 0]));
      const completedMap = new Map(completedAgg.map((a) => [a.categoryId, a._count._all]));
      const gmvMap = new Map(gmvRows.map((r) => [r.category_id, toNum(r.gmv)]));

      return categories.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.name,
        icon: c.icon,
        description: c.description,
        isActive: c.isActive,
        sortOrder: c.sortOrder,
        professionalsCount: c._count.taskerProfiles,
        tasksCount: c._count.tasks,
        completedTasksCount: completedMap.get(c.id) ?? 0,
        avgTicket: Math.round(avgMap.get(c.id) ?? 0),
        gmv: gmvMap.get(c.id) ?? 0,
        createdAt: c.createdAt.toISOString(),
      }));
    }),

  create: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object(baseFields))
    .mutation(async ({ ctx, input }) => {
      const slug = input.slug ?? slugify(input.name);
      if (!slug) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Não foi possível gerar o slug' });
      await assertSlugFree(slug);

      let sortOrder = input.sortOrder;
      if (sortOrder === undefined) {
        const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
        sortOrder = (last._max.sortOrder ?? 0) + 1;
      }

      const c = await prisma.category.create({
        data: {
          name: input.name,
          slug,
          icon: input.icon ?? null,
          description: input.description ?? null,
          sortOrder,
          isActive: input.isActive ?? true,
        },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'category.create',
        targetType: 'category',
        targetId: c.id,
        metadata: { name: c.name, slug: c.slug },
      });
      return { id: c.id, slug: c.slug };
    }),

  update: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        id: z.string().uuid(),
        name: baseFields.name.optional(),
        slug: baseFields.slug,
        icon: baseFields.icon,
        description: baseFields.description,
        sortOrder: baseFields.sortOrder,
        isActive: baseFields.isActive,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await prisma.category.findUnique({ where: { id } });
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
      if (data.slug && data.slug !== existing.slug) await assertSlugFree(data.slug, id);

      const c = await prisma.category.update({ where: { id }, data });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'category.update',
        targetType: 'category',
        targetId: c.id,
        metadata: { changes: data as Prisma.InputJsonValue },
      });
      return { id: c.id, slug: c.slug };
    }),

  toggle: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const c = await prisma.category.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: input.isActive ? 'category.activate' : 'category.deactivate',
        targetType: 'category',
        targetId: c.id,
        metadata: { name: c.name },
      });
      return { id: c.id, isActive: c.isActive };
    }),

  /** Hard delete, only allowed while the category has no tasks. */
  remove: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const c = await prisma.category.findUnique({
        where: { id: input.id },
        include: { _count: { select: { tasks: true } } },
      });
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Serviço não encontrado' });
      if (c._count.tasks > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este serviço já tem solicitações e não pode ser excluído. Desative-o em vez disso.',
        });
      }
      await prisma.category.delete({ where: { id: input.id } });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'category.delete',
        targetType: 'category',
        targetId: c.id,
        metadata: { name: c.name, slug: c.slug },
      });
      return { success: true };
    }),
});
