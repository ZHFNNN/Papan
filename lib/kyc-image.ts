/**
 * Foto KYC (KTP & selfie) disimpan di Cloudinary dengan tipe `authenticated`,
 * jadi tidak bisa dibuka lewat URL publik. Kolom `ktpImageUrl` / `selfieImageUrl`
 * di database menyimpan public_id-nya, dan gambar hanya bisa dilihat lewat
 * GET /api/kyc/image/[kind] (pemilik pengajuan atau admin).
 *
 * Data lama masih berisi URL publik Cloudinary (`https://res.cloudinary.com/...`)
 * sampai dipindahkan dengan scripts/migrate-kyc-images-private.ts.
 */

// Relatif (bukan '@/') supaya tetap jalan dari scripts/ via tsx
import { parseCloudinaryUploadUrl } from './image';

export const KYC_IMAGE_KINDS = ['ktp', 'selfie'] as const;
export type KycImageKind = (typeof KYC_IMAGE_KINDS)[number];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isKycImageKind(value: string): value is KycImageKind {
  return (KYC_IMAGE_KINDS as readonly string[]).includes(value);
}

/** public_id untuk foto KYC baru: papan/<kind>/<userId>/<uuid>. */
export function buildKycImagePublicId(kind: KycImageKind, userId: string, id: string): string {
  return `papan/${kind}/${userId}/${id}`;
}

/** true kalau `ref` adalah public_id hasil upload KYC milik `userId` sendiri. */
export function isOwnKycImageRef(ref: unknown, kind: KycImageKind, userId: string): ref is string {
  if (typeof ref !== 'string' || !userId) return false;
  const prefix = `papan/${kind}/${userId}/`;
  return ref.startsWith(prefix) && UUID_PATTERN.test(ref.slice(prefix.length));
}

/**
 * Foto yang boleh dipakai saat submit KYC: hasil upload milik user sendiri,
 * atau foto yang sudah tersimpan di pengajuan sebelumnya (kirim ulang setelah ditolak).
 */
export function isAcceptableKycImageRef(
  ref: unknown,
  kind: KycImageKind,
  userId: string,
  currentRef: string | null | undefined,
): ref is string {
  if (isOwnKycImageRef(ref, kind, userId)) return true;
  return typeof ref === 'string' && ref.length > 0 && ref === currentRef;
}

/** Data lama menyimpan URL lengkap, data baru menyimpan public_id. */
export function isLegacyKycImageUrl(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

/**
 * Ambil public_id dari URL publik Cloudinary lama, misalnya
 * https://res.cloudinary.com/demo/image/upload/v1712/papan/ktp/abc.jpg -> papan/ktp/abc.
 * Mengembalikan null untuk URL yang bukan upload gambar Cloudinary.
 */
export function parseLegacyCloudinaryUrl(url: string): { publicId: string } | null {
  const parsed = parseCloudinaryUploadUrl(url);
  return parsed ? { publicId: parsed.publicId } : null;
}
