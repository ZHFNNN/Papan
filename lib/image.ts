/** Lebar standar gambar per konteks tampilan. */
export const IMAGE_WIDTH = {
  thumb: 160,
  card: 640,
  detail: 1280,
} as const;

const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';
// secure_url hasil upload: /<cloud>/image/upload/v<versi>/<public_id>.<ext> (tanpa transformasi)
const CLOUDINARY_UPLOAD_PATH = /^\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)\.[a-z0-9]+$/i;

/**
 * Pecah secure_url Cloudinary menjadi nama cloud dan public_id, misalnya
 * https://res.cloudinary.com/demo/image/upload/v1712/papan/ktp/abc.jpg
 * -> { cloudName: 'demo', publicId: 'papan/ktp/abc' }.
 * Mengembalikan null untuk URL yang bukan upload gambar Cloudinary via https.
 */
export function parseCloudinaryUploadUrl(url: string): { cloudName: string; publicId: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') return null;

  let pathname: string;
  try {
    pathname = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  const match = CLOUDINARY_UPLOAD_PATH.exec(pathname);
  return match ? { cloudName: match[1], publicId: match[2] } : null;
}

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
