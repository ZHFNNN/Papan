import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { calculateDiscountedPrice, isDiscountStillActive } from "@/types/property";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { readJson } from "../helpers/request";

/**
 * White box — Fitur 15: Promo/diskon & dynamic pricing
 * Unit: calculateDiscountedPrice(), isDiscountStillActive() (types/property.ts),
 *       GET /api/cron/pricing-advisor (saran harga otomatis saat peak season)
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));

const cron = await import("@/app/api/cron/pricing-advisor/route");

beforeEach(() => resetPrismaMock());
afterEach(() => vi.useRealTimers());

describe("TC-WB-PRM — Promo & dynamic pricing", () => {
  it("TC-WB-PRM-01: harga setelah diskon dibulatkan; diskon 0 atau ≥ 100% diabaikan", () => {
    expect(calculateDiscountedPrice("1000000", 25)).toBe(750_000);
    expect(calculateDiscountedPrice(1_000_000, 0)).toBe(1_000_000);
    expect(calculateDiscountedPrice(1_000_000, 100)).toBe(1_000_000);
  });

  it("TC-WB-PRM-02: diskon aktif sampai tanggal berakhir; lewat tanggal → tidak aktif", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(isDiscountStillActive(10, "2026-06-10", now)).toBe(true);
    expect(isDiscountStillActive(10, "2026-05-01", now)).toBe(false);
    expect(isDiscountStillActive(10, null, now)).toBe(true);
  });

  it("TC-WB-PRM-03: di luar peak season (Juni–Agustus) → cron tidak membuat notifikasi", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00"));
    expect((await readJson(await cron.GET())).body.created).toBe(0);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it("TC-WB-PRM-04: peak season → saran harga dikirim ke owner kosan yang belum menerima bulan ini", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00"));
    prismaMock.user.findMany.mockResolvedValue([{ id: "o1" }, { id: "o2" }]);
    prismaMock.notification.findMany.mockResolvedValue([{ ownerId: "o2" }]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });
    const { body } = await readJson(await cron.GET());
    expect(body).toMatchObject({ created: 1, skipped: 1 });
    expect(prismaMock.notification.createMany.mock.calls[0][0].data[0].ownerId).toBe("o1");
  });
});
