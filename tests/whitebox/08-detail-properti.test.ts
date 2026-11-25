import { describe, expect, it } from "vitest";
import { mapApiProperty, type PropertyDetail } from "@/lib/frontend/property-detail";
import { formatWhatsAppNumber } from "@/components/WhatsAppButton";

/**
 * White box — Fitur 8: Detail properti & tombol WhatsApp
 * Unit: mapApiProperty() (lib/frontend/property-detail.ts), formatWhatsAppNumber()
 */

const NOW = new Date("2026-06-01T00:00:00Z");
const base: PropertyDetail = {
  id: "p1",
  title: "Kos Melati",
  address: "Jl. Mawar",
  city: "Bandung",
  description: "Nyaman",
  price: "1000000",
  listingType: "RENT",
  facilities: [],
  createdAt: "2026-01-01",
  owner: { id: "o1", name: "Pak Owner", phoneNumber: "081234567890" },
};

describe("TC-WB-DTL — Detail properti", () => {
  it("TC-WB-DTL-01: diskon aktif → harga setelah diskon + harga asli dicoret", () => {
    const d = mapApiProperty({ ...base, discountPercentage: 20, discountActiveUntil: "2026-12-31" }, NOW);
    expect(d.isDiscountActive).toBe(true);
    expect(d.originalPrice).not.toBeNull();
    expect(d.discountPercentage).toBe(20);
  });

  it("TC-WB-DTL-02: diskon sudah kedaluwarsa → harga normal, tanpa harga coret", () => {
    const d = mapApiProperty({ ...base, discountPercentage: 20, discountActiveUntil: "2026-05-01" }, NOW);
    expect(d.isDiscountActive).toBe(false);
    expect(d.originalPrice).toBeNull();
  });

  it("TC-WB-DTL-03: nomor WhatsApp lokal (08…) diubah ke format internasional 62…", () => {
    expect(formatWhatsAppNumber("0812-3456-7890")).toBe("6281234567890");
    expect(formatWhatsAppNumber("+62 812 3456")).toBe("628123456");
  });
});
