import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { createTaskInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { calculatePrice } from '../../domain/pricing';

const URGENT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Validates scheduledAt and derives the urgency flag server-side.
 * A task scheduled less than 1h ahead is always urgent (+30%), regardless of
 * what the client sent; a client may still opt into urgency voluntarily.
 */
function resolveSchedule(scheduledAt: string | undefined, isUrgent: boolean) {
  if (!scheduledAt) return { scheduledAt: null, isUrgent };
  const date = new Date(scheduledAt);
  const msAhead = date.getTime() - Date.now();
  if (msAhead < -5 * 60 * 1000) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'A data agendada precisa ser no futuro',
    });
  }
  return { scheduledAt: date, isUrgent: isUrgent || msAhead < URGENT_WINDOW_MS };
}

export const tasksRouter = router({
  /**
   * Create a new task
   */
  create: protectedProcedure
    .input(createTaskInput)
    .mutation(async ({ ctx, input }) => {
      const { categoryId, title, description, address, location, baseValue } = input;
      const { scheduledAt, isUrgent } = resolveSchedule(input.scheduledAt, input.isUrgent);

      // ALWAYS recalculate price server-side
      const price = calculatePrice(baseValue, isUrgent);

      // Create task with PostGIS point
      const task = await prisma.$queryRaw<{ id: string }[]>`
        INSERT INTO tasks (
          client_id, category_id, title, description, address,
          location, scheduled_at, is_urgent,
          base_value, urgency_fee, service_fee, total_value, tasker_value,
          status, created_at, updated_at
        ) VALUES (
          ${ctx.user.id}::uuid,
          ${categoryId}::uuid,
          ${title},
          ${description},
          ${address},
          ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
          ${scheduledAt},
          ${isUrgent},
          ${price.baseValue},
          ${price.urgencyFee},
          ${price.serviceFee},
          ${price.totalValue},
          ${price.taskerValue},
          'OPEN',
          NOW(),
          NOW()
        )
        RETURNING id
      `;

      return { id: task[0].id, ...price };
    }),

  /**
   * Edit an open task (client owner only). Pricing is always recalculated.
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(5).max(200),
        description: z.string().max(1000).optional(),
        baseValue: z.number().int().min(5000).max(10_000_000), // R$ 50,00 - R$ 100.000,00
        isUrgent: z.boolean(),
        scheduledAt: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        select: {
          clientId: true,
          status: true,
          scheduledAt: true,
          payment: { select: { status: true } },
        },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }
      if (task.clientId !== ctx.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }
      if (task.status !== 'OPEN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Só é possível editar trampos que ainda estão abertos',
        });
      }

      // A paid task keeps its price: the charge was made for that amount.
      if (task.payment && task.payment.status !== 'EXPIRED') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este trampo já tem pagamento e não pode mais ser editado',
        });
      }

      // Omitting scheduledAt keeps the current schedule instead of wiping it.
      const schedule = resolveSchedule(
        input.scheduledAt ?? task.scheduledAt?.toISOString(),
        input.isUrgent
      );
      const price = calculatePrice(input.baseValue, schedule.isUrgent);

      // Guarded write: fails if the task was accepted in the meantime
      const updated = await prisma.task.updateMany({
        where: { id: input.id, clientId: ctx.user.id, status: 'OPEN' },
        data: {
          title: input.title,
          description: input.description ?? null,
          isUrgent: schedule.isUrgent,
          baseValue: price.baseValue,
          urgencyFee: price.urgencyFee,
          serviceFee: price.serviceFee,
          totalValue: price.totalValue,
          taskerValue: price.taskerValue,
          scheduledAt: schedule.scheduledAt,
        },
      });
      if (updated.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'O trampo foi aceito enquanto você editava',
        });
      }

      return { id: input.id, ...price };
    }),

  /**
   * Get task by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await prisma.task.findUnique({
        where: { id: input.id },
        include: {
          category: true,
          client: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          assignment: {
            include: {
              tasker: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
          payment: true,
        },
      });

      if (!task) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Trampo não encontrado' });
      }

      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (isClient || isTasker) {
        return task;
      }

      // Open tasks are visible to any tasker (they already appear in the feed),
      // so they can review and accept them. Payment data is never exposed.
      if (task.status === 'OPEN') {
        const profile = await prisma.taskerProfile.findUnique({
          where: { userId: ctx.user.id },
          select: { id: true },
        });
        if (profile) {
          return { ...task, payment: null };
        }
      }

      throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
    }),

  /**
   * List tasks for current user (as client)
   */
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const tasks = await prisma.task.findMany({
      where: { clientId: ctx.user.id },
      include: {
        category: true,
        assignment: {
          include: {
            tasker: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return tasks;
  }),

  /**
   * List tasks assigned to the current user (as tasker)
   */
  listAssigned: protectedProcedure.query(async ({ ctx }) => {
    return prisma.task.findMany({
      where: { assignment: { taskerId: ctx.user.id } },
      include: {
        category: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }),
});
