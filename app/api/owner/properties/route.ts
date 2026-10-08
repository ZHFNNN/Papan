// ============================================================
// FILE: app/api/owner/properties/route.ts
// POST /api/owner/properties
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveFacilityRecords } from '@/lib/facilities';
import { prisma } from '@/lib/prisma';
import { normalizeCategory, normalizeGenderTarget, normalizeListingType } from '@/lib/property-input';
import { invalidatePropertyListCache } from '@/lib/property-list-cache';
import { MIN_PROPERTY_PHOTOS } from '@/types/property';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true },
  });

  if (user?.kycStatus !== 'APPROVED') {
    return NextResponse.json(
      { message: 'KYC kamu belum disetujui.' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { title, description, price, listingType, category, genderTarget, address, facilities, location, imageUrls } = body;
  const normalizedCategory = normalizeCategory(category);
  const normalizedListingType = normalizeListingType(listingType);

  if (!title || !price || !normalizedListingType || !address || !normalizedCategory) {
    return NextResponse.json({ message: 'Data tidak lengkap.' }, { status: 400 });
  }

  // Gender hanya untuk kosan; kategori lain disimpan null
  const normalizedGenderTarget = normalizedCategory === 'KOSAN' ? normalizeGenderTarget(genderTarget) : null;
  if (normalizedCategory === 'KOSAN' && !normalizedGenderTarget) {
    return NextResponse.json(
      { message: 'Tipe gender kosan wajib dipilih (Putra, Putri, atau Campur).' },
      { status: 400 }
    );
  }

  const latitude      = typeof location?.lat === 'number' ? location.lat : null;
  const longitude     = typeof location?.lng === 'number' ? location.lng : null;
  const city          = typeof location?.city === 'string' ? location.city.trim() : null;
  const district      = typeof location?.district === 'string' ? location.district.trim() : null;
  const neighbourhood = typeof location?.neighbourhood === 'string' ? location.neighbourhood.trim() : null;

  const facilityInputs = Array.isArray(facilities) ? (facilities as string[]) : [];
  const photoUrls = Array.isArray(imageUrls)
    ? imageUrls.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  if (photoUrls.length < MIN_PROPERTY_PHOTOS) {
    return NextResponse.json(
      { message: `Minimal ${MIN_PROPERTY_PHOTOS} foto properti.` },
      { status: 400 }
    );
  }

  const facilityRecords = await resolveFacilityRecords(facilityInputs);

  const property = await prisma.property.create({
    data: {
      ownerId:       session.user.id,
      title,
      category:      normalizedCategory,
      address,
      city,
      district,
      neighbourhood,
      latitude,
      longitude,
      imageUrls:    photoUrls,
      description:  description ?? null,
      genderTarget: normalizedGenderTarget,
      price:        Number(price),
      listingType:  normalizedListingType,
      facilities: {
        createMany: {
          data:            facilityRecords.map((f) => ({ facilityId: f.id })),
          skipDuplicates:  true,
        },
      },
    },
    include: {
      facilities: {
        include: {
          facility: { select: { code: true, name: true } },
        },
      },
    },
  });

  invalidatePropertyListCache();
  return NextResponse.json(property, { status: 201 });
}