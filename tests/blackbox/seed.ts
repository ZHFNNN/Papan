/**
 * Data uji black box testing. HANYA untuk database lokal tests/blackbox/docker-compose.yml.
 *   node tests/blackbox/prisma-env.mjs npx tsx tests/blackbox/seed.ts
 *
 * Semua akun memakai password: papan123
 */
import { hash } from "bcryptjs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.includes("localhost:55432")) {
  throw new Error("Seed black box hanya boleh ke database uji lokal (localhost:55432).");
}

const prisma = new PrismaClient();
const PASSWORD = "papan123";
const DAY = 86_400_000;

const FACILITIES = [
  { code: "FURNISHED", name: "Furnished" },
  { code: "UNFURNISHED", name: "Unfurnished" },
  { code: "PET_FRIENDLY", name: "Pet-friendly" },
  { code: "PARKIR_MOBIL", name: "Parkir Mobil" },
  { code: "AC", name: "AC" },
  { code: "WATER_HEATER", name: "Water Heater" },
  { code: "DEKAT_TRANSPORTASI", name: "Dekat transportasi umum" },
  { code: "WIFI", name: "WiFi" },
  { code: "KAMAR_MANDI_DALAM", name: "Kamar mandi dalam" },
  { code: "DAPUR", name: "Dapur" },
];

const img = (seed: string) => [1, 2, 3, 4].map((n) => `https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200&sig=${seed}${n}`);

