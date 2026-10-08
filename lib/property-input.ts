import type { PropertyCategory } from '@prisma/client';

export const PROPERTY_CATEGORIES = ['RUMAH', 'APARTEMEN', 'KOSAN'] as const satisfies readonly PropertyCategory[];
export const LISTING_TYPES = ['JUAL', 'SEWA'] as const;
export const KOSAN_GENDER_TARGETS = ['PUTRA', 'PUTRI', 'CAMPUR'] as const;

export type ListingType = (typeof LISTING_TYPES)[number];
export type KosanGenderTarget = (typeof KOSAN_GENDER_TARGETS)[number];

/** "rumah" / " Kosan " -> RUMAH / KOSAN. Nilai lain -> null. */
export function normalizeCategory(category: unknown): PropertyCategory | null {
  if (typeof category !== 'string') return null;
  const normalized = category.trim().toUpperCase();
  return (PROPERTY_CATEGORIES as readonly string[]).includes(normalized)
    ? (normalized as PropertyCategory)
    : null;
}

/** Simpan listingType sebagai JUAL / SEWA (SELL, RENT, KOSAN dari form lama ikut dipetakan). */
export function normalizeListingType(listingType: unknown): ListingType | null {
  if (typeof listingType !== 'string') return null;
  const normalized = listingType.trim().toUpperCase();
  if (normalized === 'SELL') return 'JUAL';
  if (normalized === 'RENT' || normalized === 'KOSAN') return 'SEWA';
  return (LISTING_TYPES as readonly string[]).includes(normalized) ? (normalized as ListingType) : null;
}

/** "putri" -> PUTRI. Nilai lain -> null. */
export function normalizeGenderTarget(genderTarget: unknown): KosanGenderTarget | null {
  if (typeof genderTarget !== 'string') return null;
  const normalized = genderTarget.trim().toUpperCase();
  return (KOSAN_GENDER_TARGETS as readonly string[]).includes(normalized)
    ? (normalized as KosanGenderTarget)
    : null;
}

/** Kode fasilitas untuk nama fasilitas yang diketik owner: "Kolam Renang" -> custom_kolam_renang. */
export function customFacilityCode(name: string): string {
  return `custom_${name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
}
