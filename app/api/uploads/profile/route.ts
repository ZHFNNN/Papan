import { requireAuth } from '@/lib/require-user';
import { uploadImageBuffer } from '@/lib/cloudinary';
import { MB, readImageFile } from '@/lib/upload';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return auth.error;
  }

  const image = await readImageFile(request, { label: 'File foto profil', maxBytes: 5 * MB });
  if ('error' in image) return image.error;

  const uploaded = await uploadImageBuffer(image.buffer, { folder: 'papan/profile' });

  return Response.json({
    message: 'Upload berhasil',
    data: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    },
  });
}
