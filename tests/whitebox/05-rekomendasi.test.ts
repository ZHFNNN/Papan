import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeBudgetScore, resolveCriteriaWeights } from "@/lib/dss/scoring";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { readJson } from "../helpers/request";

/**
 * White box — Fitur 5: Rekomendasi DSS
 * Unit: lib/dss/scoring.ts dan GET /api/recommendations
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const { GET } = await import("@/app/api/recommendations/route");

const property = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  title: `Properti ${id}`,
  category: "RUMAH",
  genderTarget: null,
  address: "Dago",
  city: "Bandung",
  district: null,
  neighbourhood: null,
  imageUrls: [],
  description: null,
  price: 1_500_000,
  discountPercentage: null,
  discountActiveUntil: null,
  listingType: "SEWA",
  createdAt: new Date(),
  facilities: [],
  boosts: [],
  ...extra,
});

function setupRoute(properties: unknown[]) {
  loginAs({ id: "u1" });
  prismaMock.userPersonalization.findUnique.mockResolvedValue({
    location: "dago",
    gender: "Perempuan",
    budgetMin: 0,
    budgetMax: 2_000_000,
    prefFurnished: false,
    prefUnfurnished: false,
    prefPetFriendly: false,
    prefParkirMobil: false,
    prefAc: false,
    prefWaterHeater: false,
    prefDekatTransportasi: false,
  });
  prismaMock.userPreferenceFacility.findMany.mockResolvedValue([]);
  prismaMock.userCriteriaWeight.findMany.mockResolvedValue([]);
  prismaMock.property.findMany.mockResolvedValue(properties);
}

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
});

describe("TC-WB-REK — Rekomendasi DSS", () => {
  it("TC-WB-REK-01: harga ≤ budget maksimum → skor budget 1", () => {
    expect(normalizeBudgetScore(1_500_000, 0, 2_000_000)).toBe(1);
  });

  it("TC-WB-REK-02: harga di atas budget → skor turun proporsional (tidak negatif)", () => {
    expect(normalizeBudgetScore(3_000_000, 0, 2_000_000)).toBe(0.5);
    expect(normalizeBudgetScore(9_000_000, 0, 2_000_000)).toBe(0);
  });

  it("TC-WB-REK-03: prioritas user → bobot Rank Order Centroid (peringkat 1 = 11/18)", () => {
    const { weights, source } = resolveCriteriaWeights([
      { criteria: "BUDGET", weight: 1 },
      { criteria: "LOCATION", weight: 3 },
      { criteria: "FACILITIES", weight: 2 },
    ]);
    expect(source).toBe("user_criteria_weight");
    expect(weights.location).toBeCloseTo(11 / 18, 6);
    expect(weights.budget).toBeCloseTo(2 / 18, 6);
  });

  it("TC-WB-REK-04: kosan khusus putra tidak direkomendasikan ke user perempuan", async () => {
    setupRoute([property("putra", { category: "KOSAN", genderTarget: "PUTRA" }), property("rumah")]);
    const { body } = await readJson(await GET());
    expect(body.data.map((p: { id: string }) => p.id)).toEqual(["rumah"]);
  });

  it("TC-WB-REK-05: properti yang di-boost selalu di urutan depan", async () => {
    const boost = { id: "b1", packageId: "harian", packageTitle: "Paket Harian", endsAt: new Date(Date.now() + 86_400_000) };
    setupRoute([property("cocok"), property("boosted", { price: 9_000_000, address: "Jakarta", boosts: [boost] })]);
    const { body } = await readJson(await GET());
    expect(body.data.map((p: { id: string }) => p.id)).toEqual(["boosted", "cocok"]);
  });
});
