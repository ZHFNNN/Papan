/**
 * Validasi foto properti kembar. Dua foto dianggap sama kalau isi filenya identik
 * (hash SHA-256), jadi mengganti nama file atau memilih file yang sama dua kali
 * tetap terdeteksi.
 *
 * Alurnya:
 * 1. Browser: foto yang sama ditolak begitu dipilih (`splitDuplicatePhotos`).
 * 2. Server: `/api/uploads/property` memakai hash isi file sebagai bagian public_id
 *    Cloudinary (`buildPropertyPhotoPublicId`), jadi foto identik selalu berakhir di
 *    public_id yang sama. `hasDuplicatePhotoUrls` lalu menolak daftar foto yang berisi
 *    public_id kembar, walau request dikirim langsung tanpa lewat form.
 *
 * Catatan: yang terdeteksi hanya file identik byte-per-byte. Foto yang sama tetapi
 * sudah di-resize / di-compress ulang / di-screenshot dianggap berbeda.
 */

// Relatif (bukan '@/') supaya tetap bisa diimpor dari mana saja
import { parseCloudinaryUploadUrl } from './image';

export const DUPLICATE_PHOTO_API_MESSAGE =
  'Foto properti tidak boleh sama. Gunakan foto yang berbeda untuk setiap foto.';

export type HashedPhoto = { file: File; hash: string };

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** SHA-256 (hex) dari isi data. Jalan di browser (HTTPS / localhost) dan Node. */
export async function hashBytes(data: BufferSource): Promise<string> {
  return toHex(await globalThis.crypto.subtle.digest('SHA-256', data));
}

/**
 * Hash isi file. Kalau Web Crypto tidak tersedia (halaman dibuka lewat HTTP biasa),
 * jatuh ke ciri file (ukuran + nama + waktu ubah) sebagai pengganti.
 */
export async function hashFile(file: File): Promise<string> {
  if (globalThis.crypto?.subtle) return hashBytes(await file.arrayBuffer());
  return `fallback-${file.size}-${file.lastModified}-${file.name}`;
}

/**
 * Pisahkan `files` jadi foto baru (`accepted`) dan foto kembar (`duplicates`).
 * Kembar = isinya sama dengan salah satu `knownHashes`, dengan foto lain dalam
 * `files` yang sama, atau dengan foto yang sudah tersimpan (`existingUrls`).
 */
export async function splitDuplicatePhotos(
  files: readonly File[],
  knownHashes: readonly string[],
  existingUrls: readonly string[] = [],
): Promise<{ accepted: HashedPhoto[]; duplicates: File[] }> {
  const seen = new Set(knownHashes);
  const accepted: HashedPhoto[] = [];
  const duplicates: File[] = [];

  for (const file of files) {
    const hash = await hashFile(file);
    // URL foto yang diunggah lewat form ini memuat hash isinya (lihat buildPropertyPhotoPublicId)
    const sameAsStored = existingUrls.some((url) => url.includes(hash));
    if (seen.has(hash) || sameAsStored) {
      duplicates.push(file);
    } else {
      seen.add(hash);
      accepted.push({ file, hash });
    }
  }

  return { accepted, duplicates };
}

/** Pesan error di form untuk foto yang ditolak karena kembar. */
export function duplicatePhotoMessage(names: readonly string[]): string {
  const shown = names.slice(0, 3).map((name) => `"${name}"`).join(', ');
  const rest = names.length > 3 ? ` dan ${names.length - 3} lainnya` : '';
  return `Foto ${shown}${rest} sama dengan foto yang sudah dipilih, jadi tidak ditambahkan. Gunakan foto yang berbeda.`;
}

/** public_id Cloudinary berbasis isi file: foto identik dari owner yang sama -> public_id sama. */
export function buildPropertyPhotoPublicId(userId: string, hash: string): string {
  return `${userId.replace(/[^a-zA-Z0-9]/g, '')}_${hash}`;
}

/** true kalau ada dua URL foto yang menunjuk ke gambar yang sama (versi URL diabaikan). */
export function hasDuplicatePhotoUrls(urls: readonly string[]): boolean {
  const keys = urls.map((url) => parseCloudinaryUploadUrl(url)?.publicId ?? url);
  return new Set(keys).size !== keys.length;
}
