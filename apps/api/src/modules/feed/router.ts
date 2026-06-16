import { z } from 'zod';
import { router, taskerProcedure } from '../../trpc';
import { feedInput } from '@trampo/contracts';
import { prisma } from '@trampo/db';

interface FeedTask {
  id: string;
  title: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  scheduled_at: Date | null;
  is_urgent: boolean;
  base_value: number;
  urgency_fee: number;
  service_fee: number;
  total_value: number;
  tasker_value: number;
  status: string;
  created_at: Date;
  distance_meters: number;
  category_id: string;
  category_name: string;
  category_icon: string | null;
  client_name: string;
}

export const feedRouter = router({
  /**
   * Get nearby tasks for tasker feed
   * Uses PostGIS ST_DWithin for efficient geo queries
   */
  nearby: taskerProcedure
    .input(feedInput)
    .query(async ({ ctx, input }) => {
      const { location, radiusMeters, categoryId, limit, offset } = input;

      // Get tasker's categories
      const taskerCategories = await prisma.taskerProfileCategory.findMany({
        where: { taskerProfileId: ctx.taskerProfile.id },
        select: { categoryId: true },
      });

      const categoryIds = categoryId
        ? [categoryId]
        : taskerCategories.map((c) => c.categoryId);

      if (categoryIds.length === 0) {
        return { tasks: [], total: 0 };
      }

      // Query with PostGIS
      const tasks = await prisma.$queryRaw<FeedTask[]>`
        SELECT
          t.id,
          t.title,
          t.description,
          t.address,
          ST_Y(t.location::geometry) as latitude,
          ST_X(t.location::geometry) as longitude,
          t.scheduled_at,
          t.is_urgent,
          t.base_value,
          t.urgency_fee,
          t.service_fee,
          t.total_value,
          t.tasker_value,
          t.status,
          t.created_at,
          ST_Distance(
            t.location,
            ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography
          ) as distance_meters,
          c.id as category_id,
          c.name as category_name,
          c.icon as category_icon,
          u.name as client_name
        FROM tasks t
        JOIN categories c ON t.category_id = c.id
        JOIN users u ON t.client_id = u.id
        WHERE t.status = 'OPEN'
          AND t.category_id = ANY(${categoryIds}::uuid[])
          AND ST_DWithin(
            t.location,
            ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      // Get total count
      const countResult = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM tasks t
        WHERE t.status = 'OPEN'
          AND t.category_id = ANY(${categoryIds}::uuid[])
          AND ST_DWithin(
            t.location,
            ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
            ${radiusMeters}
          )
      `;

      return {
        tasks: tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          address: t.address,
          location: { latitude: t.latitude, longitude: t.longitude },
          scheduledAt: t.scheduled_at?.toISOString() ?? null,
          isUrgent: t.is_urgent,
          baseValue: t.base_value,
          urgencyFee: t.urgency_fee,
          serviceFee: t.service_fee,
          totalValue: t.total_value,
          taskerValue: t.tasker_value,
          status: t.status,
          createdAt: t.created_at.toISOString(),
          distance: Math.round(t.distance_meters),
          category: {
            id: t.category_id,
            name: t.category_name,
            icon: t.category_icon,
          },
          clientName: t.client_name,
        })),
        total: Number(countResult[0]?.count ?? 0),
      };
    }),

  /**
   * Search tasks by text
   */
  search: taskerProcedure
    .input(
      z.object({
        query: z.string().min(2).max(100),
        location: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }),
        radiusMeters: z.number().default(10000),
      })
    )
    .query(async ({ input }) => {
      const { query, location, radiusMeters } = input;

      const tasks = await prisma.$queryRaw<FeedTask[]>`
        SELECT
          t.id,
          t.title,
          t.description,
          t.tasker_value,
          t.is_urgent,
          c.name as category_name,
          ST_Distance(
            t.location,
            ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography
          ) as distance_meters
        FROM tasks t
        JOIN categories c ON t.category_id = c.id
        WHERE t.status = 'OPEN'
          AND (t.title ILIKE ${'%' + query + '%'} OR t.description ILIKE ${'%' + query + '%'})
          AND ST_DWithin(
            t.location,
            ST_SetSRID(ST_MakePoint(${location.longitude}, ${location.latitude}), 4326)::geography,
            ${radiusMeters}
          )
        ORDER BY distance_meters ASC
        LIMIT 20
      `;

      return tasks;
    }),
});
