import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, adminAuthProcedure } from '../../trpc';
import { prisma } from '@trampo/db';
import { supabase } from '../../lib/supabase';
import { isAdminUser } from '../../lib/admin';

const KYC_BUCKET = 'kyc-documents';
const DOC_TYPES = z.enum(['document_front', 'document_back', 'selfie', 'criminal_record']);
const KYC_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
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

export const kycRouter = router({
  /**
   * Get KYC status
   */
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
      select: {
        kycStatus: true,
        kycSubmittedAt: true,
        kycApprovedAt: true,
        kycRejectedAt: true,
        kycRejectReason: true,
        documentFrontPath: true,
        documentBackPath: true,
        selfiePath: true,
        criminalRecordPath: true,
      },
    });

    if (!profile) {
      return {
        status: 'PENDING' as const,
        steps: { cpf: true, document: false, selfie: false, criminalRecord: false },
      };
    }

    return {
      status: profile.kycStatus,
      submittedAt: profile.kycSubmittedAt?.toISOString(),
      approvedAt: profile.kycApprovedAt?.toISOString(),
      rejectedAt: profile.kycRejectedAt?.toISOString(),
      rejectReason: profile.kycRejectReason,
      steps: {
        cpf: true,
        document: !!profile.documentFrontPath,
        selfie: !!profile.selfiePath,
        criminalRecord: !!profile.criminalRecordPath,
      },
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
      // Only the criminal-record certificate may be a PDF (gov.br issues it as PDF)
      if (contentType === 'application/pdf' && type !== 'criminal_record') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Envie uma foto (JPG ou PNG)' });
      }
      const ext = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'pdf';
      const path = `${ctx.user.id}/${type}_${Date.now()}.${ext}`;

      if (contentType === 'application/pdf') await ensureKycBucketAcceptsPdf();

      // Create signed upload URL (5 min expiry)
      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .createSignedUploadUrl(path);

      if (error || !data) {
        console.error('[KYC] Upload URL error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Falha ao gerar URL de upload',
        });
      }

      return {
        uploadUrl: data.signedUrl,
        token: data.token,
        path,
      };
    }),

  /**
   * Confirm document uploaded and save path
   */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        type: DOC_TYPES,
        path: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, path } = input;

      // The path must be one we issued to THIS user for THIS document type
      const expected = new RegExp(`^${ctx.user.id}/${type}_[0-9]+[.](jpg|png|pdf)$`);
      if (!expected.test(path)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Caminho de documento inválido' });
      }

      // Documents are frozen while under review or after approval
      const current = await prisma.taskerProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { kycStatus: true },
      });
      if (current && (current.kycStatus === 'SUBMITTED' || current.kycStatus === 'APPROVED')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Seus documentos já estão em análise ou aprovados',
        });
      }

      const fieldMap = {
        document_front: 'documentFrontPath',
        document_back: 'documentBackPath',
        selfie: 'selfiePath',
        criminal_record: 'criminalRecordPath',
      } as const;

      await prisma.taskerProfile.upsert({
        where: { userId: ctx.user.id },
        update: { [fieldMap[type]]: path },
        create: { userId: ctx.user.id, [fieldMap[type]]: path },
      });

      return { success: true };
    }),

  /**
   * Get signed URL to view a document
   * Users can only view their own documents
   * Admins can view any document
   */
  getViewUrl: protectedProcedure
    .input(z.object({ path: z.string() }))
    .query(async ({ ctx, input }) => {
      // SECURITY: Verify ownership - path format is "{userId}/{type}_{timestamp}.{ext}"
      const isOwner = /^[0-9a-f-]{36}\/(document_front|document_back|selfie|criminal_record)_\d+\.(jpg|png|pdf)$/.test(input.path) &&
        input.path.startsWith(`${ctx.user.id}/`);
      const isAdmin = isAdminUser(ctx.user.id);

      if (!isOwner && !isAdmin) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Você não tem permissão para visualizar este documento',
        });
      }

      const { data, error } = await supabase.storage
        .from(KYC_BUCKET)
        .createSignedUrl(input.path, 60); // 1 min expiry

      if (error) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      return { url: data.signedUrl };
    }),

  /**
   * Submit KYC for review
   */
  submit: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!profile) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Perfil não encontrado' });
    }

    // Re-submitting would pull an approved tasker out of APPROVED mid-task
    if (profile.kycStatus === 'SUBMITTED' || profile.kycStatus === 'APPROVED') {
      return { success: true };
    }

    if (!profile.documentFrontPath || !profile.selfiePath) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Envie todos os documentos obrigatórios',
      });
    }
    if (!profile.criminalRecordPath) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Envie a certidão de antecedentes criminais',
      });
    }

    await prisma.taskerProfile.update({
      where: { id: profile.id },
      data: { kycStatus: 'SUBMITTED', kycSubmittedAt: new Date() },
    });

    return { success: true };
  }),
});
