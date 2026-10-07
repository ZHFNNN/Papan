import { KycStatus } from '@prisma/client';
import { z } from 'zod';
import { invalidateRoleCache } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-user';

const rejectSchema = z.object({
  reason: z.string().min(3, 'Alasan reject wajib diisi')
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if ('error' in admin) {
    return admin.error;
  }

  const body = await request.json();
  const parsed = rejectSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { message: 'Payload tidak valid', errors: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { id } = await params;

  const submission = await prisma.kycSubmission.findUnique({ where: { id } });

  if (!submission) {
    return Response.json({ message: 'Submission tidak ditemukan' }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const kyc = await tx.kycSubmission.update({
      where: { id },
      data: {
        status: KycStatus.REJECTED,
        reviewedAt: new Date(),
        reviewedBy: admin.session.user.id,
        adminNotes: parsed.data.reason
      }
    });

    await tx.user.update({
      where: { id: submission.userId },
      data: { kycStatus: KycStatus.REJECTED }
    });

    return kyc;
  });
  invalidateRoleCache(submission.userId);

  return Response.json({ message: 'KYC ditolak', data: updated });
}
