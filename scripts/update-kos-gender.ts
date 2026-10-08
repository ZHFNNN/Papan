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

  console.log(`Ditemukan ${kosans.length} properti kosan dummy. Merapikan judul dan menyematkan tag gender di deskripsi...`);

  const kosTypes = [
    { tag: "[Tipe: Khusus Putri]", note: "Khusus mahasiswi / karyawati putri." },
    { tag: "[Tipe: Khusus Putra]", note: "Khusus mahasiswa / pria." },
    { tag: "[Tipe: Campur]", note: "Bisa untuk putra maupun putri / pasutri." },
  ];

  let updatedCount = 0;

  for (let i = 0; i < kosans.length; i++) {
    const kos = kosans[i];
    const chosen = kosTypes[i % kosTypes.length];

    // Kembalikan judul ke format bersih aslinya ("Kosan di ...")
    const cleanTitle = kos.title.replace(/^Kost\s+(Putri|Putra|Campur)\b/i, "Kosan").trim();

    // Bersihkan deskripsi lama dari tag atau note ganda jika ada
    let cleanDesc = (kos.description ?? "")
      .replace(/^\[Tipe:[^\]]+\]\s*/i, "")
      .replace(/^Khusus mahasiswi \/ karyawati putri\.\s*/i, "")
      .replace(/^Khusus mahasiswa \/ pria\.\s*/i, "")
      .replace(/^Bisa untuk putra maupun putri \/ pasutri\.\s*/i, "")
      .trim();

    const finalDescription = `${chosen.tag} ${chosen.note} ${cleanDesc}`.trim();

    await prisma.property.update({
      where: { id: kos.id },
      data: {
        title: cleanTitle,
        description: finalDescription,
      },
    });

    updatedCount++;
  }

  console.log(`Sukses! ${updatedCount} kosan dummy berhasil dirapikan (judul bersih & tag gender di deskripsi).`);
}

main()
  .catch((e) => {
    console.error("Terjadi kesalahan:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
