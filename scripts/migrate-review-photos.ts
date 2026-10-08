/**
 * Memindahkan foto ulasan lama (data URI base64 di kolom Review.imageUrls)
 * ke Cloudinary, lalu menggantinya dengan URL.
 *
 * Dry-run (default, tidak mengubah apa pun):
 *   npx tsx --env-file=.env scripts/migrate-review-photos.ts
 * Jalankan sungguhan:
 *   npx tsx --env-file=.env scripts/migrate-review-photos.ts --apply
 *
 * Aman dijalankan ulang: foto yang sudah berupa URL dilewati.
 */
import { cloudinary } from '../lib/cloudinary';
import { prisma } from '../lib/prisma';
import { REVIEW_PHOTO_FOLDER, isBase64ImageDataUri } from '../lib/review-photos';

const BATCH_SIZE = 20;

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '📤 Mode APPLY: foto akan dipindahkan.' : '🔍 Mode DRY-RUN: tidak ada yang diubah.');

  let cursor: string | undefined;
  let reviewsTouched = 0;
  let photosMoved = 0;
  let bytesFreed = 0;
  let failed = 0;

  // Diproses per batch supaya base64 tidak dimuat sekaligus ke memori
  for (;;) {
    const reviews = await prisma.review.findMany({
      select: { id: true, imageUrls: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (reviews.length === 0) break;
    cursor = reviews[reviews.length - 1].id;

    for (const review of reviews) {
      const base64Count = review.imageUrls.filter(isBase64ImageDataUri).length;
      if (base64Count === 0) continue;

      const size = review.imageUrls.filter(isBase64ImageDataUri).reduce((sum, uri) => sum + uri.length, 0);

      if (!apply) {
        console.log(`• ${review.id}: ${base64Count} foto (~${(size / 1024 / 1024).toFixed(2)} MB)`);
        reviewsTouched++;
        photosMoved += base64Count;
        bytesFreed += size;
        continue;
      }

      try {
        const nextUrls: string[] = [];
        for (const value of review.imageUrls) {
          if (!isBase64ImageDataUri(value)) {
            nextUrls.push(value);
            continue;
          }
          const uploaded = await cloudinary.uploader.upload(value, {
            folder: REVIEW_PHOTO_FOLDER,
            resource_type: 'image',
          });
          nextUrls.push(uploaded.secure_url);
        }

        await prisma.review.update({
          where: { id: review.id },
          data: { imageUrls: nextUrls },
        });

        console.log(`✅ ${review.id}: ${base64Count} foto dipindahkan`);
        reviewsTouched++;
        photosMoved += base64Count;
        bytesFreed += size;
      } catch (error) {
        console.error(`❌ ${review.id}:`, error);
        failed++;
      }
    }
  }

  console.log('');
  console.log(`${apply ? 'Ulasan diperbarui' : 'Ulasan yang akan diperbarui'}: ${reviewsTouched}`);
  console.log(`${apply ? 'Foto dipindahkan' : 'Foto yang akan dipindahkan'}: ${photosMoved}`);
  console.log(`Ukuran base64 di database: ~${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);
  if (apply) console.log(`Gagal (jalankan ulang script): ${failed}`);
}

main()
  .catch((e) => {
    console.error('Error saat migrasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
