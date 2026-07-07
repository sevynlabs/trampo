import { z } from 'zod';
import { Prisma } from '@trampo/db';

/**
 * Dynamic audience segment. Resolved to a Prisma `UserWhereInput` at preview
 * and send time — no persisted segment table (MVP). The channel adds a
 * deliverability constraint (push needs a token, email needs an address).
 */
export const segmentSchema = z.object({
  role: z.enum(['ALL', 'CLIENT', 'TASKER', 'BOTH']).default('ALL'),
  kycStatus: z
    .enum(['ANY', 'APPROVED', 'SUBMITTED', 'PENDING', 'REJECTED'])
    .default('ANY'),
  activeWithinDays: z.number().int().min(1).max(365).optional(),
  onlyActive: z.boolean().default(true),
});

export type Segment = z.infer<typeof segmentSchema>;

/** Human-readable description of a segment for display. */
export function describeSegment(s: Segment): string {
  const parts: string[] = [];
  parts.push(
    s.role === 'ALL'
      ? 'Todos os usuários'
      : { CLIENT: 'Clientes', TASKER: 'Profissionais', BOTH: 'Ambos' }[s.role]
  );
  if (s.kycStatus !== 'ANY') parts.push(`KYC ${s.kycStatus}`);
  if (s.activeWithinDays) parts.push(`cadastrados nos últimos ${s.activeWithinDays}d`);
  if (s.onlyActive) parts.push('somente ativos');
  return parts.join(' • ');
}

/**
 * Build the Prisma filter for a segment. `channel` adds the deliverability
 * constraint so preview counts match what will actually be sendable.
 */
export function buildUserWhere(
  s: Segment,
  channel: 'PUSH' | 'EMAIL'
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (s.role !== 'ALL') where.role = s.role;
  if (s.onlyActive) where.isActive = true;
  if (s.activeWithinDays) {
    where.createdAt = {
      gte: new Date(Date.now() - s.activeWithinDays * 24 * 60 * 60 * 1000),
    };
  }
  if (s.kycStatus !== 'ANY') {
    where.taskerProfile = { kycStatus: s.kycStatus };
  }

  // Deliverability: only include users we can actually reach on this channel.
  if (channel === 'PUSH') {
    where.pushToken = { not: null };
  } else {
    where.email = { not: null };
  }

  return where;
}
