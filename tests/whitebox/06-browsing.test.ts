import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeRequest } from "../helpers/request";
import { invalidatePropertyListCache } from "@/lib/property-list-cache";

/**
 * White box — Fitur 6: Browsing & kategori properti
 * Unit: GET /api/properties (filter kategori/listing/promo + cache)
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));

const { GET } = await import("@/app/api/properties/route");
const firstWhere = () => prismaMock.property.findMany.mock.calls[0][0].where;

beforeEach(() => {
  resetPrismaMock();
  invalidatePropertyListCache();
  prismaMock.property.findMany.mockResolvedValue([]);
});

describe("TC-WB-BRW — Daftar properti", () => {
  it("TC-WB-BRW-01: filter kategori & tipe listing → kondisi query sesuai (SEWA mencakup data lama RENT/KOSAN)", async () => {
    await GET(makeRequest("/api/properties?category=kosan&listingType=sewa"));
    expect(firstWhere().AND).toEqual([{ category: "KOSAN" }, { listingType: { in: ["RENT", "SEWA", "KOSAN"] } }]);
  });

  it("TC-WB-BRW-02: promo=1 → hanya properti dengan diskon aktif", async () => {
    await GET(makeRequest("/api/properties?promo=1"));
    expect(firstWhere().AND[0]).toMatchObject({ discountPercentage: { gt: 0 } });
  });

  it("TC-WB-BRW-03: permintaan kedua dengan parameter sama dilayani dari cache (tanpa query DB)", async () => {
    await GET(makeRequest("/api/properties?category=rumah"));
    prismaMock.property.findMany.mockClear();
    await GET(makeRequest("/api/properties?category=rumah"));
    expect(prismaMock.property.findMany).not.toHaveBeenCalled();
  });
});
