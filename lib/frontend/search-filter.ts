/**
 * Logika halaman pencarian (app/search/page.tsx): deteksi kategori dari kata kunci,
 * pencocokan kota, parsing harga, URL API, dan filter + urut di sisi klien.
 * Dipisah dari komponen supaya bisa diuji tanpa merender halaman.
 */
import type { PropertyCardData } from '@/types/property';

export type SearchKategori = 'Rumah' | 'Apartemen' | 'Kosan';
export type SearchCity = 'Jakarta' | 'Bandung' | 'Yogyakarta' | 'Semarang' | 'Surabaya';
export type SearchSort = 'asc' | 'desc' | null;

export const CATEGORY_KEYWORDS: Record<SearchKategori, string[]> = {
  Rumah: ['rumah', 'home', 'house'],
  Apartemen: ['apartemen', 'apartment', 'apt'],
  Kosan: ['kos', 'kost', 'kosan', 'boarding'],
};

export const CITY_KEYWORDS: Record<SearchCity, string[]> = {
  Jakarta: ['jakarta'],
  Bandung: ['bandung'],
  Yogyakarta: ['yogyakarta', 'jogja', 'jogjakarta', 'yogya'],
  Semarang: ['semarang'],
  Surabaya: ['surabaya'],
};

export function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ');
}

export function getTokens(value: string) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

export function detectCategory(query: string): SearchKategori | null {
  const tokens = getTokens(query);
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[SearchKategori, string[]]>) {
    if (tokens.some((token) => keywords.includes(token))) return category;
  }
  return null;
}

export function matchesCity(cityField: string, filterCity: SearchCity): boolean {
  const normalized = normalizeText(cityField);
  const keywords = CITY_KEYWORDS[filterCity].map((k) => k.toLowerCase());
  return keywords.some((kw) => normalized.includes(kw));
}

/** Extract numeric price from a formatted string like "Rp 2.500.000/bulan" */
export function parsePrice(priceStr: string): number {
  const digits = priceStr.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

export function buildPropertiesUrl(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `/api/properties?${query}` : '/api/properties';
}

/** URL rekomendasi saat pencarian kosong (kategori ditebak dari kata kunci). */
export function buildRecommendationUrl(query: string) {
  const detectedCategory = detectCategory(query);
  return buildPropertiesUrl({ kategori: detectedCategory ?? undefined, take: 6 });
}

/** Filter kota & kategori lalu urutkan harga, di atas data yang sudah diambil dari API. */
export function filterSearchResults(
  items: PropertyCardData[],
  filters: { city: SearchCity | null; kategori: SearchKategori | null; sort: SearchSort },
): PropertyCardData[] {
  let result = [...items];

  if (filters.city) {
    const city = filters.city;
    result = result.filter((p) => matchesCity(p.lokasi ?? '', city));
  }

  if (filters.kategori) {
    result = result.filter((p) => p.kategori === filters.kategori);
  }

  if (filters.sort) {
    const sort = filters.sort;
    result.sort((a, b) => {
      const diff = parsePrice(String(a.price)) - parsePrice(String(b.price));
      return sort === 'asc' ? diff : -diff;
    });
  }

  return result;
}
