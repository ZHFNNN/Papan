import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { invalidatePropertyListCache } from '@/lib/property-list-cache';
import {
  BOOST_PACKAGES,
  getBoostEndsAt,
  getBoosterPackage,
  getRemainingDays,
} from '@/lib/booster';

type RouteParams = {
  params: Promise<{ id: string }>;
};

type BoostRequestBody = {
  packageId?: string;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as BoostRequestBody;
  const packageId = typeof body.packageId === 'string' ? body.packageId : '';
  const boosterPackage = getBoosterPackage(packageId);

  if (!boosterPackage) {
    return NextResponse.json(
      {
        message: 'Paket booster tidak valid.',
        data: BOOST_PACKAGES,
      },
      { status: 400 }
    );
  }

  const now = new Date();

  const property = await prisma.property.findUnique({
    where: { id },
    select: {
      id: true,
      ownerId: true,
      boosts: {
        where: {
          startsAt: {
            lte: now,
          },
          endsAt: {
            gt: now,
          },
        },
        orderBy: {
          endsAt: 'desc',
        },
        take: 1,
      },
    },
  });

  if (!property) {
    return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
  }

  if (property.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  if (property.boosts.length > 0) {
    const activeBoost = property.boosts[0];
    return NextResponse.json(
      {
        message: 'Properti ini masih memiliki booster aktif.',
        data: {
          id: activeBoost.id,
          propertyId: activeBoost.propertyId,
          packageId: activeBoost.packageId,
          packageTitle: activeBoost.packageTitle,
          days: activeBoost.days,
          price: activeBoost.price,
          startDate: activeBoost.startsAt.toISOString(),
          endDate: activeBoost.endsAt.toISOString(),
          remainingDays: getRemainingDays(activeBoost.endsAt, now),
        },
      },
      { status: 409 }
    );
  }

  const endDate = getBoostEndsAt(now, boosterPackage.days);

  const boost = await prisma.propertyBoost.create({
    data: {
      propertyId: property.id,
      ownerId: session.user.id,
      packageId: boosterPackage.id,
      packageTitle: boosterPackage.title,
      days: boosterPackage.days,
      price: boosterPackage.price,
      startsAt: now,
      endsAt: endDate,
    },
  });

  invalidatePropertyListCache();
  return NextResponse.json(
    {
      message: 'Booster berhasil diaktifkan.',
      data: {
        id: boost.id,
        propertyId: boost.propertyId,
        ownerId: boost.ownerId,
        packageId: boost.packageId,
        packageTitle: boost.packageTitle,
        days: boost.days,
        price: boost.price,
        startDate: boost.startsAt.toISOString(),
        endDate: boost.endsAt.toISOString(),
        remainingDays: getRemainingDays(boost.endsAt, now),
      },
    },
    { status: 201 }
  );
}