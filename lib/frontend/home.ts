/**
 * Helper halaman beranda (app/_components/home/*).
 */
import { type PropertyCardData, calculateDiscountedPrice, isDiscountStillActive } from '@/types/property';

/** "WATER_HEATER" -> "Water Heater", "AC" -> "AC" */
export function formatFacilityCode(code: string): string {
  return code
    .toLowerCase()
    .split('_')
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export const RECOMMENDATION_FALLBACK_IMAGES = ['/images/bgHomeKosan.jpeg', '/images/bgHomeApart.png'];

/** Foto kartu rekomendasi: semua foto, foto sampul, atau gambar cadangan bergiliran. */
export function recommendationImages(
  item: { images?: string[] | null; coverImageUrl?: string | null },
  idx: number,
): string[] {
  return item.images?.length
    ? item.images
    : [item.coverImageUrl ?? RECOMMENDATION_FALLBACK_IMAGES[idx % RECOMMENDATION_FALLBACK_IMAGES.length]];
}

export type DiscountItem = {
  prop: PropertyCardData;
  discount: number;
  originalPrice: string;
  discountedPrice: number;
};

/** Hanya properti dengan diskon aktif (data real dari owner) beserta harga setelah diskon. */
export function toDiscountItems(items: PropertyCardData[], now: Date = new Date()): DiscountItem[] {
  return items
    .filter((p) => isDiscountStillActive(p.discountPercentage, p.discountActiveUntil, now))
    .map((p) => {
      const discount = p.discountPercentage ?? 0;
      return {
        prop: p,
        discount,
        originalPrice: p.price,
        discountedPrice: calculateDiscountedPrice(p.price, discount),
      };
    });
}

/** Baca (lalu hapus) id bangunan hero yang terakhir di-hover; hanya id yang dikenal yang diterima. */
export function consumeSavedSpot(storageKey: string, knownIds: readonly string[]): string | null {
  try {
    const saved = sessionStorage.getItem(storageKey);
    sessionStorage.removeItem(storageKey);
    return saved && knownIds.includes(saved) ? saved : null;
  } catch {
    return null;
  }
}
