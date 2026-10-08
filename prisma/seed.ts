import { hash } from "bcryptjs";
import { KycStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";

const DEFAULT_FACILITIES = [
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

const DUMMY_OWNER_EMAIL = "owner-demo@papan.local";

// Komponen deskripsi random agar tidak kembar
const DESC_PARTS = {
  intro: ["Hunian eksklusif", "Tempat tinggal nyaman", "Lokasi premium", "Pilihan cerdas hunian", "Akomodasi terbaik"],
  vibes: ["dengan lingkungan yang tenang", "di pusat keramaian kota", "dengan akses mudah ke perkantoran", "dekat dengan area kampus", "yang aman dan bebas banjir"],
  feature: ["Fasilitas lengkap untuk produktivitas.", "Desain modern minimalis.", "Sangat cocok untuk keluarga.", "Keamanan 24 jam terjamin.", "Pencahayaan sangat baik."]
};

function getRandomDesc() {
  const i = Math.floor(Math.random() * DESC_PARTS.intro.length);
  const v = Math.floor(Math.random() * DESC_PARTS.vibes.length);
  const f = Math.floor(Math.random() * DESC_PARTS.feature.length);
  return `${DESC_PARTS.intro[i]} ${DESC_PARTS.vibes[v]}. ${DESC_PARTS.feature[f]}`;
}

function buildFinalProperties() {
  const result = [];
  const cities = [
    { name: "Jakarta", lat: -6.2088, lng: 106.8456, dists: [
      { d: "Setiabudi", n: ["Kuningan", "Karet", "Sudirman"] },
      { d: "Menteng", n: ["Cikini", "Kebon Sirih", "Gondangdia"] },
      { d: "Tebet", n: ["Manggarai", "Menteng Dalam", "Kebon Baru"] }
    ]},
    { name: "Bandung", lat: -6.9175, lng: 107.6191, dists: [
      { d: "Coblong", n: ["Dago", "Lebak Siliwangi", "Sadang Serang"] },
      { d: "Sukajadi", n: ["Pasteur", "Cipedes", "Sukawarna"] },
      { d: "Lengkong", n: ["Malabar", "Burangrang", "Turangga"] }
    ]},
    { name: "Surabaya", lat: -7.2575, lng: 112.7521, dists: [
      { d: "Gubeng", n: ["Airlangga", "Mojo", "Kertajaya"] },
      { d: "Wonokromo", n: ["Darmo", "Jagir", "Sawunggaling"] },
      { d: "Tegalsari", n: ["Kedungdoro", "Keputran", "Dr. Soetomo"] }
    ]},
    { name: "Yogyakarta", lat: -7.7956, lng: 110.3695, dists: [
      { d: "Gondokusuman", n: ["Terban", "Kotabaru", "Demangan"] },
      { d: "Jetis", n: ["Gowongan", "Cokrodiningratan", "Bumijo"] },
      { d: "Depok", n: ["Caturtunggal", "Maguwoharjo", "Seturan"] }
    ]},
    { name: "Semarang", lat: -6.9932, lng: 110.4203, dists: [
      { d: "Semarang Tengah", n: ["Sekayu", "Miroto", "Brumbungan"] },
      { d: "Tembalang", n: ["Banyumanik", "Bulusan", "Sambiroto"] },
      { d: "Gajahmungkur", n: ["Sampangan", "Bendanduwur", "Lempongsari"] }
    ]}
  ];

  const categories: ('RUMAH' | 'APARTEMEN' | 'KOSAN')[] = ['RUMAH', 'APARTEMEN', 'KOSAN'];
  const baseFacs = ["AC", "WIFI", "WATER_HEATER", "DEKAT_TRANSPORTASI", "KAMAR_MANDI_DALAM", "DAPUR", "PARKIR_MOBIL", "PET_FRIENDLY"];

  let globalCount = 1;

  for (const cityInfo of cities) {
    for (const cat of categories) {
      for (let i = 0; i < 15; i++) {
        // Pilih District & Neighbourhood secara dinamis
        const distData = cityInfo.dists[i % 3];
        const neighbourhood = distData.n[Math.floor(Math.random() * distData.n.length)];

        // Listing Type Logic
        let lType = "RENT";
        if (cat === "RUMAH") lType = "SALE";
        else if (cat === "APARTEMEN") lType = Math.random() > 0.5 ? "SALE" : "RENT";

        // Acak Fasilitas
        const facilityCodes = [...baseFacs].sort(() => 0.5 - Math.random()).slice(0, Math.floor(Math.random() * 4) + 4);
        facilityCodes.push(Math.random() > 0.5 ? "FURNISHED" : "UNFURNISHED");

        // Harga
        let basePrice = cat === "RUMAH" ? 1_800_000_000 : cat === "APARTEMEN" ? 750_000_000 : 2_000_000;
        if (lType === "RENT" && cat !== "KOSAN") basePrice = 6_000_000;
        const price = basePrice + (Math.floor(Math.random() * 30) * 100_000);

        let title = `${cat.charAt(0) + cat.slice(1).toLowerCase()} di ${neighbourhood} #${globalCount}`;
        let description = getRandomDesc();

        // Variasikan tipe kosan berdasarkan target penghuni (gender) di deskripsi
        if (cat === "KOSAN") {
          const kosTypes = [
            { tag: "Khusus Putri", note: "Khusus mahasiswi / karyawati putri." },
            { tag: "Khusus Putra", note: "Khusus mahasiswa / pria." },
            { tag: "Campur", note: "Bisa untuk putra maupun putri / pasutri." },
          ];
          const chosen = kosTypes[i % kosTypes.length];
          title = `Kosan di ${neighbourhood} #${globalCount}`;
          description = `[Tipe: ${chosen.tag}] ${chosen.note} ${description}`;
        }

        result.push({
          title,
          category: cat,
          description,
          price,
          listingType: lType,
          facilityCodes,
          address: `Jl. Strategis No. ${globalCount}, ${neighbourhood}, ${cityInfo.name}`,
          city: cityInfo.name,
          district: distData.d,
          neighbourhood: neighbourhood,
          latitude: Number((cityInfo.lat + (Math.random() - 0.5) * 0.04).toFixed(6)),
          longitude: Number((cityInfo.lng + (Math.random() - 0.5) * 0.04).toFixed(6)),
          imageUrls: ["https://images.unsplash.com/photo-1560185007-cde436f6a4d0?w=1200"],
        });
        globalCount++;
      }
    }
  }
  return result;
}

async function main() {
  console.log("🚀 Membersihkan data lama dan memproses 225 data dengan neighbourhood asli...");

  await Promise.all(DEFAULT_FACILITIES.map(f => prisma.facility.upsert({ where: { code: f.code }, update: {}, create: f })));

  const hashedPassword = await hash("password123", 10);
  const dummyOwner = await prisma.user.upsert({
    where: { email: DUMMY_OWNER_EMAIL },
    update: {},
    create: { email: DUMMY_OWNER_EMAIL, name: "Owner Demo", passwordHash: hashedPassword, role: Role.OWNER, kycStatus: KycStatus.APPROVED },
  });

  const facilityByCode = new Map((await prisma.facility.findMany()).map(f => [f.code, f.id]));

  // Hapus semua data dummy sebelumnya agar bersih
  await prisma.property.deleteMany({ where: { ownerId: dummyOwner.id } });

  const FINAL_PROPERTIES = buildFinalProperties();
  
  for (const item of FINAL_PROPERTIES) {
    const property = await prisma.property.create({
      data: {
        ownerId: dummyOwner.id,
        title: item.title,
        address: item.address,
        city: item.city,
        district: item.district,
        neighbourhood: item.neighbourhood,
        latitude: item.latitude,
        longitude: item.longitude,
        imageUrls: item.imageUrls,
        description: item.description,
        price: item.price,
        listingType: item.listingType,
        category: item.category,
      },
    });

    const fIds = item.facilityCodes.map(c => facilityByCode.get(c)).filter((id): id is string => !!id);
    if (fIds.length > 0) {
      await prisma.propertyFacility.createMany({
        data: fIds.map(fId => ({ propertyId: property.id, facilityId: fId })),
      });
    }
  }

  console.log("✅ SELESAI! 225 data dengan lokasi nyata sudah masuk.");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });