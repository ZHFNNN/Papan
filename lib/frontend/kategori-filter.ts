/**
 * Logika filter halaman kategori (app/kategori/[kategori]/KategoriPage.tsx):
 * tipe listing, kota, rentang harga, fasilitas, urutan, jumlah filter aktif,
 * dan batas geser slider harga.
 */
import type { PropertyCardData } from '@/types/property';

export type KategoriSortKey = 'default' | 'price_asc' | 'price_desc' | 'newest';
export type KategoriListingType = 'RENT' | 'SELL' | null;

export type KategoriFilters = {
  listing: KategoriListingType;
  city: string | null;
  priceRange: [number, number];
  facilities: string[];
  sort: KategoriSortKey;
};

export const KATEGORI_MAX_PRICE = 50_000_000;
export const PRICE_SLIDER_STEP = 500_000;

export function parseRawPrice(price: string | number): number {
  if (typeof price === 'number') return price;
  return parseInt(String(price).replace(/[^0-9]/g, ''), 10) || 0;
}

export function filterKategoriItems(
  items: PropertyCardData[],
  filters: KategoriFilters,
  maxPrice: number = KATEGORI_MAX_PRICE,
): PropertyCardData[] {
  let result = [...items];

  // Listing type
  if (filters.listing) {
    result = result.filter((p) => p.listingType === filters.listing);
  }

  // City
  if (filters.city) {
    const city = filters.city.toLowerCase();
    result = result.filter((p) => (p.lokasi ?? '').toLowerCase().includes(city));
  }

  // Price range (batas atas = maxPrice berarti tanpa batas)
  const [low, high] = filters.priceRange;
  result = result.filter((p) => {
    const raw = parseRawPrice(p.price);
    return raw >= low && (high >= maxPrice || raw <= high);
  });

  // Facilities — properti harus punya SEMUA fasilitas yang dipilih
  if (filters.facilities.length > 0) {
    result = result.filter((p) =>
      filters.facilities.every((fc) => p.fasilitas.some((f) => f.toLowerCase().includes(fc.toLowerCase()))),
    );
  }

  // Sort
  if (filters.sort === 'price_asc') result.sort((a, b) => parseRawPrice(a.price) - parseRawPrice(b.price));
  else if (filters.sort === 'price_desc') result.sort((a, b) => parseRawPrice(b.price) - parseRawPrice(a.price));
  else if (filters.sort === 'newest') result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return result;
}

export function countActiveFilters(filters: KategoriFilters, maxPrice: number = KATEGORI_MAX_PRICE): number {
  return [
    filters.city !== null,
    filters.listing !== null,
    filters.facilities.length > 0,
    filters.priceRange[0] > 0 || filters.priceRange[1] < maxPrice,
  ].filter(Boolean).length;
}

/** Tambah / hapus kode fasilitas dari daftar filter. */
export function toggleFacilityCode(current: string[], code: string): string[] {
  return current.includes(code) ? current.filter((f) => f !== code) : [...current, code];
}

/** Gagang kiri slider tidak boleh melewati gagang kanan (jarak minimal satu langkah). */
export function clampSliderLow(next: number, high: number, step: number = PRICE_SLIDER_STEP): number {
  return Math.min(next, high - step);
}

/** Gagang kanan slider tidak boleh melewati gagang kiri (jarak minimal satu langkah). */
export function clampSliderHigh(next: number, low: number, step: number = PRICE_SLIDER_STEP): number {
  return Math.max(next, low + step);
}
