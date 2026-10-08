// ============================================================
// FILE: app/api/owner/properties/[id]/route.ts
// GET /api/owner/properties/[id]
// PATCH /api/owner/properties/[id]
// DELETE /api/owner/properties/[id]
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveFacilityRecords } from '@/lib/facilities';
import { prisma } from '@/lib/prisma';
import { normalizeCategory, normalizeListingType, resolveGenderTarget } from '@/lib/property-input';
import { invalidatePropertyListCache } from '@/lib/property-list-cache';
import { MIN_PROPERTY_PHOTOS } from '@/types/property';

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

  return NextResponse.json(
    {
      ...property,
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
    select: { ownerId: true, category: true, genderTarget: true },
  });

  if (!existing) {
    return NextResponse.json({ message: 'Properti tidak ditemukan.' }, { status: 404 });
  }

  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();
  const {
    title, description, price, listingType, category, genderTarget, facilities, address, location, imageUrls,
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

  // Gender mengikuti kategori akhir: kosan wajib punya gender, selain kosan dikosongkan
  const gender = resolveGenderTarget(normalizedCategory ?? existing.category, genderTarget, existing.genderTarget);
  if (!gender.ok) {
    return NextResponse.json({ message: gender.message }, { status: 400 });
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
      ...(normalizedCategory ? { category: normalizedCategory } : {}),
      genderTarget: gender.genderTarget,
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

  // Harga, diskon, foto, dan kategori tampil di daftar properti publik
  invalidatePropertyListCache();

  return NextResponse.json(
    updated,
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
  invalidatePropertyListCache();

  return NextResponse.json({ message: 'Properti berhasil dihapus.' });
}