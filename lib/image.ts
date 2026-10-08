/** Lebar standar gambar per konteks tampilan. */
export const IMAGE_WIDTH = {
  thumb: 160,
  card: 640,
  detail: 1280,
} as const;

const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';

/**
 * Mengecilkan URL gambar sesuai lebar tampilan supaya browser tidak
 * mengunduh file aslinya (bisa beberapa MB).
 * - Cloudinary: sisipkan transformasi resize + format/kualitas otomatis.
 * - Unsplash: atur parameter `w`.
 * - Lainnya (file lokal / blob): dikembalikan apa adanya.
 */
export function optimizeImage(src: string | null | undefined, width: number = IMAGE_WIDTH.card): string {
  if (!src) return '';

  if (src.includes('res.cloudinary.com') && src.includes(CLOUDINARY_UPLOAD_SEGMENT)) {
    const [base, rest] = src.split(CLOUDINARY_UPLOAD_SEGMENT);
    // Jangan menumpuk transformasi kalau URL sudah punya transformasi sendiri
    if (/^[a-z]{1,3}_[^/]+\//.test(rest)) return src;
    return `${base}${CLOUDINARY_UPLOAD_SEGMENT}f_auto,q_auto,c_limit,w_${width}/${rest}`;
  }

  if (src.includes('images.unsplash.com')) {
    try {
      const url = new URL(src);
      url.searchParams.set('w', String(width));
      url.searchParams.set('q', '75');
      url.searchParams.set('auto', 'format');
      return url.toString();
    } catch {
      return src;
    }
  }

  return src;
}
