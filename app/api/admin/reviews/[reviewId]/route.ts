import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-user';
import { parseRemovalReason, reviewRemovedNotification } from '@/lib/review-moderation';

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

// DELETE /api/admin/reviews/:reviewId — body { reason }
// Admin menghapus review lalu penulisnya diberi tahu alasannya lewat notifikasi.
export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const parsed = parseRemovalReason(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ message: parsed.error }, { status: 400 });
  }

  const { reviewId } = await params;
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, property: { select: { title: true } } },
  });

  if (!review) {
    return Response.json({ message: 'Review tidak ditemukan.' }, { status: 404 });
  }

  // Balasan review ikut terhapus lewat onDelete: Cascade di ReviewReply.
  await prisma.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } });
    await tx.notification.create({
      data: {
        ownerId: review.userId,
        ...reviewRemovedNotification(review.property.title, parsed.reason),
      },
    });
  });

  return Response.json({ message: 'Review berhasil dihapus.' });
}
