import { Readable } from 'node:stream';
import { requireAuth } from '@/lib/require-user';
import { cloudinary } from '@/lib/cloudinary';
import { MAX_REVIEW_PHOTO_BYTES, REVIEW_PHOTO_FOLDER } from '@/lib/review-photos';

export const runtime = 'nodejs';

function uploadBufferToCloudinary(buffer: Buffer) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: REVIEW_PHOTO_FOLDER,
        resource_type: 'image',
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }

        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

// POST /api/uploads/review — satu foto per request, supaya body tetap kecil
export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) {
    return auth.error;
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return Response.json({ message: 'File foto ulasan wajib diupload' }, { status: 400 });
  }

  if (!file.type.startsWith('image/')) {
    return Response.json({ message: 'File harus berupa gambar' }, { status: 400 });
  }

  if (file.size > MAX_REVIEW_PHOTO_BYTES) {
    return Response.json({ message: 'Ukuran file maksimal 5MB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadBufferToCloudinary(buffer);

  return Response.json({
    message: 'Upload berhasil',
    data: {
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    },
  });
}
