import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-user';
import { groupReportsByReview } from '@/lib/review-moderation';

// GET /api/admin/review-reports — review yang punya laporan PENDING beserta alasan dan pelapornya.
// Admin lalu memilih: tolak laporan (PATCH .../dismiss) atau hapus review (DELETE /api/admin/reviews/:id).
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const rows = await prisma.reviewReport.findMany({
    where: { status: 'PENDING' },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      reporter: { select: { id: true, name: true, username: true } },
      review: {
        select: {
          id: true,
          rating: true,
          comment: true,
          imageUrls: true,
          createdAt: true,
          user: { select: { id: true, name: true, username: true, email: true } },
          property: { select: { id: true, title: true } },
        },
      },
    },
  });

  return Response.json({ data: groupReportsByReview(rows) });
}
