import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCachedPropertyList, setCachedPropertyList } from '@/lib/property-list-cache';

type PropertyCategory = 'RUMAH' | 'APARTEMEN' | 'KOSAN';

function normalizeCategory(value: string | null): PropertyCategory | null {
  if (!value) return null;

  const normalized = value.trim().toUpperCase();
  if (normalized === 'RUMAH' || normalized === 'APARTEMEN' || normalized === 'KOSAN') {
    return normalized;
  }

  return null;
}

function normalizeListingType(value: string | null): string[] | null {
  if (!value) return null;

  const normalized = value.trim().toUpperCase();

  if (normalized === 'SELL' || normalized === 'JUAL') {
    return ['SELL', 'JUAL'];
  }

  if (normalized === 'RENT' || normalized === 'SEWA' || normalized === 'KOSAN') {
    return ['RENT', 'SEWA', 'KOSAN'];
  }

  return [normalized];
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const categoryFilter = normalizeCategory(url.searchParams.get('category'));
  const listingTypeFilter = normalizeListingType(url.searchParams.get('listingType'));
  const searchQuery = url.searchParams.get('q')?.trim();
  const promoOnly = url.searchParams.get('promo') === '1' || url.searchParams.get('promo') === 'true';

  const takeRaw = Number(url.searchParams.get('take') ?? '120');
  const take = Number.isFinite(takeRaw)
    ? Math.min(Math.max(Math.trunc(takeRaw), 1), 200)
    : 120;

  const cacheKey = JSON.stringify([categoryFilter, listingTypeFilter, searchQuery ?? '', promoOnly, take]);
  const cached = getCachedPropertyList(cacheKey);
  if (cached) {
    return Response.json(cached);
  }

  const now = new Date();
  const conditions: Prisma.PropertyWhereInput[] = [];

  if (categoryFilter) {
    conditions.push({ category: categoryFilter });
  }

  if (listingTypeFilter) {
    conditions.push({ listingType: { in: listingTypeFilter } });
  }

  if (searchQuery) {
    conditions.push({
      OR: [
        { title: { contains: searchQuery, mode: 'insensitive' } },
        { address: { contains: searchQuery, mode: 'insensitive' } },
        { neighbourhood: { contains: searchQuery, mode: 'insensitive' } },
        { district: { contains: searchQuery, mode: 'insensitive' } },
        { city: { contains: searchQuery, mode: 'insensitive' } },
        { owner: { name: { contains: searchQuery, mode: 'insensitive' } } },
        { owner: { username: { contains: searchQuery, mode: 'insensitive' } } },
        {
          facilities: {
            some: {
              facility: {
                name: { contains: searchQuery, mode: 'insensitive' },
              },
            },
          },
        },
      ],
    });
  }

  if (promoOnly) {
    conditions.push({
      discountPercentage: { gt: 0 },
      OR: [
        { discountActiveUntil: null },
        { discountActiveUntil: { gt: now } },
      ],
    });
  }

  const baseWhere: Prisma.PropertyWhereInput = conditions.length ? { AND: conditions } : {};

  const includeConfig = {
    owner: {
      select: {
        id: true,
        name: true,
        username: true,
      },
    },
    facilities: {
      include: {
        facility: {
          select: {
            code: true,
            name: true,
          },
        },
      },
    },
    boosts: {
      where: {
        startsAt: {
          lte: now,
        },
        endsAt: {
          gt: now,
        },
      },
      select: {
        id: true,
        packageId: true,
        packageTitle: true,
        days: true,
        price: true,
        startsAt: true,
        endsAt: true,
      },
      orderBy: {
        endsAt: 'desc',
      },
      take: 1,
    },
  } satisfies Prisma.PropertyInclude;

  // Dua query dijalankan paralel (bukan berurutan) supaya respons lebih cepat.
  // Properti boosted selalu di depan, sisanya diisi properti biasa sampai `take`.
  const [boosted, nonBoostedCandidates] = await Promise.all([
    prisma.property.findMany({
      where: {
        ...baseWhere,
        boosts: { some: { endsAt: { gt: now } } },
      },
      include: includeConfig,
      orderBy: { createdAt: 'desc' },
      take,
    }),
    prisma.property.findMany({
      where: {
        ...baseWhere,
        boosts: { none: { endsAt: { gt: now } } },
      },
      include: includeConfig,
      orderBy: { createdAt: 'desc' },
      take,
    }),
  ]);

  const nonBoosted = nonBoostedCandidates.slice(0, Math.max(take - boosted.length, 0));

  const data = [...boosted, ...nonBoosted].map((property) => {
    const activeBoost = property.boosts[0] ?? null;
    const { boosts, facilities, discountActiveUntil, ...plainProperty } = property;

    const isDiscountActive =
      typeof property.discountPercentage === 'number' &&
      property.discountPercentage > 0 &&
      (discountActiveUntil === null || (discountActiveUntil && discountActiveUntil > now));

    return {
      ...plainProperty,
      price: property.price.toString(),
      discountPercentage: property.discountPercentage ?? null,
      discountActiveUntil: discountActiveUntil ? discountActiveUntil.toISOString() : null,
      isDiscountActive: Boolean(isDiscountActive),
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
          }
        : null,
      facilities: facilities.map((entry) => ({
        code: entry.facility.code,
        name: entry.facility.name,
      })),
    };
  });

  const body = {
    message: 'Daftar properti berhasil diambil.',
    data,
  };
  setCachedPropertyList(cacheKey, body);

  return Response.json(body);
}
