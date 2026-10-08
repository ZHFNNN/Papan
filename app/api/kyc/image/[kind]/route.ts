import { cloudinary } from '@/lib/cloudinary';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { isKycImageKind, isLegacyKycImageUrl, parseLegacyCloudinaryUrl } from '@/lib/kyc-image';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/require-user';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ kind: string }>;
};

const ALLOWED_WIDTHS = new Set<number>([IMAGE_WIDTH.card, IMAGE_WIDTH.detail]);

/** URL sumber gambar di Cloudinary. Hanya dipakai di server, tidak pernah dikirim ke browser. */
function resolveSourceUrl(ref: string, width: number | null): string | null {
  if (isLegacyKycImageUrl(ref)) {
    // Data lama: URL publik Cloudinary. URL di luar Cloudinary ditolak supaya
    // server tidak bisa disuruh mengambil alamat sembarangan.
    if (!parseLegacyCloudinaryUrl(ref)) return null;
    return width ? optimizeImage(ref, width) : ref;
  }

  return cloudinary.url(ref, {
    type: 'authenticated',
    resource_type: 'image',
    sign_url: true,
    secure: true,
    ...(width ? { transformation: [{ width, crop: 'limit', quality: 'auto' }] } : {}),
  });
}

// GET /api/kyc/image/:kind?submissionId=...&w=640
// Tanpa submissionId: foto pengajuan milik user yang login.
// Dengan submissionId: hanya admin, atau pemilik pengajuan itu sendiri.
export async function GET(request: Request, { params }: RouteContext) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { kind } = await params;
  if (!isKycImageKind(kind)) {
    return Response.json({ message: 'Jenis foto tidak valid.' }, { status: 404 });
  }

  const url = new URL(request.url);
  const submissionId = url.searchParams.get('submissionId');
  const widthParam = Number(url.searchParams.get('w'));
  const width = ALLOWED_WIDTHS.has(widthParam) ? widthParam : null;

  const userId = auth.session.user.id;
  const isAdmin = auth.session.user.role === 'ADMIN';

  const submission = await prisma.kycSubmission.findUnique({
    where: submissionId ? { id: submissionId } : { userId },
    select: { userId: true, ktpImageUrl: true, selfieImageUrl: true },
  });

  // 404 juga untuk pengajuan milik orang lain, supaya keberadaannya tidak bocor
  if (!submission || (!isAdmin && submission.userId !== userId)) {
    return Response.json({ message: 'Foto tidak ditemukan.' }, { status: 404 });
  }

  const ref = kind === 'ktp' ? submission.ktpImageUrl : submission.selfieImageUrl;
  const sourceUrl = resolveSourceUrl(ref, width);
  if (!sourceUrl) {
    return Response.json({ message: 'Foto tidak ditemukan.' }, { status: 404 });
  }

  const upstream = await fetch(sourceUrl, { cache: 'no-store' });
  const contentType = upstream.headers.get('content-type') ?? '';

  if (!upstream.ok || !upstream.body || !contentType.startsWith('image/')) {
    return Response.json({ message: 'Gagal memuat foto.' }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
