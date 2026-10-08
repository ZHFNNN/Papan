import { prisma } from '@/lib/prisma';
import { normalizeCategory } from '@/lib/property-input';
import { requireAdmin } from '@/lib/require-user';
import { KycStatus, type Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if ('error' in admin) return admin.error;

  const { searchParams } = new URL(request.url);
  // Kategori tidak dikenal diabaikan (sebelumnya membuat query Prisma error 500)
  const category = normalizeCategory(searchParams.get('category'));
  const city = searchParams.get('city');

  // Ambil semua kota yang ada (untuk datalist suggestion)
  const allCities = await prisma.property.findMany({
    where: { city: { not: null } },
    select: { city: true },
    distinct: ['city'],
  });
  const cities = allCities.map(p => p.city).filter(Boolean) as string[];

  // Ambil owner yang sudah KYC APPROVED.
  // Jika ada filter kategori atau kota, tetap pakai properti untuk menyaring.
  const ownerWhere: Prisma.UserWhereInput = {
    kycStatus: KycStatus.APPROVED,
  };

  if (category || city) {
    ownerWhere.properties = {
      some: {
        ...(category ? { category } : {}),
        ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
      },
    };
  }

  const owners = await prisma.user.findMany({
    where: ownerWhere,
    select: {
      id: true,
      name: true,
      email: true,
      username: true,
      properties: {
        select: { category: true, city: true },
      },
    },
  });

  const result = owners.map(owner => ({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    username: owner.username,
    propertyCount: owner.properties.length,
    categories: [...new Set(owner.properties.map(p => p.category))],
    cities: [...new Set(owner.properties.map(p => p.city).filter(Boolean))] as string[],
  }));

  return Response.json({ owners: result, cities });
}