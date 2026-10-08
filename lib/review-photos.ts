/**
 * Foto ulasan diunggah ke Cloudinary lewat POST /api/uploads/review,
 * lalu ulasan hanya menyimpan URL-nya (bukan base64 di database).
 */

// Relatif (bukan '@/') supaya tetap jalan dari scripts/ via tsx
import { parseCloudinaryUploadUrl } from './image';

export const REVIEW_PHOTO_FOLDER = 'papan/reviews';
export const MAX_REVIEW_PHOTOS = 5;
export const MAX_REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

/** true kalau `url` adalah foto ulasan hasil upload ke akun Cloudinary PAPAN sendiri. */
export function isReviewPhotoUrl(url: unknown, cloudName: string | undefined): url is string {
  if (typeof url !== 'string' || !cloudName) return false;
  const parsed = parseCloudinaryUploadUrl(url);
  return (
    parsed !== null &&
    parsed.cloudName === cloudName &&
    parsed.publicId.startsWith(`${REVIEW_PHOTO_FOLDER}/`)
  );
}

/** Ulasan lama menyimpan foto sebagai data URI base64. */
export function isBase64ImageDataUri(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}
