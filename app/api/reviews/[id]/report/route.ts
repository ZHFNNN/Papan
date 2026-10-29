import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-user';
import { parseReason } from '@/lib/review-moderation';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// POST /api/reviews/:id/report — body { reason }
// Laporan masuk ke antrean admin (GET /api/admin/review-reports).
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const parsed = parseReason(await request.json().catch(() => null));
  if (!parsed.ok) {
    return Response.json({ message: parsed.error }, { status: 400 });
  }

  const userId = auth.session.user.id;
  const { id: reviewId } = await params;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true },
  });

  if (!review) {
    return Response.json({ message: 'Review tidak ditemukan.' }, { status: 404 });
  }

  if (review.userId === userId) {
    return Response.json({ message: 'Tidak bisa melaporkan review sendiri.' }, { status: 400 });
  }

  const existing = await prisma.reviewReport.findUnique({
    where: { reviewId_reporterId: { reviewId, reporterId: userId } },
    select: { id: true },
  });

  if (existing) {
    return Response.json({ message: 'Kamu sudah melaporkan review ini.' }, { status: 409 });
  }

  await prisma.reviewReport.create({
    data: { reviewId, reporterId: userId, reason: parsed.reason },
  });

  return Response.json({ message: 'Laporan terkirim. Admin akan meninjau review ini.' }, { status: 201 });
}
