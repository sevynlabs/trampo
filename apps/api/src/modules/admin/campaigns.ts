import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  router,
  adminAuthProcedure,
  requireAdminRole,
} from '../../trpc';
import { prisma } from '@trampo/db';
import { logAudit } from '../../lib/audit';
import { sendPushNotification } from '../../integrations/push';
import { sendEmail, renderTemplate, emailMode } from '../../integrations/email';
import { segmentSchema, buildUserWhere, describeSegment } from './segments';

const CHANNEL = z.enum(['PUSH', 'EMAIL']);

/**
 * Campaign management: reusable email templates, audience preview, and
 * push/email campaigns. Sending happens inline (MVP) — fine at current scale;
 * a Redis worker can take over later without changing the data model.
 */
export const campaignsRouter = router({
  /** Reports whether email is really sending or running in dev (logged) mode. */
  emailStatus: adminAuthProcedure.query(() => ({ mode: emailMode })),

  // ---- Email templates ----------------------------------------------------

  listTemplates: adminAuthProcedure.query(async () => {
    const templates = await prisma.emailTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      isActive: t.isActive,
      updatedAt: t.updatedAt.toISOString(),
    }));
  }),

  createTemplate: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        name: z.string().trim().min(2),
        subject: z.string().trim().min(2),
        bodyHtml: z.string().trim().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const t = await prisma.emailTemplate.create({ data: input });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'template.create',
        targetType: 'emailTemplate',
        targetId: t.id,
        metadata: { name: t.name },
      });
      return { id: t.id };
    }),

  updateTemplate: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().trim().min(2),
        subject: z.string().trim().min(2),
        bodyHtml: z.string().trim().min(2),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await prisma.emailTemplate.update({ where: { id }, data });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'template.update',
        targetType: 'emailTemplate',
        targetId: id,
      });
      return { id };
    }),

  deleteTemplate: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await prisma.emailTemplate.delete({ where: { id: input.id } });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'template.delete',
        targetType: 'emailTemplate',
        targetId: input.id,
      });
      return { id: input.id };
    }),

  // ---- Audience preview ---------------------------------------------------

  /** Resolve a segment to a reachable-recipient count + a small sample. */
  previewSegment: adminAuthProcedure
    .input(z.object({ channel: CHANNEL, segment: segmentSchema }))
    .query(async ({ input }) => {
      const where = buildUserWhere(input.segment, input.channel);
      const [count, sample] = await Promise.all([
        prisma.user.count({ where }),
        prisma.user.findMany({
          where,
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: { id: true, name: true, email: true },
        }),
      ]);
      return {
        count,
        description: describeSegment(input.segment),
        sample: sample.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
      };
    }),

  // ---- Campaigns ----------------------------------------------------------

  list: adminAuthProcedure.query(async () => {
    const campaigns = await prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      channel: c.channel,
      status: c.status,
      recipientCount: c.recipientCount,
      sentCount: c.sentCount,
      failedCount: c.failedCount,
      sentAt: c.sentAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
    }));
  }),

  get: adminAuthProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const c = await prisma.campaign.findUnique({ where: { id: input.id } });
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campanha não encontrada' });
      const segment = segmentSchema.parse(c.segment);
      return {
        id: c.id,
        name: c.name,
        channel: c.channel,
        status: c.status,
        title: c.title,
        body: c.body,
        segment,
        segmentDescription: describeSegment(segment),
        recipientCount: c.recipientCount,
        sentCount: c.sentCount,
        failedCount: c.failedCount,
        sentAt: c.sentAt?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
      };
    }),

  create: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(
      z.object({
        name: z.string().trim().min(2),
        channel: CHANNEL,
        segment: segmentSchema,
        title: z.string().trim().min(2),
        body: z.string().trim().min(2),
        emailTemplateId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const c = await prisma.campaign.create({
        data: {
          name: input.name,
          channel: input.channel,
          segment: input.segment,
          title: input.title,
          body: input.body,
          emailTemplateId: input.emailTemplateId ?? null,
          createdById: ctx.admin.id,
          status: 'DRAFT',
        },
      });
      await logAudit({
        actorId: ctx.admin.id,
        action: 'campaign.create',
        targetType: 'campaign',
        targetId: c.id,
        metadata: { channel: c.channel, name: c.name },
      });
      return { id: c.id };
    }),

  /** Resolve the segment, deliver to every recipient, and record metrics. */
  send: requireAdminRole('SUPER_ADMIN', 'OPERATOR')
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const c = await prisma.campaign.findUnique({ where: { id: input.id } });
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Campanha não encontrada' });
      if (c.status === 'SENDING' || c.status === 'SENT')
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Campanha já está ${c.status}`,
        });

      const segment = segmentSchema.parse(c.segment);
      const where = buildUserWhere(segment, c.channel);
      const users = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true },
      });

      await prisma.campaign.update({
        where: { id: c.id },
        data: { status: 'SENDING', recipientCount: users.length },
      });

      let sent = 0;
      let failed = 0;

      for (const u of users) {
        const vars = { name: u.name ?? 'você' };
        let ok = false;
        let error: string | null = null;

        try {
          if (c.channel === 'PUSH') {
            ok = await sendPushNotification(u.id, {
              title: renderTemplate(c.title, vars),
              body: renderTemplate(c.body, vars),
              data: { type: 'campaign', campaignId: c.id },
            });
            // Also persist an in-app notification so it shows in the center.
            await prisma.notification.create({
              data: {
                userId: u.id,
                type: 'campaign',
                title: renderTemplate(c.title, vars),
                body: renderTemplate(c.body, vars),
                data: { campaignId: c.id },
              },
            });
            if (!ok) error = 'Sem push token';
          } else {
            const res = await sendEmail({
              to: u.email!,
              subject: renderTemplate(c.title, vars),
              html: renderTemplate(c.body, vars, { html: true }),
            });
            ok = res.ok;
            error = res.error ?? null;
          }
        } catch (err) {
          ok = false;
          error = (err as Error).message;
        }

        if (ok) sent++;
        else failed++;

        await prisma.campaignRecipient.upsert({
          where: { campaignId_userId: { campaignId: c.id, userId: u.id } },
          create: {
            campaignId: c.id,
            userId: u.id,
            status: ok ? 'SENT' : 'FAILED',
            error,
            sentAt: ok ? new Date() : null,
          },
          update: {
            status: ok ? 'SENT' : 'FAILED',
            error,
            sentAt: ok ? new Date() : null,
          },
        });
      }

      const updated = await prisma.campaign.update({
        where: { id: c.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          sentCount: sent,
          failedCount: failed,
        },
      });

      await logAudit({
        actorId: ctx.admin.id,
        action: 'campaign.send',
        targetType: 'campaign',
        targetId: c.id,
        metadata: { channel: c.channel, recipients: users.length, sent, failed },
      });

      return {
        id: updated.id,
        recipientCount: updated.recipientCount,
        sentCount: sent,
        failedCount: failed,
      };
    }),
});
