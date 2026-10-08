import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/require-user';
import { PropertyCategory, KycStatus } from '@prisma/client';
import { sendNotificationEmail } from '@/lib/mailer';

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if ('error' in admin) return admin.error;

  const body = await request.json() as {
    title: string;
    message: string;
    imageUrl: string | null;
    category: PropertyCategory | null;
    city: string | null;
    type?: string | null;
  };

  const { title, message, imageUrl, category, city } = body;
  const ALLOWED_TYPES = new Set(['ADMIN_BROADCAST', 'PROMO_SUGGESTION']);
  const notifType = typeof body.type === 'string' && ALLOWED_TYPES.has(body.type)
    ? body.type
    : 'ADMIN_BROADCAST';

  if (!title?.trim() || !message?.trim()) {
    return Response.json({ message: 'Judul dan pesan wajib diisi.' }, { status: 400 });
  }

  // Temukan semua owner yang sudah KYC APPROVED.
  const ownerFilter: Record<string, unknown> = {
    kycStatus: KycStatus.APPROVED,
  };

  if (category || city) {
    ownerFilter.properties = {
      some: {
        ...(category ? { category } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      },
    };
  }

  const owners = await prisma.user.findMany({
    where: ownerFilter,
    select: { id: true },
  });

  if (owners.length === 0) {
    return Response.json({ message: 'Tidak ada owner yang sesuai filter.' }, { status: 400 });
  }

  // Bulk insert notifications
  await prisma.notification.createMany({
    data: owners.map(owner => ({
      ownerId: owner.id,
      title: title.trim(),
      message: message.trim(),
      imageUrl: imageUrl ?? null,
      type: notifType,
      isRead: false,
    })),
  });
  // Attempt to send email notifications to owners who have email addresses
  const ownerIds = owners.map(o => o.id);
  const recipients = await prisma.user.findMany({
    where: { id: { in: ownerIds }, email: { not: null } },
    select: { id: true, email: true },
  });

  const sendResults = await Promise.allSettled(
    recipients.map((r) =>
      sendNotificationEmail({
        to: r.email as string,
        title: title.trim(),
        message: message.trim(),
        imageUrl: imageUrl ?? null,
      })
    )
  );

  const succeeded = sendResults.filter(r => r.status === 'fulfilled').length;
  const failed = sendResults.filter(r => r.status === 'rejected').length;

  return Response.json({
    message: `Notifikasi berhasil dibuat untuk ${owners.length} owner. Email dikirim ke ${succeeded} penerima (${failed} gagal).`,
    count: owners.length,
    emailSent: succeeded,
    emailFailed: failed,
  });
}