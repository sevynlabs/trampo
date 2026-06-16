import { z } from 'zod';
import { router, protectedProcedure } from '../../trpc';
import { prisma } from '@trampo/db';

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
      },
    });

    if (!profile) {
      return {
        status: 'PENDING' as const,
        steps: {
          cpf: true, // Always done via profile
          document: false,
          selfie: false,
        },
      };
    }

    return {
      status: profile.kycStatus,
      submittedAt: profile.kycSubmittedAt,
      approvedAt: profile.kycApprovedAt,
      rejectedAt: profile.kycRejectedAt,
      rejectReason: profile.kycRejectReason,
      steps: {
        cpf: true,
        document: !!profile.documentFrontPath,
        selfie: !!profile.selfiePath,
      },
    };
  }),

  /**
   * Upload document (returns signed URL for Supabase Storage)
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        type: z.enum(['document_front', 'document_back', 'selfie']),
        contentType: z.enum(['image/jpeg', 'image/png']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, contentType } = input;

      // Generate unique path in private bucket
      const ext = contentType === 'image/jpeg' ? 'jpg' : 'png';
      const path = `kyc/${ctx.user.id}/${type}_${Date.now()}.${ext}`;

      // TODO: Generate signed upload URL from Supabase Storage
      // For now, return mock URL
      const uploadUrl = `https://storage.supabase.co/upload/${path}`;

      return {
        uploadUrl,
        path,
        expiresIn: 300, // 5 minutes
      };
    }),

  /**
   * Confirm document uploaded
   */
  confirmUpload: protectedProcedure
    .input(
      z.object({
        type: z.enum(['document_front', 'document_back', 'selfie']),
        path: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { type, path } = input;

      // Map type to field
      const fieldMap = {
        document_front: 'documentFrontPath',
        document_back: 'documentBackPath',
        selfie: 'selfiePath',
      } as const;

      // Update profile
      await prisma.taskerProfile.upsert({
        where: { userId: ctx.user.id },
        update: { [fieldMap[type]]: path },
        create: {
          userId: ctx.user.id,
          [fieldMap[type]]: path,
        },
      });

      return { success: true };
    }),

  /**
   * Submit KYC for review
   */
  submit: protectedProcedure.mutation(async ({ ctx }) => {
    const profile = await prisma.taskerProfile.findUnique({
      where: { userId: ctx.user.id },
    });

    if (!profile) {
      throw new Error('Profile not found');
    }

    // Validate all required documents
    if (!profile.documentFrontPath || !profile.selfiePath) {
      throw new Error('Missing required documents');
    }

    // Update status
    await prisma.taskerProfile.update({
      where: { id: profile.id },
      data: {
        kycStatus: 'SUBMITTED',
        kycSubmittedAt: new Date(),
      },
    });

    return { success: true, message: 'KYC submitted for review' };
  }),
});
