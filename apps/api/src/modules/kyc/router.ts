import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { supabase } from '../../lib/supabase';
import { isAdminUser } from '../../lib/admin';

/**
 * Verification has two layers:
 *
 * 1. IDENTITY (every user): document front (+ optional back) and a selfie
 *    holding it. Lives in `identity_verifications`. Once SUBMITTED the user can
 *    already post tasks and hire.
 * 2. PROFESSIONAL (only after "Mudar para conta profissional"): the
 *    criminal-record certificate. Lives in `tasker_profiles` (kycStatus = review
 *    of the certificate). The feed / accepting tasks require BOTH layers
 *    APPROVED by the team (see taskerProcedure).
 */

const KYC_BUCKET = 'kyc-documents';
const IDENTITY_TYPES = ['document_front', 'document_back', 'selfie'] as const;
const DOC_TYPES = z.enum([...IDENTITY_TYPES, 'criminal_record']);
type DocType = z.infer<typeof DOC_TYPES>;
const KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const isTaskerRole = (role: string) => role === 'TASKER' || role === 'BOTH';
const isLocked = (s?: string | null) => s === 'SUBMITTED' || s === 'APPROVED';

let bucketAllowsPdf = false;

/** The bucket was created for images only; the certificate also comes as PDF. */
async function ensureKycBucketAcceptsPdf() {
  if (bucketAllowsPdf) return;
  const { data } = await supabase.storage.getBucket(KYC_BUCKET);
  if (data && !(data.allowed_mime_types ?? []).includes('application/pdf')) {
    const { error } = await supabase.storage.updateBucket(KYC_BUCKET, {
      public: false,
      fileSizeLimit: data.file_size_limit ?? 5 * 1024 * 1024,
      allowedMimeTypes: KYC_MIME_TYPES,
    });
    if (error) throw error;
  }
  bucketAllowsPdf = true;
}

const identityField = {
  document_front: 'documentFrontPath',
  document_back: 'documentBackPath',
  selfie: 'selfiePath',
} as const;

