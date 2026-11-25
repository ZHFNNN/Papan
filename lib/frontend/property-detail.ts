/**
 * Pemetaan respons GET /api/properties/[id] ke data tampilan halaman detail
 * (app/propertyDetail/PropertyDetailClient.tsx).
 */
import { formatPrice } from '@/lib/format-price';

export type PropertyDetail = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  neighbourhood?: string | null;
  imageUrls?: string[];
  description: string | null;
  price: string;
  listingType: string;
  lat?: number | null;
  lng?: number | null;
  owner?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
    image?: string | null;
    phoneNumber?: string | null;
  };
  facilities: Array<{ code: string; name: string }>;
  createdAt: string;
  discountPercentage?: number | null;
  discountActiveUntil?: string | null;
  isDiscountActive?: boolean;
};

export type DisplayProperty = {
  id: string;
  title: string;
  kategori: string;
  price: string;
  originalPrice: string | null;
  discountPercentage: number | null;
  discountActiveUntil: string | null;
  isDiscountActive: boolean;
  biayaHidup: string;
  lokasi: string;
  luas: string;
  lantai: string;
  kt: string;
  km: string;
  fasilitas: string[];
  images: string[];
  description: string;
  lat: number | null;
  lng: number | null;
  ownerName: string;
  ownerId: string | null;
  ownerImage: string | null;
  ownerPhoneNumber: string | null;
};

export const DETAIL_FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80';

export function mapApiProperty(data: PropertyDetail, now: Date = new Date()): DisplayProperty {
  const lokasi = [data.address, data.neighbourhood, data.district, data.city]
    .filter((v) => Boolean(v && v.trim()))
    .join(', ');

  // Hitung diskon — hanya aktif kalau persentase > 0 dan belum kadaluarsa
  const expiry = data.discountActiveUntil ? new Date(data.discountActiveUntil) : null;
  const discountActive =
    typeof data.discountPercentage === 'number' &&
    data.discountPercentage > 0 &&
    (expiry === null || expiry > now);
  const numericPrice = Number(data.price);
  const finalPrice = discountActive && Number.isFinite(numericPrice)
    ? Math.round(numericPrice * (100 - (data.discountPercentage ?? 0)) / 100)
    : numericPrice;

  return {
    id: data.id,
    title: data.title,
    kategori:
      data.listingType === 'RENT'
        ? 'Properti Sewa'
        : data.listingType === 'SELL'
          ? 'Properti Jual'
          : 'Properti',
    price: formatPrice(String(finalPrice)),
    originalPrice: discountActive ? formatPrice(data.price) : null,
    discountPercentage: discountActive ? (data.discountPercentage ?? null) : null,
    discountActiveUntil: data.discountActiveUntil ?? null,
    isDiscountActive: discountActive,
    biayaHidup: 'Estimasi biaya hidup: -',
    lokasi: lokasi || 'Lokasi belum tersedia',
    luas: '-',
    lantai: '-',
    kt: '-',
    km: '-',
    fasilitas: data.facilities.map((f) => f.name),
    images:
      data.imageUrls && data.imageUrls.length > 0
        ? data.imageUrls
        : [DETAIL_FALLBACK_IMAGE],
    description: data.description ?? 'Tidak ada deskripsi.',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    ownerName:
      data.owner?.name ?? data.owner?.username ?? data.owner?.image ?? 'Pemilik Properti',
    ownerId: data.owner?.id ?? null,
    ownerImage: data.owner?.image ?? null,
    ownerPhoneNumber: data.owner?.phoneNumber ?? null,
  };
}

export function formatReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Lebar batang rating (persen). */
export function ratingBarPercent(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}
