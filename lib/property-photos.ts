// Aturan foto properti saat owner mendaftarkan properti baru.
export const MIN_PROPERTY_PHOTOS = 4;

/** Ambil URL foto yang valid: hanya string non-kosong, di-trim, tanpa duplikat. */
export function sanitizePhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const urls = input
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  return Array.from(new Set(urls));
}

export function hasEnoughPhotos(count: number): boolean {
  return count >= MIN_PROPERTY_PHOTOS;
}

export function minPhotosMessage(current = 0): string {
  return `Minimal ${MIN_PROPERTY_PHOTOS} foto properti diperlukan (baru ${current}).`;
}
