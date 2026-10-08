// ============================================================
// FILE: app/api/owner/properties/[id]/route.ts
// GET /api/owner/properties/[id]
// PATCH /api/owner/properties/[id]
// DELETE /api/owner/properties/[id]
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Prisma } from '@prisma/client';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MIN_PROPERTY_PHOTOS } from '@/types/property';

const ALLOWED_CATEGORIES = ['RUMAH', 'APARTEMEN', 'KOSAN'] as const;
const ALLOWED_LISTING_TYPES = ['JUAL', 'SEWA'] as const;
type CategoryRow = { category: 'RUMAH' | 'APARTEMEN' | 'KOSAN' | null };

function normalizeCategory(category: unknown): (typeof ALLOWED_CATEGORIES)[number] | null {
  if (typeof category !== 'string') return null;
  const normalized = category.trim().toUpperCase();
  return ALLOWED_CATEGORIES.includes(normalized as (typeof ALLOWED_CATEGORIES)[number])
    ? (normalized as (typeof ALLOWED_CATEGORIES)[number])
    : null;
}

function normalizeListingType(listingType: unknown): (typeof ALLOWED_LISTING_TYPES)[number] | null {
  if (typeof listingType !== 'string') return null;
  const normalized = listingType.trim().toUpperCase();
  if (normalized === 'SELL') return 'JUAL';
  if (normalized === 'RENT' || normalized === 'KOSAN') return 'SEWA';
  return ALLOWED_LISTING_TYPES.includes(normalized as (typeof ALLOWED_LISTING_TYPES)[number])
    ? (normalized as (typeof ALLOWED_LISTING_TYPES)[number])
    : null;
}

// Support code preset maupun nama custom (upsert)
async function resolveFacilityRecords(inputs: string[]): Promise<{ id: string }[]> {
  return Promise.all(
    inputs.map(async (input) => {
      // Cek apakah ini code preset yang sudah ada di DB
      const byCode = await prisma.facility.findUnique({ where: { code: input } });
      if (byCode) return { id: byCode.id };

      // Anggap nama custom — upsert by generated code
      const code = `custom_${input.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      const result = await prisma.facility.upsert({
        where: { code },
        update: {},
        create: { code, name: input },
      });
      return { id: result.id };
    })
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
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
    },
  });

  if (!property) {
    return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
  }

  if (property.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const categoryRow = await prisma.$queryRaw<CategoryRow[]>(
    Prisma.sql`SELECT "category" FROM "Property" WHERE "id" = ${id} LIMIT 1`,
  );

  return NextResponse.json(
    {
      ...property,
      category: categoryRow[0]?.category ?? null,
      discountPercentage: property.discountPercentage ?? null,
      discountActiveUntil: property.discountActiveUntil
        ? property.discountActiveUntil.toISOString()
        : null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const existing = await prisma.property.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!existing) {
    return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
  }

  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    title, description, price, listingType, category, facilities, address, location, imageUrls,
    discountPercentage, discountActiveUntil,
  } = body;
  const normalizedCategory    = normalizeCategory(category);
  const normalizedListingType = normalizeListingType(listingType);

  if (!title || !price || !normalizedListingType) {
    return NextResponse.json({ message: 'Data tidak lengkap.' }, { status: 400 });
  }

  if (category !== undefined && !normalizedCategory) {
    return NextResponse.json({ message: 'Kategori properti tidak valid.' }, { status: 400 });
  }

  // Validasi diskon
  let normalizedDiscount: number | null | undefined = undefined;
  if (discountPercentage !== undefined) {
    if (discountPercentage === null || discountPercentage === 0 || discountPercentage === '') {
      normalizedDiscount = null;
    } else {
      const pct = Number(discountPercentage);
      if (!Number.isFinite(pct) || pct < 1 || pct > 99 || !Number.isInteger(pct)) {
        return NextResponse.json(
          { message: 'Diskon harus berupa bilangan bulat antara 1-99.' },
          { status: 400 }
        );
      }
      normalizedDiscount = pct;
    }
  }

  let normalizedDiscountUntil: Date | null | undefined = undefined;
  if (discountActiveUntil !== undefined) {
    if (discountActiveUntil === null || discountActiveUntil === '') {
      normalizedDiscountUntil = null;
    } else {
      const parsed = new Date(discountActiveUntil);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { message: 'Format tanggal diskon tidak valid.' },
          { status: 400 }
        );
      }
      normalizedDiscountUntil = parsed;
    }
  }

  const latitude      = typeof location?.lat === 'number' ? location.lat : null;
  const longitude     = typeof location?.lng === 'number' ? location.lng : null;
  const city          = typeof location?.city === 'string' ? location.city.trim() : null;
  const district      = typeof location?.district === 'string' ? location.district.trim() : null;
  const neighbourhood = typeof location?.neighbourhood === 'string' ? location.neighbourhood.trim() : null;

  const facilityItems = Array.isArray(facilities) ? (facilities as string[]) : null;
  const photoUrls = Array.isArray(imageUrls)
    ? imageUrls.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : null;

  if (photoUrls && photoUrls.length < MIN_PROPERTY_PHOTOS) {
    return NextResponse.json(
      { message: `Minimal ${MIN_PROPERTY_PHOTOS} foto properti.` },
      { status: 400 }
    );
  }

  // Resolve facilities — support code preset + nama custom
  const facilityRecords = facilityItems ? await resolveFacilityRecords(facilityItems) : [];

  const updated = await prisma.property.update({
    where: { id },
    data: {
      title,
      ...(typeof address === 'string' ? { address } : {}),
      ...(location
        ? { city, district, neighbourhood, latitude, longitude }
        : {}),
      ...(photoUrls ? { imageUrls: photoUrls } : {}),
      description:  description ?? null,
      price:        Number(price),
      listingType:  normalizedListingType,
      ...(normalizedDiscount !== undefined ? { discountPercentage: normalizedDiscount } : {}),
      ...(normalizedDiscountUntil !== undefined ? { discountActiveUntil: normalizedDiscountUntil } : {}),
      ...(facilityItems
        ? {
            facilities: {
              deleteMany: {},
              createMany: {
                data:           facilityRecords.map((f) => ({ facilityId: f.id })),
                skipDuplicates: true,
              },
            },
          }
        : {}),
    },
    include: {
      facilities: {
        include: {
          facility: {
            select: { code: true, name: true },
          },
        },
      },
    },
  });

  if (category !== undefined && normalizedCategory) {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Property" SET "category" = ${normalizedCategory}::"PropertyCategory" WHERE "id" = ${id}`,
    );
  }

  const categoryRow = await prisma.$queryRaw<CategoryRow[]>(
    Prisma.sql`SELECT "category" FROM "Property" WHERE "id" = ${id} LIMIT 1`,
  );

  return NextResponse.json(
    {
      ...updated,
      category: categoryRow[0]?.category ?? null,
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    },
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const property = await prisma.property.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!property) {
    return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
  }

  if (property.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await prisma.property.delete({ where: { id } });

  return NextResponse.json({ message: 'Properti berhasil dihapus.' });
}