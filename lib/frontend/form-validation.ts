/**
 * Validasi form di sisi klien. Sebelumnya fungsi `validate()` ditulis di dalam
 * masing-masing komponen; dipindah ke sini (perilaku sama) supaya setiap cabang
 * pesan error bisa diuji langsung.
 */
import { DUPLICATE_PHOTO_API_MESSAGE } from '@/lib/photo-hash';
import { KOSAN_GENDER_REQUIRED_MESSAGE } from '@/lib/property-input';
import { MIN_PROPERTY_PHOTOS } from '@/types/property';

type Errors<K extends string> = Partial<Record<K, string>>;

// ─── Register ────────────────────────────────────────────────

export type RegisterForm = {
  name: string;
  username: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

/** Mengembalikan pesan error pertama, atau null kalau form boleh dikirim. */
export function validateRegisterForm(form: RegisterForm): string | null {
  if (!form.name || !form.username || !form.email || !form.phoneNumber || !form.password) {
    return 'Harap isi semua field yang wajib!';
  }
  if (form.password !== form.confirmPassword) {
    return 'Password dan konfirmasi password tidak cocok!';
  }
  return null;
}

// ─── KYC ─────────────────────────────────────────────────────

export type KycForm = {
  nik: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  cityOrRegency: string;
  district: string;
  rt: string;
  rw: string;
  postalCode: string;
  ktpImageUrl: string;
  selfieImageUrl: string;
};

export function validateKycForm(form: KycForm): Errors<keyof KycForm> {
  const errs: Errors<keyof KycForm> = {};
  if (!/^\d{16}$/.test(form.nik))           errs.nik           = 'NIK harus tepat 16 digit.';
  if (form.fullName.trim().length < 3)       errs.fullName      = 'Nama minimal 3 karakter.';
  if (form.phoneNumber.trim().length < 8)    errs.phoneNumber   = 'Nomor HP minimal 8 karakter.';
  if (form.province.trim().length < 2)       errs.province      = 'Provinsi wajib diisi.';
  if (form.cityOrRegency.trim().length < 2)  errs.cityOrRegency = 'Kota/Kabupaten wajib diisi.';
  if (form.district.trim().length < 2)       errs.district      = 'Kecamatan wajib diisi.';
  if (!/^\d{1,3}$/.test(form.rt))            errs.rt            = 'RT tidak valid.';
  if (!/^\d{1,3}$/.test(form.rw))            errs.rw            = 'RW tidak valid.';
  if (!/^\d{5}$/.test(form.postalCode))      errs.postalCode    = 'Kode pos harus 5 digit.';
  if (!form.ktpImageUrl)                     errs.ktpImageUrl    = 'Foto KTP wajib diunggah.';
  if (!form.selfieImageUrl)                  errs.selfieImageUrl = 'Selfie wajib diunggah.';
  return errs;
}

// ─── Properti (tambah & edit) ────────────────────────────────

export type PropertyFormFields = {
  title: string;
  address: string;
  locationLat: number | null;
  locationLng: number | null;
  price: string;
  description: string;
  listingType: string;
  category: string;
  genderTarget: string;
  /** Hanya di form edit */
  discountPercentage?: string;
  discountActiveUntil?: string;
};

export type PropertyFormErrorKey =
  | 'title' | 'address' | 'price' | 'description' | 'listingType' | 'category'
  | 'genderTarget' | 'photos' | 'discountPercentage' | 'discountActiveUntil';

export type PropertyPhotoState = {
  /** Jumlah foto total (yang sudah tersimpan + yang baru dipilih) */
  totalCount: number;
  /** Hash isi file foto yang baru dipilih */
  newHashes: readonly string[];
  /** Jumlah foto yang baru dipilih */
  newCount: number;
  /** Teks jumlah foto di pesan minimal foto ("kamu baru memilih" / "saat ini") */
  countLabel: 'kamu baru memilih' | 'saat ini';
};

export function validatePropertyForm(
  form: PropertyFormFields,
  photos: PropertyPhotoState,
  now: Date = new Date(),
): Errors<PropertyFormErrorKey> {
  const errs: Errors<PropertyFormErrorKey> = {};
  if (!form.title.trim()) errs.title = 'Nama properti wajib diisi.';
  if (!form.address.trim() || form.locationLat == null || form.locationLng == null) {
    errs.address = 'Lokasi wajib dipilih lewat peta.';
  }
  if (!form.price.trim()) errs.price = 'Harga wajib diisi.';
  else if (Number.isNaN(Number(form.price.replace(/[^0-9]/g, '')))) errs.price = 'Harga harus berupa angka.';
  if (!form.description.trim()) errs.description = 'Deskripsi wajib diisi.';
  if (!form.listingType) errs.listingType = 'Tipe listing wajib dipilih.';
  if (!form.category) errs.category = 'Kategori properti wajib dipilih.';
  if (form.category === 'KOSAN' && !form.genderTarget) {
    errs.genderTarget = KOSAN_GENDER_REQUIRED_MESSAGE;
  }
  if (photos.totalCount < MIN_PROPERTY_PHOTOS) {
    errs.photos = `Minimal ${MIN_PROPERTY_PHOTOS} foto properti (${photos.countLabel} ${photos.totalCount}).`;
  } else if (new Set(photos.newHashes).size !== photos.newCount) {
    errs.photos = DUPLICATE_PHOTO_API_MESSAGE;
  }

  // Diskon hanya ada di form edit dan bersifat opsional
  const discRaw = form.discountPercentage?.trim() ?? '';
  if (discRaw !== '') {
    const pct = Number(discRaw);
    if (!Number.isFinite(pct) || !Number.isInteger(pct) || pct < 1 || pct > 99) {
      errs.discountPercentage = 'Diskon harus bilangan bulat 1-99.';
    }
  }
  const untilRaw = form.discountActiveUntil?.trim() ?? '';
  if (untilRaw !== '') {
    const expiry = new Date(form.discountActiveUntil!);
    if (Number.isNaN(expiry.getTime())) {
      errs.discountActiveUntil = 'Format tanggal tidak valid.';
    } else if (expiry < new Date(new Date(now).setHours(0, 0, 0, 0))) {
      errs.discountActiveUntil = 'Tanggal diskon tidak boleh di masa lalu.';
    }
  }
  return errs;
}

// ─── Personalisasi ───────────────────────────────────────────

export type PersonalisasiForm = {
  location: string;
  occupation: string;
  budget: string;
  propertyType: string;
  gender: string;
};

export type PersonalisasiErrorKey = 'location' | 'occupation' | 'budget' | 'propertyType' | 'gender' | 'priorities';

/**
 * `ranking` diisi oleh halaman /personalisasi (wajib menyusun 3 prioritas);
 * halaman edit di profil tidak punya prioritas sehingga mengirim undefined.
 */
export function validatePersonalisasiForm(
  form: PersonalisasiForm,
  ranking?: { high: string | null; medium: string | null; low: string | null },
): Errors<PersonalisasiErrorKey> {
  const errs: Errors<PersonalisasiErrorKey> = {};
  const isKosan = form.propertyType === 'Kosan';
  if (!form.location.trim()) errs.location     = 'Pilih lokasi lewat peta.';
  if (!form.occupation)      errs.occupation   = 'Pilih pekerjaan kamu.';
  if (!form.budget)          errs.budget       = 'Pilih range budget kamu.';
  if (!form.propertyType)    errs.propertyType = 'Pilih tipe properti yang kamu cari.';
  if (isKosan && !form.gender) errs.gender     = 'Pilih gender kamu.';
  if (ranking && (!ranking.high || !ranking.medium || !ranking.low)) {
    errs.priorities = 'Susun ketiga kriteria ke tingkat Paling penting, Penting, dan Biasa saja.';
  }
  return errs;
}
