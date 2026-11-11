import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests untuk POST /api/personalisasi, khusus field gender.
 * Gender hanya berlaku untuk kosan, jadi frontend boleh tidak mengirimnya
 * (misalnya pengguna tidak memilih kosan). Database diganti penyimpanan di memori
 * dan sesi login di-mock, jadi test tidak butuh database sungguhan.
 */

type PersonalizationRow = {
  id: string;
  userId: string;
  location: string | null;
  occupation: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  gender: string | null;
  prefFurnished: boolean;
  prefUnfurnished: boolean;
  prefPetFriendly: boolean;
  prefParkirMobil: boolean;
  prefAc: boolean;
  prefWaterHeater: boolean;
  prefDekatTransportasi: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CriteriaRow = { userId: string; criteria: string; weight: number };

const { db, getServerSession } = vi.hoisted(() => ({
  db: {
    personalizations: new Map<string, PersonalizationRow>(),
    criteria: [] as CriteriaRow[],
    facilities: [{ id: "fac-ac", code: "AC" }] as { id: string; code: string }[],
    preferenceFacilities: [] as { userId: string; facilityId: string }[],
  },
  getServerSession: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));

vi.mock("@/lib/prisma", () => {
  // Prisma mengabaikan field bernilai undefined saat update, tetapi null mengosongkan kolom.
  const withoutUndefined = (data: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

  const tx = {
    userPersonalization: {
      findUnique: async ({ where }: { where: { userId: string } }) =>
        db.personalizations.get(where.userId) ?? null,
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { userId: string };
        update: Record<string, unknown>;
        create: Record<string, unknown>;
      }) => {
        const existing = db.personalizations.get(where.userId);
        const now = new Date();
        const row = (
          existing
            ? { ...existing, ...withoutUndefined(update), updatedAt: now }
            : {
                id: `pers-${where.userId}`,
                location: null,
                occupation: null,
                budgetMin: null,
                budgetMax: null,
                gender: null,
                prefFurnished: false,
                prefUnfurnished: false,
                prefPetFriendly: false,
                prefParkirMobil: false,
                prefAc: false,
                prefWaterHeater: false,
                prefDekatTransportasi: false,
                ...withoutUndefined(create),
                createdAt: now,
                updatedAt: now,
              }
        ) as PersonalizationRow;
        db.personalizations.set(where.userId, row);
        return row;
      },
    },
    userPreferenceFacility: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        db.preferenceFacilities = db.preferenceFacilities.filter((row) => row.userId !== where.userId);
      },
      createMany: async ({ data }: { data: { userId: string; facilityId: string }[] }) => {
        db.preferenceFacilities.push(...data.map(({ userId, facilityId }) => ({ userId, facilityId })));
      },
    },
    userCriteriaWeight: {
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { userId_criteria: { userId: string; criteria: string } };
        update: { weight: number };
        create: CriteriaRow;
      }) => {
        const { userId, criteria } = where.userId_criteria;
        const existing = db.criteria.find((row) => row.userId === userId && row.criteria === criteria);
        if (existing) existing.weight = update.weight;
        else db.criteria.push({ ...create });
      },
      findMany: async ({ where }: { where: { userId: string } }) =>
        db.criteria
          .filter((row) => row.userId === where.userId)
          .map(({ criteria, weight }) => ({ criteria, weight })),
    },
    facility: {
      findMany: async ({ where }: { where: { code: { in: string[] } } }) =>
        db.facilities.filter((row) => where.code.in.includes(row.code)).map(({ id }) => ({ id })),
    },
  };

  return {
    prisma: {
      ...tx,
      $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx),
    },
  };
});

import { POST as savePersonalisasi } from "@/app/api/personalisasi/route";
import type { NextRequest } from "next/server";

const USER_ID = "user-1";

const BASE_FORM = {
  location: "Jatinangor, Sumedang",
  occupation: "Mahasiswa",
  budget: "0 - 2 juta",
  preferences: ["AC"],
};

async function post(body: unknown) {
  const request = new Request("http://localhost/api/personalisasi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return savePersonalisasi(request as NextRequest);
}

function seedPersonalization(gender: string) {
  const now = new Date("2026-11-01T00:00:00Z");
  db.personalizations.set(USER_ID, {
    id: "pers-seed",
    userId: USER_ID,
    location: "Bandung",
    occupation: "Pekerja",
    budgetMin: 2_000_000,
    budgetMax: 4_000_000,
    gender,
    prefFurnished: false,
    prefUnfurnished: false,
    prefPetFriendly: false,
    prefParkirMobil: false,
    prefAc: false,
    prefWaterHeater: false,
    prefDekatTransportasi: false,
    createdAt: now,
    updatedAt: now,
  });
}

beforeEach(() => {
  db.personalizations.clear();
  db.criteria = [];
  db.preferenceFacilities = [];
  getServerSession.mockReset();
  getServerSession.mockResolvedValue({ user: { id: USER_ID } });
});

describe("POST /api/personalisasi — gender opsional (hanya untuk kosan)", () => {
  // G1: pengguna yang tidak memilih kosan tidak melihat field gender, jadi body tanpa gender
  it("G1: saves the form without gender and stores gender as null", async () => {
    const res = await post(BASE_FORM);

    expect(res.status).toBe(200);
    expect((await res.json()).gender).toBeNull();
    const saved = db.personalizations.get(USER_ID);
    expect(saved?.gender).toBeNull();
    expect(saved?.location).toBe("Jatinangor, Sumedang");
    expect(saved?.budgetMax).toBe(2_000_000);
  });

  // G2: gender kosong/spasi dianggap tidak dipilih, bukan disimpan sebagai teks kosong
  it("G2: treats an empty or blank gender as not chosen", async () => {
    for (const gender of ["", "   ", null]) {
      db.personalizations.clear();
      const res = await post({ ...BASE_FORM, gender });

      expect(res.status).toBe(200);
      expect(db.personalizations.get(USER_ID)?.gender).toBeNull();
    }
  });

  // G3: form disimpan utuh, jadi gender lama ikut dihapus bila sekarang tidak dikirim
  it("G3: clears a previously saved gender when the form is sent without one", async () => {
    seedPersonalization("Perempuan");

    const res = await post(BASE_FORM);

    expect(res.status).toBe(200);
    expect(db.personalizations.get(USER_ID)?.gender).toBeNull();
    expect(db.personalizations.get(USER_ID)?.location).toBe("Jatinangor, Sumedang");
  });

  // G4: gender yang dipilih tetap tersimpan (dipakai DSS untuk menyaring kosan)
  it("G4: keeps the gender the user picked", async () => {
    const res = await post({ ...BASE_FORM, gender: "Perempuan" });

    expect(res.status).toBe(200);
    expect(db.personalizations.get(USER_ID)?.gender).toBe("Perempuan");
  });

  // G5: gender selain teks ditolak sebelum menyentuh database
  it("G5: rejects a gender that is not text and saves nothing", async () => {
    const res = await post({ ...BASE_FORM, gender: 123 });

    expect(res.status).toBe(400);
    expect(db.personalizations.has(USER_ID)).toBe(false);
  });

  // G6: field lain tetap wajib
  it("G6: still requires location, occupation, and budget", async () => {
    for (const missing of ["location", "occupation", "budget"] as const) {
      const body: Record<string, unknown> = { ...BASE_FORM, gender: "Laki-laki" };
      delete body[missing];
      const res = await post(body);

      expect(res.status).toBe(400);
    }
    expect(db.personalizations.has(USER_ID)).toBe(false);
  });
});