async function main() {
  // Bersihkan data (urutan menghormati foreign key)
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.conversation.deleteMany(),
    prisma.reviewReport.deleteMany(),
    prisma.reviewReply.deleteMany(),
    prisma.review.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.propertyBoost.deleteMany(),
    prisma.boostPaymentItem.deleteMany(),
    prisma.boostPayment.deleteMany(),
    prisma.boostCart.deleteMany(),
    prisma.propertyFacility.deleteMany(),
    prisma.property.deleteMany(),
    prisma.userPreferenceFacility.deleteMany(),
    prisma.userCriteriaWeight.deleteMany(),
    prisma.userPersonalization.deleteMany(),
    prisma.kycSubmission.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.facility.deleteMany(),
  ]);

  for (const f of FACILITIES) await prisma.facility.create({ data: f });
  const fac = new Map((await prisma.facility.findMany()).map((f) => [f.code, f.id]));

  const passwordHash = await hash(PASSWORD, 10);
  const verified = new Date("2026-01-01");
  const mkUser = (data: Record<string, unknown>) =>
    prisma.user.create({ data: { passwordHash, emailVerified: verified, ...data } as never });

  const budi = await mkUser({ email: "user@papan.test", username: "budi", name: "Budi Pencari", phoneNumber: "081100000001" });
  const sari = await mkUser({ email: "user2@papan.test", username: "sari", name: "Sari Penyewa", phoneNumber: "081100000002" });
  const owner = await mkUser({ email: "owner@papan.test", username: "pakowner", name: "Pak Owner", phoneNumber: "082200000001", role: "OWNER", kycStatus: "APPROVED" });
  const owner2 = await mkUser({ email: "owner2@papan.test", username: "buowner", name: "Bu Owner", phoneNumber: null, role: "OWNER", kycStatus: "APPROVED" });
  await mkUser({ email: "newowner@papan.test", username: "calonowner", name: "Calon Owner", phoneNumber: "081100000003" });
  const pending = await mkUser({ email: "pending@papan.test", username: "ownerpending", name: "Owner Pending", phoneNumber: "081100000004", kycStatus: "PENDING" });
  const pending2 = await mkUser({ email: "pending2@papan.test", username: "ownerpending2", name: "Owner Pending Dua", phoneNumber: "081100000005", kycStatus: "PENDING" });
  await mkUser({ email: "admin@papan.test", username: "admin", name: "Admin Papan", phoneNumber: "081100000009", role: "ADMIN" });
  await mkUser({ email: "unverified@papan.test", username: "belumverif", name: "Belum Verifikasi", phoneNumber: "081100000006", emailVerified: null });

  for (const [u, nik] of [[pending, "3273010101010004"], [pending2, "3273010101010005"]] as const) {
    await prisma.kycSubmission.create({
      data: {
        userId: u.id,
        nik,
        fullName: u.name ?? "Owner",
        phoneNumber: u.phoneNumber ?? "0811",
        province: "Jawa Barat",
        cityOrRegency: "Bandung",
        district: "Coblong",
        rt: "001",
        rw: "002",
        postalCode: "40132",
        ktpImageUrl: `papan/ktp/${u.id}/00000000-0000-4000-8000-000000000001`,
        selfieImageUrl: `papan/selfie/${u.id}/00000000-0000-4000-8000-000000000002`,
        status: "PENDING",
      },
    });
  }

  type P = {
    key: string;
    title: string;
    category: "KOSAN" | "RUMAH" | "APARTEMEN";
    listingType: string;
    price: number;
    city: string;
    district: string;
    neighbourhood: string;
    genderTarget?: "PUTRA" | "PUTRI" | "CAMPUR";
    facilities: string[];
    discount?: { pct: number; until: Date | null };
    ownerId?: string;
    daysAgo: number;
  };
  const props: P[] = [
    { key: "putri", title: "Kos Putri Melati Dago", category: "KOSAN", listingType: "SEWA", price: 1_500_000, city: "Bandung", district: "Coblong", neighbourhood: "Dago", genderTarget: "PUTRI", facilities: ["AC", "WIFI", "KAMAR_MANDI_DALAM"], discount: { pct: 20, until: new Date(Date.now() + 30 * DAY) }, daysAgo: 1 },
    { key: "putra", title: "Kos Putra Siliwangi", category: "KOSAN", listingType: "SEWA", price: 1_200_000, city: "Bandung", district: "Coblong", neighbourhood: "Lebak Siliwangi", genderTarget: "PUTRA", facilities: ["WIFI", "PARKIR_MOBIL"], daysAgo: 2 },
    { key: "campur", title: "Kos Campur Seturan", category: "KOSAN", listingType: "SEWA", price: 900_000, city: "Yogyakarta", district: "Depok", neighbourhood: "Seturan", genderTarget: "CAMPUR", facilities: ["WIFI", "DAPUR"], daysAgo: 3 },
    { key: "kos-lama", title: "Kos Lama Tembalang", category: "KOSAN", listingType: "RENT", price: 800_000, city: "Semarang", district: "Tembalang", neighbourhood: "Bulusan", genderTarget: "CAMPUR", facilities: ["WIFI"], daysAgo: 30 },
    { key: "rumah-jual", title: "Rumah Minimalis Menteng", category: "RUMAH", listingType: "JUAL", price: 1_850_000_000, city: "Jakarta", district: "Menteng", neighbourhood: "Cikini", facilities: ["PARKIR_MOBIL", "DAPUR", "PET_FRIENDLY"], daysAgo: 4 },
    { key: "rumah-sewa", title: "Rumah Sewa Sukajadi", category: "RUMAH", listingType: "SEWA", price: 4_500_000, city: "Bandung", district: "Sukajadi", neighbourhood: "Pasteur", facilities: ["PARKIR_MOBIL", "DAPUR", "FURNISHED"], discount: { pct: 10, until: new Date(Date.now() - 5 * DAY) }, daysAgo: 5 },
    { key: "apt-sewa", title: "Apartemen Gubeng Residence", category: "APARTEMEN", listingType: "SEWA", price: 6_500_000, city: "Surabaya", district: "Gubeng", neighbourhood: "Airlangga", facilities: ["AC", "WIFI", "WATER_HEATER"], discount: { pct: 15, until: null }, daysAgo: 6 },
    { key: "apt-jual", title: "Apartemen Kuningan City", category: "APARTEMEN", listingType: "JUAL", price: 750_000_000, city: "Jakarta", district: "Setiabudi", neighbourhood: "Kuningan", facilities: ["AC", "WATER_HEATER", "DEKAT_TRANSPORTASI"], daysAgo: 7 },
    { key: "boosted", title: "Kos Eksklusif Tebet (Boosted)", category: "KOSAN", listingType: "SEWA", price: 2_800_000, city: "Jakarta", district: "Tebet", neighbourhood: "Manggarai", genderTarget: "CAMPUR", facilities: ["AC", "WIFI"], daysAgo: 20 },
    { key: "owner2", title: "Rumah Bu Owner Lengkong", category: "RUMAH", listingType: "SEWA", price: 3_000_000, city: "Bandung", district: "Lengkong", neighbourhood: "Malabar", facilities: ["DAPUR"], ownerId: owner2.id, daysAgo: 8 },
  ];

  const created: Record<string, { id: string; title: string }> = {};
  for (const p of props) {
    const row = await prisma.property.create({
      data: {
        ownerId: p.ownerId ?? owner.id,
        title: p.title,
        description: `${p.title} — data uji black box. Lokasi strategis di ${p.neighbourhood}, ${p.city}.`,
        category: p.category,
        listingType: p.listingType,
        price: p.price,
        genderTarget: p.genderTarget ?? null,
        address: `Jl. Uji No. ${props.indexOf(p) + 1}`,
        city: p.city,
        district: p.district,
        neighbourhood: p.neighbourhood,
        latitude: -6.9,
        longitude: 107.6,
        imageUrls: img(p.key),
        discountPercentage: p.discount?.pct ?? null,
        discountActiveUntil: p.discount?.until ?? null,
        createdAt: new Date(Date.now() - p.daysAgo * DAY),
        facilities: { createMany: { data: p.facilities.map((c) => ({ facilityId: fac.get(c)! })) } },
      },
    });
    created[p.key] = row;
  }

  // Boost aktif (pembayaran PAID)
  const pay = await prisma.boostPayment.create({
    data: {
      orderId: "BOOST-SEED-1",
      ownerId: owner.id,
      provider: "MIDTRANS",
      status: "PAID",
      paymentMethod: "MIDTRANS",
      paymentType: "MIDTRANS",
      subtotal: 100_000,
      adminFee: 1_000,
      grossAmount: 101_000,
      settledAt: new Date(Date.now() - DAY),
      items: { create: [{ propertyId: created.boosted.id, propertyTitle: created.boosted.title, packageId: "mingguan", packageTitle: "Paket Mingguan", days: 7, price: 100_000 }] },
    },
  });
  await prisma.propertyBoost.create({
    data: {
      paymentId: pay.id,
      propertyId: created.boosted.id,
      ownerId: owner.id,
      packageId: "mingguan",
      packageTitle: "Paket Mingguan",
      days: 7,
      price: 100_000,
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + 6 * DAY),
    },
  });

  // Ulasan: Sari mengulas kos putri (untuk dilaporkan & dibalas); Sari mengulas rumah sewa (sudah dilaporkan Budi)
  const r1 = await prisma.review.create({ data: { userId: sari.id, propertyId: created.putri.id, rating: 4, comment: "Kamar bersih, ibu kos ramah.", imageUrls: [] } });
  const r2 = await prisma.review.create({ data: { userId: sari.id, propertyId: created["rumah-sewa"].id, rating: 1, comment: "Promo murah! Hubungi 0812xxxx untuk kos lain.", imageUrls: [] } });
  await prisma.reviewReport.create({ data: { reviewId: r2.id, reporterId: budi.id, reason: "Spam atau promosi" } });
  void r1;

  // Personalisasi Budi (perempuan → kos putra tidak boleh direkomendasikan)
  await prisma.userPersonalization.create({
    data: { userId: budi.id, location: "Dago, Coblong, Bandung", occupation: "Mahasiswa", budgetMin: 0, budgetMax: 2_000_000, gender: "Perempuan", prefAc: true },
  });
  await prisma.userCriteriaWeight.createMany({
    data: [
      { userId: budi.id, criteria: "BUDGET", weight: 3 },
      { userId: budi.id, criteria: "LOCATION", weight: 2 },
      { userId: budi.id, criteria: "FACILITIES", weight: 1 },
    ],
  });

  // Chat Sari ↔ Pak Owner
  const conv = await prisma.conversation.create({
    data: { propertyId: created.putra.id, userId: sari.id, ownerId: owner.id },
  });
  await prisma.message.createMany({
    data: [
      { conversationId: conv.id, senderId: sari.id, content: "Halo pak, kamar masih ada?", createdAt: new Date(Date.now() - 3 * 3600_000) },
      { conversationId: conv.id, senderId: owner.id, content: "Masih ada kak, silakan survei.", createdAt: new Date(Date.now() - 2 * 3600_000), isRead: false },
    ],
  });

  // Notifikasi untuk Pak Owner
  await prisma.notification.createMany({
    data: [
      { ownerId: owner.id, title: "Selamat datang di PAPAN", message: "Akun owner kamu sudah terverifikasi.", type: "ADMIN_BROADCAST", isRead: true },
      { ownerId: owner.id, title: "Peluang Memaksimalkan Keuntungan", message: "Pertimbangkan promo untuk properti kamu bulan ini.", type: "PROMO_SUGGESTION", isRead: false },
    ],
  });

  console.log("Seed black box selesai:", Object.keys(created).length, "properti; password semua akun:", PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
