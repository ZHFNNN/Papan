export type ApiFacility = {
	code: string;
	name: string;
};

export type ApiProperty = {
	id: string;
	title: string;
	category?: string | null;
	listingType?: string | null;
	createdAt?: string | null;
	price: string;
	imageUrls: string[];
	address?: string | null;
	neighbourhood?: string | null;
	district?: string | null;
	city?: string | null;
	facilities?: ApiFacility[];
	discountPercentage?: number | null;
	discountActiveUntil?: string | null;
	isDiscountActive?: boolean;
};

export type PropertyCardData = {
	id: string;
	title: string;
	kategori: string;
	price: string;
	biayaHidup: string;
	lokasi: string;
	luas: string;
	lantai: string;
	kt: string;
	km: string;
	fasilitas: string[];
	images: string[];
	listingType: string;
	createdAt?: string;
	discountPercentage?: number | null;
	discountActiveUntil?: string | null;
	isDiscountActive?: boolean;
};

export type PropertySuggestion = {
	id: string;
	title: string;
	lokasi: string;
};

export const FALLBACK_PROPERTY_IMAGE =
	'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80';

export function buildLocation(property: Pick<ApiProperty, 'address' | 'neighbourhood' | 'district' | 'city'>): string {
	const parts = [property.address, property.neighbourhood, property.district, property.city]
		.filter((value) => Boolean(value && value.trim()));
	return parts.join(', ') || 'Lokasi belum tersedia';
}

export function formatListingType(value?: string | null): string {
	const normalized = value?.trim().toUpperCase();
	if (!normalized) return '';
	if (normalized === 'SELL' || normalized === 'JUAL') return 'Jual';
	if (normalized === 'RENT' || normalized === 'SEWA' || normalized === 'KOSAN') return 'Sewa';
	return value ?? '';
}

export function formatCategoryLabel(value?: string | null): string {
	if (!value) return 'Properti';
	const normalized = value.trim().toUpperCase();
	if (normalized === 'RUMAH') return 'Rumah';
	if (normalized === 'APARTEMEN') return 'Apartemen';
	if (normalized === 'KOSAN') return 'Kosan';
	return value;
}

export function mapApiPropertyToCard(property: ApiProperty): PropertyCardData {
	const normalizedListingType = property.listingType?.trim()
		? property.listingType.trim().toUpperCase()
		: 'RENT';
	const listingLabel = formatListingType(normalizedListingType);
	const biayaHidup = listingLabel ? `Tipe: ${listingLabel}` : 'Estimasi biaya hidup: -';
	const images = property.imageUrls?.length ? property.imageUrls : [FALLBACK_PROPERTY_IMAGE];
	const createdAt = property.createdAt ?? undefined;

	return {
		id: property.id,
		title: property.title,
		kategori: formatCategoryLabel(property.category),
		price: property.price,
		biayaHidup,
		lokasi: buildLocation(property),
		luas: '-',
		lantai: '-',
		kt: '-',
		km: '-',
		fasilitas: property.facilities?.map((item) => item.name) ?? [],
		images,
		listingType: normalizedListingType,
		createdAt,
		discountPercentage: property.discountPercentage ?? null,
		discountActiveUntil: property.discountActiveUntil ?? null,
		isDiscountActive: property.isDiscountActive ?? false,
	};
}

export function calculateDiscountedPrice(price: string | number, discountPercentage: number | null | undefined): number {
	const numericPrice = typeof price === 'string' ? Number(price) : price;
	if (!Number.isFinite(numericPrice)) return 0;
	if (!discountPercentage || discountPercentage <= 0 || discountPercentage >= 100) {
		return Math.round(numericPrice);
	}
	return Math.round(numericPrice * (100 - discountPercentage) / 100);
}

export function isDiscountStillActive(
	discountPercentage: number | null | undefined,
	discountActiveUntil: string | null | undefined,
	now: Date = new Date(),
): boolean {
	if (typeof discountPercentage !== 'number' || discountPercentage <= 0) return false;
	if (!discountActiveUntil) return true;
	const expiry = new Date(discountActiveUntil);
	if (Number.isNaN(expiry.getTime())) return false;
	return expiry > now;
}

export function mapApiPropertyToSuggestion(property: ApiProperty): PropertySuggestion {
	return {
		id: property.id,
		title: property.title,
		lokasi: buildLocation(property),
	};
}
