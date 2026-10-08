import { KycStatus } from "@prisma/client";
import { invalidateRoleCache } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdmin();
  if ("error" in admin) {
    return admin.error;
  }

  const { id } = await params;

  const submission = await prisma.kycSubmission.findUnique({ where: { id } });

  if (!submission) {
    return Response.json({ message: "Submission tidak ditemukan" }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const kyc = await tx.kycSubmission.update({
      where: { id },
      data: {
        status: KycStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: admin.session.user.id,
        adminNotes: null
      }
    });

    await tx.user.update({
      where: { id: submission.userId },
      data: { kycStatus: KycStatus.APPROVED }
    });

    return kyc;
  });
  invalidateRoleCache(submission.userId);

  return Response.json({ message: "KYC disetujui", data: updated });
}
