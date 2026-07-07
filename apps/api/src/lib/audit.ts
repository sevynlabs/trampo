import { prisma, Prisma } from '@trampo/db';

/**
 * Append a row to the generic admin audit trail. Fire-and-forget safe: a
 * logging failure must never break the action it is recording, so errors are
 * swallowed (and logged to the console) rather than propagated.
 */
export async function logAudit(params: {
  actorId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
        metadata: params.metadata ?? Prisma.JsonNull,
      },
    });
  } catch (err) {
    console.error('[AUDIT] Failed to write audit log', params.action, err);
  }
}
