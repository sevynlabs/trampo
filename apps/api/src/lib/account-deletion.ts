import { TRPCError } from '@trpc/server';
import { prisma, Prisma } from '@trampo/db';
import { supabase } from './supabase';
import { getAvailableBalance } from '../modules/payments/router';
import { removeOldAvatars } from './avatars';

const KYC_BUCKET = 'kyc-documents';

/** Statuses where money or a job is still in flight — the account can't go away yet. */
const BLOCKING_STATUSES = ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'DISPUTED'] as const;

export type DeletionBlocker = { code: 'ACTIVE_TASKS' | 'BALANCE' | 'PENDING_WITHDRAWAL'; message: string };

/** What stops this user from deleting the account right now (empty = can delete). */
export async function getDeletionBlockers(userId: string): Promise<DeletionBlocker[]> {
  const blockers: DeletionBlocker[] = [];

  const [activeAsClient, activeAsTasker, profile] = await Promise.all([
    prisma.task.count({ where: { clientId: userId, status: { in: [...BLOCKING_STATUSES] } } }),
    prisma.task.count({ where: { assignment: { taskerId: userId }, status: { in: [...BLOCKING_STATUSES] } } }),
    prisma.taskerProfile.findUnique({ where: { userId }, select: { id: true } }),
  ]);

  if (activeAsClient + activeAsTasker > 0) {
    blockers.push({
      code: 'ACTIVE_TASKS',
      message: 'Você tem serviços em andamento. Conclua ou cancele antes de excluir a conta.',
    });
  }

  if (profile) {
    const [available, pending] = await Promise.all([
      getAvailableBalance(userId, profile.id),
      prisma.withdrawal.count({ where: { taskerProfileId: profile.id, status: 'PENDING' } }),
    ]);
    if (available > 0) {
      blockers.push({ code: 'BALANCE', message: 'Você ainda tem saldo. Faça o saque antes de excluir a conta.' });
    }
    if (pending > 0) {
      blockers.push({ code: 'PENDING_WITHDRAWAL', message: 'Há um saque em processamento. Aguarde ele ser concluído.' });
    }
  }

  return blockers;
}

/**
 * Deletes the account (Apple 5.1.1(v) / Google Play account deletion).
 *
 * Personal data and identity documents are erased. Orders, payments and
 * reviews are kept but anonymized: they are financial/tax records the
 * platform must retain (LGPD art. 16, I). The phone number is released, so
 * the person can sign up again later as a brand-new account.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const blockers = await getDeletionBlockers(userId);
  if (blockers.length > 0) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: blockers[0].message });
  }

  const [profile, identity] = await Promise.all([
    prisma.taskerProfile.findUnique({
      where: { userId },
      select: { id: true, documentFrontPath: true, documentBackPath: true, selfiePath: true, criminalRecordPath: true },
    }),
    prisma.identityVerification.findUnique({
      where: { userId },
      select: { documentFrontPath: true, documentBackPath: true, selfiePath: true },
    }),
  ]);

  const files = [
    profile?.documentFrontPath,
    profile?.documentBackPath,
    profile?.selfiePath,
    profile?.criminalRecordPath,
    identity?.documentFrontPath,
    identity?.documentBackPath,
    identity?.selfiePath,
  ].filter((p): p is string => !!p);

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Open requests nobody accepted yet just disappear from the feed
    await tx.task.updateMany({
      where: { clientId: userId, status: 'OPEN' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });

    await tx.notification.deleteMany({ where: { userId } });
    await tx.identityVerification.deleteMany({ where: { userId } });

    if (profile) {
      await tx.taskerProfileCategory.deleteMany({ where: { taskerProfileId: profile.id } });
      await tx.taskerProfile.update({
        where: { id: profile.id },
        data: {
          bio: null,
          pixKey: null,
          documentFrontPath: null,
          documentBackPath: null,
          selfiePath: null,
          criminalRecordPath: null,
        },
      });
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        name: 'Usuário excluído',
        email: null,
        avatarUrl: null,
        phone: `deleted:${userId}`, // frees the real number for a future sign-up
        cpfHash: null,
        cpfEncrypted: null,
        pushToken: null,
        isActive: false, // every existing token stops working (see trpc.ts)
      },
    });
  });

  // Documents live in Storage, outside the DB transaction. A failure here is
  // logged for manual cleanup instead of failing the deletion the user asked for.
  if (files.length > 0) {
    const { error } = await supabase.storage.from(KYC_BUCKET).remove(files);
    if (error) console.error(`[ACCOUNT] KYC files not removed for ${userId}:`, error.message);
  }

  await removeOldAvatars(userId).catch((err) => console.error(`[ACCOUNT] avatars not removed for ${userId}:`, err));

  console.log(`[ACCOUNT] Account deleted: ${userId}`);
}