export const kycRouter = router({
  /**
   * Status of both verification layers for the current user.
   * `professional` is null while the account is not a professional one.
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [identity, profile] = await Promise.all([
      prisma.identityVerification.findUnique({ where: { userId: ctx.user.id } }),
      isTaskerRole(ctx.user.role)
        ? prisma.taskerProfile.findUnique({
            where: { userId: ctx.user.id },
            select: {
              kycStatus: true,
              kycSubmittedAt: true,
              kycApprovedAt: true,
              kycRejectReason: true,
              criminalRecordPath: true,
            },
          })
        : null,
    ]);

    return {
      identity: {
        status: identity?.status ?? 'PENDING',
        submittedAt: identity?.submittedAt?.toISOString() ?? null,
        rejectReason: identity?.rejectReason ?? null,
        steps: {
          document: !!identity?.documentFrontPath,
          documentBack: !!identity?.documentBackPath,
          selfie: !!identity?.selfiePath,
        },
      },
      professional: isTaskerRole(ctx.user.role)
        ? {
            status: profile?.kycStatus ?? 'PENDING',
            submittedAt: profile?.kycSubmittedAt?.toISOString() ?? null,
            rejectReason: profile?.kycRejectReason ?? null,
            criminalRecord: !!profile?.criminalRecordPath,
            criminalRecordIsPdf: !!profile?.criminalRecordPath?.endsWith('.pdf'),
          }
        : null,
    };
  }),

  /**
   * Get signed upload URL for Supabase Storage
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        type: DOC_TYPES,
        contentType: z.enum(['image/jpeg', 'image/png', 'application/pdf']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, contentType } = input;
      if (type === 'criminal_record' && !isTaskerRole(ctx.user.role)) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Ative a conta profissional para enviar a certidão' });
      }
      // Only the criminal-record certificate may be a PDF (gov.br issues it as PDF)
      if (contentType === 'application/pdf' && type !== 'criminal_record') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie uma foto (JPG ou PNG)' });
      }
      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'pdf';
      const path = `${ctx.user.id}/${type}_${Date.now()}.${ext}`;

      if (contentType === 'application/pdf') await ensureKycBucketAcceptsPdf();

      // Create signed upload URL (5 min expiry)
      const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUploadUrl(path);

      if (error || !data) {
        console.error('[KYC] Upload URL error:', error);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Falha ao gerar URL de upload' });
      }

      return { uploadUrl: data.signedUrl, token: data.token, path };
    }),

  /**
   * Confirm document uploaded and save path
   */
  confirmUpload: protectedProcedure
    .input(z.object({ type: DOC_TYPES, path: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { type, path } = input;

      // The path must be one we issued to THIS user for THIS document type
      const expected = new RegExp(`^${ctx.user.id}/${type}_[0-9]+[.](jpg|png|pdf)$`);
      if (!expected.test(path)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Caminho de documento inválido' });
      }

      if (type === 'criminal_record') {
        if (!isTaskerRole(ctx.user.role)) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'Ative a conta profissional para enviar a certidão' });
        }
        const current = await prisma.taskerProfile.findUnique({
          where: { userId: ctx.user.id },
          select: { kycStatus: true },
        });
        if (isLocked(current?.kycStatus)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Sua certidão já está em análise ou aprovada' });
        }
        await prisma.taskerProfile.upsert({
          where: { userId: ctx.user.id },
          update: { criminalRecordPath: path },
          create: { userId: ctx.user.id, criminalRecordPath: path },
        });
        return { success: true };
      }

      const current = await prisma.identityVerification.findUnique({
        where: { userId: ctx.user.id },
        select: { status: true },
      });
      if (isLocked(current?.status)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Seus documentos já estão em análise ou aprovados' });
      }
      const field = identityField[type as Exclude<DocType, 'criminal_record'>];
      await prisma.identityVerification.upsert({
        where: { userId: ctx.user.id },
        update: { [field]: path },
        create: { userId: ctx.user.id, [field]: path },
      });

      return { success: true };
    }),

  /**
   * Get signed URL to view a document
   * Users can only view their own documents
   * Admins can view any document
   */
  getViewUrl: protectedProcedure.input(z.object({ path: z.string() })).query(async ({ ctx, input }) => {
    // SECURITY: Verify ownership - path format is "{userId}/{type}_{timestamp}.{ext}"
    const isOwner =
      /^[0-9a-f-]{36}\/(document_front|document_back|selfie|criminal_record)_\d+\.(jpg|png|pdf)$/.test(input.path) &&
      input.path.startsWith(`${ctx.user.id}/`);
    const isAdmin = isAdminUser(ctx.user.id);

    if (!isOwner && !isAdmin) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Você não tem permissão para visualizar este documento' });
    }

    const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(input.path, 60); // 1 min expiry

    if (error) {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }

    return { url: data.signedUrl };
  }),

  /**
   * Send the identity documents for review (every user).
   * From SUBMITTED on, the user can already post tasks and hire.
   */
  submitIdentity: protectedProcedure.mutation(async ({ ctx }) => {
    const identity = await prisma.identityVerification.findUnique({ where: { userId: ctx.user.id } });
    if (isLocked(identity?.status)) return { success: true };

    if (!identity?.documentFrontPath || !identity.selfiePath) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie a frente do documento e a selfie com o documento' });
    }

    await prisma.identityVerification.update({
      where: { userId: ctx.user.id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), rejectReason: null },
    });
    return { success: true };
  }),

  /**
   * Send the professional verification (criminal record) for review.
   * Requires the identity documents to have been sent first.
   */
  submitProfessional: protectedProcedure.mutation(async ({ ctx }) => {
    if (!isTaskerRole(ctx.user.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'Ative a conta profissional primeiro' });
    }
    const [profile, identity] = await Promise.all([
      prisma.taskerProfile.findUnique({ where: { userId: ctx.user.id } }),
      prisma.identityVerification.findUnique({ where: { userId: ctx.user.id }, select: { status: true } }),
    ]);
    if (!profile) throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil profissional não encontrado' });

    // Re-submitting would pull an approved tasker out of APPROVED mid-task
    if (isLocked(profile.kycStatus)) return { success: true };

    if (!isLocked(identity?.status)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie primeiro seus documentos de identidade' });
    }
    if (!profile.criminalRecordPath) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie a certidão de antecedentes criminais' });
    }

    await prisma.taskerProfile.update({
      where: { id: profile.id },
      data: { kycStatus: 'SUBMITTED', kycSubmittedAt: new Date(), kycRejectReason: null },
    });
    return { success: true };
  }),
});
