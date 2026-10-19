import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';   // sesuaikan path auth kamu
import { prisma } from '@/lib/prisma';       // sesuaikan path prisma client kamu
import { resolveFacilityCodes } from '@/lib/dss/facility-mapping';
import { criteriaRowsToPriorities, parsePriorities, prioritiesToCriteriaRows } from '@/lib/dss/priorities';

// ── Mapping budget string → angka (min, max) ──────────────────────────────
const BUDGET_MAP: Record<string, { min: number; max: number }> = {
  '0 - 2 juta':  { min: 0,         max: 2_000_000 },
  '2 - 4 juta':  { min: 2_000_000, max: 4_000_000 },
  '4 - 6 juta':  { min: 4_000_000, max: 6_000_000 },
  '6 - 8 juta':  { min: 6_000_000, max: 8_000_000 },
  '8 juta+':     { min: 8_000_000, max: 999_999_999 },
};

// ── GET: ambil personalisasi user ─────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const [data, criteriaRows] = await Promise.all([
    prisma.userPersonalization.findUnique({
      where: { userId: session.user.id },
    }),
    prisma.userCriteriaWeight.findMany({
      where:  { userId: session.user.id },
      select: { criteria: true, weight: true },
    }),
  ]);

  // Kalau belum punya data personalisasi, kembalikan null (bukan error)
  if (!data) {
    return NextResponse.json(null);
  }

  // priorities = null kalau user belum pernah mengatur prioritas DSS
  return NextResponse.json({ ...data, priorities: criteriaRowsToPriorities(criteriaRows) });
}

// ── POST: simpan / update personalisasi user ──────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();

  // Validasi minimal
  const { location, occupation, budget, gender, preferences, priorities } = body;
  if (!location || !occupation || !budget || !gender) {
    return NextResponse.json(
      { message: 'Semua field wajib diisi.' },
      { status: 400 }
    );
  }

  // priorities opsional: kalau tidak dikirim, prioritas DSS yang lama tidak diubah
  const parsedPriorities = parsePriorities(priorities);
  if (!parsedPriorities.ok) {
    return NextResponse.json({ message: parsedPriorities.error }, { status: 400 });
  }

  const budgetRange = BUDGET_MAP[budget] ?? { min: 0, max: 999_999_999 };

  // preferences adalah array string, ubah jadi boolean fields
  const selectedPreferences = Array.isArray(preferences) ? (preferences as string[]) : [];

  const prefFields = {
    prefFurnished:          selectedPreferences.includes('Furnished'),
    prefUnfurnished:        selectedPreferences.includes('Unfurnished'),
    prefPetFriendly:        selectedPreferences.includes('Pet-friendly'),
    prefParkirMobil:        selectedPreferences.includes('Parkir Mobil'),
    prefAc:                 selectedPreferences.includes('AC'),
    prefWaterHeater:        selectedPreferences.includes('Water Heater'),
    prefDekatTransportasi:  selectedPreferences.includes('Dekat transportasi umum'),
  };

  const selectedFacilityCodes = resolveFacilityCodes(selectedPreferences);
  const facilities = await prisma.facility.findMany({
    where: { code: { in: selectedFacilityCodes } },
    select: { id: true },
  });

  // upsert = update kalau sudah ada, create kalau belum ada
  const personalization = await prisma.$transaction(async (tx) => {
    const saved = await tx.userPersonalization.upsert({
      where:  { userId: session.user.id },
      update: {
        location,
        occupation,
        budgetMin: budgetRange.min,
        budgetMax: budgetRange.max,
        gender,
        ...prefFields,
      },
      create: {
        userId: session.user.id,
        location,
        occupation,
        budgetMin: budgetRange.min,
        budgetMax: budgetRange.max,
        gender,
        ...prefFields,
      },
    });

    await tx.userPreferenceFacility.deleteMany({
      where: { userId: session.user.id },
    });

    if (facilities.length > 0) {
      await tx.userPreferenceFacility.createMany({
        data: facilities.map((facility) => ({
          userId: session.user.id,
          facilityId: facility.id,
          isRequired: false,
          weight: 1,
        })),
      });
    }

    if (parsedPriorities.value) {
      for (const row of prioritiesToCriteriaRows(parsedPriorities.value)) {
        await tx.userCriteriaWeight.upsert({
          where:  { userId_criteria: { userId: session.user.id, criteria: row.criteria } },
          update: { weight: row.weight },
          create: { userId: session.user.id, criteria: row.criteria, weight: row.weight },
        });
      }
    }

    const criteriaRows = await tx.userCriteriaWeight.findMany({
      where:  { userId: session.user.id },
      select: { criteria: true, weight: true },
    });

    return { ...saved, priorities: criteriaRowsToPriorities(criteriaRows) };
  });

  return NextResponse.json(personalization, { status: 200 });
}