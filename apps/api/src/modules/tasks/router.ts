import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { createTaskInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';
import { calculatePrice } from '../../domain/pricing';

export const tasksRouter = router({
  /**
   * Create a new task
   */
  create: protectedProcedure
    .input(createTaskInput)
    .mutation(async ({ ctx, input }) => {
      const { categoryId, title, description, address, location, scheduledAt, isUrgent, baseValue } =
        input;

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
          ${scheduledAt ? new Date(scheduledAt) : null},
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
        throw new Error('Task not found');
      }

      // Check access: must be client or assigned tasker
      const isClient = task.clientId === ctx.user.id;
      const isTasker = task.assignment?.taskerId === ctx.user.id;

      if (!isClient && !isTasker) {
        throw new Error('Access denied');
      }

      return task;
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
});
