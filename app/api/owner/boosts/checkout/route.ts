import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidatePropertyListCache } from '@/lib/property-list-cache';

type CartItem = {
  propertyId: string;
  packageId: string;
  packageTitle: string;
  days: number;
  price: number;
};

type CheckoutBody = {
  items: CartItem[];
  paymentMethod: 'QRIS' | 'BCA' | 'BRI' | 'MANDIRI';
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body: CheckoutBody = await req.json();
  const { items, paymentMethod } = body;

  if (!items || items.length === 0) {
    return NextResponse.json({ message: 'Keranjang kosong.' }, { status: 400 });
  }

  const userId = session.user.id;

  // Verify all properties belong to this owner
  const propertyIds = items.map((i) => i.propertyId);
  const ownedProperties = await prisma.property.findMany({
    where: { id: { in: propertyIds }, ownerId: userId },
    select: { id: true },
  });

  if (ownedProperties.length !== propertyIds.length) {
    return NextResponse.json(
      { message: 'Beberapa properti tidak ditemukan atau bukan milik kamu.' },
      { status: 403 }
    );
  }

  // Create all boosts in a transaction
  const now = new Date();

  await prisma.$transaction(
    items.map((item) => {
      const startsAt = now;
      const endsAt = new Date(now.getTime() + item.days * 24 * 60 * 60 * 1000);

      return prisma.propertyBoost.create({
        data: {
          propertyId: item.propertyId,
          ownerId: userId,
          packageId: item.packageId,
          packageTitle: item.packageTitle,
          days: item.days,
          price: item.price,
          startsAt,
          endsAt,
        },
      });
    })
  );

  // NOTE: Di sini bisa ditambahkan integrasi payment gateway (Midtrans, Xendit, dll)
  // dan menyimpan record transaksi pembayaran ke DB

  invalidatePropertyListCache();
  return NextResponse.json({
    success: true,
    message: `${items.length} booster berhasil diaktifkan.`,
    paymentMethod,
  });
}