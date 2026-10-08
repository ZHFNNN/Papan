import { requireAuth } from '@/lib/require-user';
import { uploadImageBuffer } from '@/lib/cloudinary';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_FOLDER } from '@/lib/review-photos';
import { readImageFile } from '@/lib/upload';

export const runtime = 'nodejs';

// POST /api/uploads/review — satu foto per request, supaya body tetap kecil
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return auth.error;
  }

  const image = await readImageFile(request, { label: 'File foto ulasan', maxBytes: MAX_REVIEW_PHOTO_BYTES });
  if ('error' in image) return image.error;

  const uploaded = await uploadImageBuffer(image.buffer, { folder: REVIEW_PHOTO_FOLDER });

  return Response.json({
    message: 'Upload berhasil',
    data: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    },
  });
}
