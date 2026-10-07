import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getRemainingDays } from '@/lib/booster';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const now = new Date();

  const [properties, user] = await Promise.all([
    prisma.property.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
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
        _count: {
          select: {
            bookmarks: true,
          },
        },
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    }),
  ]);

  const normalizedProperties = properties.map((property) => {
    const { boosts, _count, discountActiveUntil, ...plainProperty } = property;
    const activeBoost = boosts[0] ?? null;

    const isDiscountActive =
      typeof property.discountPercentage === 'number' &&
      property.discountPercentage > 0 &&
      (discountActiveUntil === null || (discountActiveUntil && discountActiveUntil > now));

    return {
      ...plainProperty,
      price: property.price.toString(),
      bookmarkCount: _count?.bookmarks ?? 0,
      isBoosted: Boolean(activeBoost),
      activeBoost: activeBoost
        ? {
            id: activeBoost.id,
            packageId: activeBoost.packageId,
            packageTitle: activeBoost.packageTitle,
            days: activeBoost.days,
            price: activeBoost.price,
            startDate: activeBoost.startsAt.toISOString(),
            endDate: activeBoost.endsAt.toISOString(),
            remainingTimeMs: Math.max(activeBoost.endsAt.getTime() - now.getTime(), 0),
            remainingDays: getRemainingDays(activeBoost.endsAt, now),
          }
        : null,
      discountPercentage: property.discountPercentage ?? null,
      discountActiveUntil: discountActiveUntil ? discountActiveUntil.toISOString() : null,
      isDiscountActive: Boolean(isDiscountActive),
    };
  });

  const stats = {
    totalProperties: normalizedProperties.length,
    activeProperties: normalizedProperties.length,
    rentedRooms: 0,
    soldProperties: 0,
    totalRevenue: 0,
    boostedProperties: normalizedProperties.filter((p) => p.isBoosted).length,
    promoProperties: normalizedProperties.filter((p) => p.isDiscountActive).length,
  };

  return NextResponse.json({
    stats,
    kycStatus: user?.kycStatus ?? 'NONE',
    properties: normalizedProperties,
  });
}