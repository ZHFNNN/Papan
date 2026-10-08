import { prisma } from '../lib/prisma';

async function main() {
  console.log('🔄 Memulai migrasi genderTarget dan pembersihan deskripsi...');

  const properties = await prisma.property.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      genderTarget: true,
      owner: { select: { email: true } },
    },
  });

  console.log(`Ditemukan total ${properties.length} properti.`);

  let kosanUpdated = 0;
  let otherUpdated = 0;

  for (const prop of properties) {
    if (prop.category === 'KOSAN') {
      let genderTarget: 'PUTRA' | 'PUTRI' | 'CAMPUR' = 'CAMPUR';
      const desc = prop.description || '';

      if (desc.includes('[Tipe: Khusus Putri]')) {
        genderTarget = 'PUTRI';
      } else if (desc.includes('[Tipe: Khusus Putra]')) {
        genderTarget = 'PUTRA';
      } else if (desc.includes('[Tipe: Campur]')) {
        genderTarget = 'CAMPUR';
      } else {
        const text = `${prop.title} ${desc}`.toLowerCase();
        if (text.includes('putri')) genderTarget = 'PUTRI';
        else if (text.includes('putra')) genderTarget = 'PUTRA';
        else genderTarget = 'CAMPUR';
      }

      // Bersihkan tag [Tipe: ...] dari deskripsi
      const cleanedDesc = desc.replace(/^\[Tipe:[^\]]+\]\s*/i, '').trim();

      await prisma.property.update({
        where: { id: prop.id },
        data: {
          genderTarget,
          description: cleanedDesc,
        },
      });
      kosanUpdated++;
    } else {
      // Non-kosan (Rumah / Apartemen): genderTarget harus null
      if (prop.genderTarget !== null) {
        await prisma.property.update({
          where: { id: prop.id },
          data: {
            genderTarget: null,
          },
        });
        otherUpdated++;
      }
    }
  }

  console.log(`✅ Selesai!`);
  console.log(`- Kosan diperbarui (genderTarget terisi & deskripsi bersih): ${kosanUpdated}`);
  console.log(`- Non-kosan dipastikan null: ${otherUpdated}`);
}

main()
  .catch((e) => {
    console.error('Error saat migrasi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
