import { describe, expect, it } from "vitest";
import { detectCategory, filterSearchResults } from "@/lib/frontend/search-filter";
import type { PropertyCardData } from "@/types/property";

/**
 * White box — Fitur 7: Pencarian / filter
 * Unit: lib/frontend/search-filter.ts (dipakai app/search/page.tsx)
 */

const card = (id: string, extra: Partial<PropertyCardData>): PropertyCardData => ({
  id,
  title: id,
  kategori: "Kosan",
  price: "Rp 1.000.000",
  biayaHidup: "",
  lokasi: "Bandung",
  luas: "-",
  lantai: "-",
  kt: "-",
  km: "-",
  fasilitas: [],
  images: [],
  listingType: "SEWA",
  ...extra,
});

const items = [
  card("a", { lokasi: "Dago, Bandung", price: "Rp 1.500.000" }),
  card("b", { lokasi: "Sleman, Jogja", price: "Rp 900.000", kategori: "Rumah" }),
  card("c", { lokasi: "Coblong, Bandung", price: "Rp 2.000.000" }),
];

describe("TC-WB-SRC — Pencarian", () => {
  it("TC-WB-SRC-01: kata kunci mengandung jenis properti → kategori terdeteksi; tanpa kata kunci jenis → null", () => {
    expect(detectCategory("kost putri dago")).toBe("Kosan");
    expect(detectCategory("dago bandung")).toBeNull();
  });

  it("TC-WB-SRC-02: filter kota (termasuk alias Jogja) dan jenis properti", () => {
    expect(filterSearchResults(items, { city: "Yogyakarta", kategori: null, sort: null }).map((p) => p.id)).toEqual(["b"]);
    expect(filterSearchResults(items, { city: "Bandung", kategori: "Kosan", sort: null }).map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("TC-WB-SRC-03: urut harga termurah dari teks harga berformat", () => {
    expect(filterSearchResults(items, { city: null, kategori: null, sort: "asc" }).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
});
