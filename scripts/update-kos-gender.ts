import { prisma } from "../lib/prisma";

async function main() {
  console.log("Mencari properti kategori KOSAN di database...");

  const kosans = await prisma.property.findMany({
    where: {
      category: "KOSAN",
      owner: { email: "owner-demo@papan.local" },
    },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: "asc" },
  });

  if (kosans.length === 0) {
    console.log("Tidak ada properti kategori KOSAN yang ditemukan.");
    return;
  }

  console.log(`Ditemukan ${kosans.length} properti kosan. Memulai pembaruan variasi gender...`);

  const kosTypes = [
    { prefix: "Kost Putri", note: "Khusus mahasiswi / karyawati putri." },
    { prefix: "Kost Putra", note: "Khusus mahasiswa / pria." },
    { prefix: "Kost Campur", note: "Bisa untuk putra maupun putri / pasutri." },
  ];

  let updatedCount = 0;

  for (let i = 0; i < kosans.length; i++) {
    const kos = kosans[i];
    const lowerTitle = kos.title.toLowerCase();

    const alreadyLabeled =
      lowerTitle.includes("putri") ||
      lowerTitle.includes("putra") ||
      lowerTitle.includes("campur");

    if (alreadyLabeled) {
      continue;
    }

    const chosen = kosTypes[i % kosTypes.length];
    const newTitle = kos.title.replace(/^Kosan\b/i, chosen.prefix).trim();
    const finalTitle = newTitle.startsWith(chosen.prefix)
      ? newTitle
      : `${chosen.prefix} ${newTitle}`;

    const newDescription = kos.description
      ? `${chosen.note} ${kos.description}`
      : chosen.note;

    await prisma.property.update({
      where: { id: kos.id },
      data: {
        title: finalTitle,
        description: newDescription,
      },
    });

    updatedCount++;
  }

  console.log(`Sukses! ${updatedCount} kosan berhasil diperbarui dengan variasi gender.`);
}

main()
  .catch((e) => {
    console.error("Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
