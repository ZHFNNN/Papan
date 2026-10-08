/**
 * Memindahkan foto KYC lama (URL publik Cloudinary) menjadi tipe `authenticated`,
 * lalu mengganti isi kolom di database dengan public_id-nya.
 *
 * Dry-run (default, tidak mengubah apa pun):
 *   npx tsx --env-file=.env scripts/migrate-kyc-images-private.ts
 * Jalankan sungguhan:
 *   npx tsx --env-file=.env scripts/migrate-kyc-images-private.ts --apply
 *
 * Aman dijalankan ulang: foto yang sudah privat dilewati.
 */
import { cloudinary } from '../lib/cloudinary';
import { isLegacyKycImageUrl, parseLegacyCloudinaryUrl } from '../lib/kyc-image';
import { prisma } from '../lib/prisma';

const FIELDS = ['ktpImageUrl', 'selfieImageUrl'] as const;

async function makePrivate(publicId: string) {
  try {
    await cloudinary.uploader.rename(publicId, publicId, {
      type: 'upload',
      to_type: 'authenticated',
      invalidate: true,
    });
  } catch (error) {
    // Bisa terjadi kalau run sebelumnya sudah memindahkan foto ini tapi gagal
    // menyimpan ke database. Lanjutkan kalau versi privatnya memang sudah ada.
    const alreadyPrivate = await cloudinary.api
      .resource(publicId, { type: 'authenticated' })
      .then(() => true)
      .catch(() => false);
    if (!alreadyPrivate) throw error;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(apply ? '🔒 Mode APPLY: foto akan dipindahkan.' : '🔍 Mode DRY-RUN: tidak ada yang diubah.');

  const submissions = await prisma.kycSubmission.findMany({
    select: { id: true, ktpImageUrl: true, selfieImageUrl: true },
  });

  let migrated = 0;
  let skipped = 0;
  let manual = 0;
  let failed = 0;

  for (const submission of submissions) {
    for (const field of FIELDS) {
      const value = submission[field];

      if (!isLegacyKycImageUrl(value)) {
        skipped++;
        continue;
      }

      const parsed = parseLegacyCloudinaryUrl(value);
      if (!parsed) {
        console.warn(`⚠️  ${submission.id}.${field}: bukan URL Cloudinary, cek manual -> ${value}`);
        manual++;
        continue;
      }

      if (!apply) {
        console.log(`• ${submission.id}.${field}: ${parsed.publicId}`);
        migrated++;
        continue;
      }

      try {
        await makePrivate(parsed.publicId);
        await prisma.kycSubmission.update({
          where: { id: submission.id },
          data: { [field]: parsed.publicId },
        });
        console.log(`✅ ${submission.id}.${field}: ${parsed.publicId}`);
        migrated++;
      } catch (error) {
        console.error(`❌ ${submission.id}.${field}:`, error);
        failed++;
      }
    }
  }

  console.log('');
  console.log(`${apply ? 'Dipindahkan' : 'Akan dipindahkan'}: ${migrated}`);
  console.log(`Sudah privat (dilewati): ${skipped}`);
  console.log(`Perlu dicek manual: ${manual}`);
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
