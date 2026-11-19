import { z } from 'zod';
import { router, publicProcedure, withRateLimit } from '../../trpc';
import { prisma } from '@trampo/db';

/** Banners currently allowed on air: active and inside their date window. */
export function liveBannersWhere(now = new Date()) {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

/**
 * Advertiser banners for the carousel at the top of the app's home.
 * Read-only for the app; managed in the admin panel (admin.banners.*).
 */
export const bannersRouter = router({
  list: publicProcedure.query(async () => {
    const banners = await prisma.adBanner.findMany({
      where: liveBannersWhere(),
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 8,
      select: { id: true, advertiser: true, title: true, imageUrl: true, linkUrl: true },
    });

    // Count one impression per banner each time the carousel loads.
    if (banners.length) {
      prisma.adBanner
        .updateMany({ where: { id: { in: banners.map((b) => b.id) } }, data: { impressions: { increment: 1 } } })
        .catch(() => {});
    }
    return banners;
  }),

  /** Register a tap on a banner (rate-limited per user/IP). */
  click: publicProcedure
    .use(withRateLimit(30, 60))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await prisma.adBanner.updateMany({ where: { id: input.id }, data: { clicks: { increment: 1 } } });
      return { ok: true };
    }),
});
