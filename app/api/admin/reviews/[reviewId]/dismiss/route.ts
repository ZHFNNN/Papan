import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-user';

type RouteContext = {
  params: Promise<{ reviewId: string }>;
};

// PATCH /api/admin/reviews/:reviewId/dismiss — admin menolak semua laporan PENDING, review tetap tampil.
export async function PATCH(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { reviewId } = await params;
  const { count } = await prisma.reviewReport.updateMany({
    where: { reviewId, status: 'PENDING' },
    data: { status: 'DISMISSED' },
  });

  if (count === 0) {
    return Response.json({ message: 'Tidak ada laporan yang menunggu untuk review ini.' }, { status: 404 });
  }

  return Response.json({ message: 'Laporan ditolak. Review tetap tampil.' });
}
