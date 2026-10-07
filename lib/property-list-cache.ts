/**
 * Cache memori untuk respons daftar properti publik (GET /api/properties).
 * Satu query daftar properti butuh ~1 detik karena latensi ke database,
 * padahal hasilnya sama untuk semua pengunjung. Cache dikosongkan setiap ada
 * properti / boost yang dibuat, diubah, atau dihapus.
 */
const TTL_MS = 30_000;
const MAX_ENTRIES = 100;

const cache = new Map<string, { body: unknown; expiresAt: number }>();

export function getCachedPropertyList(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.body;
}

export function setCachedPropertyList(key: string, body: unknown) {
  if (cache.size >= MAX_ENTRIES) {
    // Buang entri paling lama (Map menyimpan urutan insert)
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { body, expiresAt: Date.now() + TTL_MS });
}

export function invalidatePropertyListCache() {
  cache.clear();
}
