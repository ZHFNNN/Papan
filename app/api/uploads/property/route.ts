import { requireAuth } from '@/lib/require-user';
import { uploadImageBuffer } from '@/lib/cloudinary';
import { MB, readImageFile } from '@/lib/upload';
import { buildPropertyPhotoPublicId, hashBytes } from '@/lib/photo-hash';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return auth.error;
  }

  const image = await readImageFile(request, { label: 'File foto properti', maxBytes: 8 * MB });
  if ('error' in image) return image.error;

  // public_id berbasis isi file: foto yang sama selalu menghasilkan public_id yang sama,
  // sehingga duplikat bisa dikenali saat daftar foto properti disimpan.
  // Salin ke Uint8Array: Buffer Node tidak memenuhi tipe BufferSource milik Web Crypto
  const hash = await hashBytes(new Uint8Array(image.buffer));
  const uploaded = await uploadImageBuffer(image.buffer, {
    folder: 'papan/properties',
    public_id: buildPropertyPhotoPublicId(auth.session.user.id, hash),
  });

  return Response.json({
    message: 'Upload berhasil',
    data: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      hash,
    },
  });
}
