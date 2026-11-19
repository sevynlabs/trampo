import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, adminAuthProcedure, requireAdminRole } from '../../trpc';
import { prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';

const httpsUrl = z
  .string()
  .trim()
  .url('Informe uma URL válida')
  .refine((u) => /^https?:\/\//i.test(u), 'A URL deve começar com http:// ou https://');

const bannerInput = z.object({
  advertiser: z.string().trim().min(2).max(80),
  title: z.string().trim().min(2).max(120),
  imageUrl: httpsUrl,
  linkUrl: httpsUrl.nullable().optional(),
  sortOrder: z.number().int().min(0).max(999).default(0),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().default(true),
});

function dates(input: { startsAt?: string | null; endsAt?: string | null }) {
  const startsAt = input.startsAt ? new Date(input.startsAt) : null;
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;
  if (startsAt && endsAt && endsAt < startsAt) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A data de fim deve ser depois da de início' });
  }
  return { startsAt, endsAt };
}

function serialize(b: Awaited<ReturnType<typeof prisma.adBanner.findFirstOrThrow>>) {
  return {
    id: b.id,
    advertiser: b.advertiser,
    title: b.title,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    startsAt: b.startsAt?.toISOString() ?? null,
    endsAt: b.endsAt?.toISOString() ?? null,
    impressions: b.impressions,
    clicks: b.clicks,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

/** Back-office CRUD for the advertiser banners shown at the top of the app. */
export const bannersAdminRouter = router({
  list: adminAuthProcedure.query(async () => {
    const banners = await prisma.adBanner.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    return banners.map(serialize);
  }),

  create: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(bannerInput)
    .mutation(async ({ ctx, input }) => {
      const b = await prisma.adBanner.create({
        data: {
          advertiser: input.advertiser,
          title: input.title,
          imageUrl: input.imageUrl,
          linkUrl: input.linkUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          ...dates(input),
        },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'banner.create',
        targetType: 'ad_banner',
        targetId: b.id,
        metadata: { advertiser: b.advertiser, title: b.title },
      });
      return { id: b.id };
    }),

  update: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(bannerInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const b = await prisma.adBanner.update({
        where: { id: input.id },
        data: {
          advertiser: input.advertiser,
          title: input.title,
          imageUrl: input.imageUrl,
          linkUrl: input.linkUrl ?? null,
          sortOrder: input.sortOrder,
          isActive: input.isActive,
          ...dates(input),
        },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'banner.update',
        targetType: 'ad_banner',
        targetId: b.id,
        metadata: { advertiser: b.advertiser, isActive: b.isActive },
      });
      return { id: b.id };
    }),

  toggle: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.adBanner.update({ where: { id: input.id }, data: { isActive: input.isActive } });
      await logAudit({
        actorId: ctx.admin.id,
        action: input.isActive ? 'banner.activate' : 'banner.deactivate',
        targetType: 'ad_banner',
        targetId: input.id,
      });
      return { ok: true };
    }),

  remove: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.adBanner.delete({ where: { id: input.id } });
      await logAudit({ actorId: ctx.admin.id, action: 'banner.delete', targetType: 'ad_banner', targetId: input.id });
      return { ok: true };
    }),
});
