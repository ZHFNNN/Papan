/**
 * Lokasi hasil pilihan peta (components/MapPicker.tsx) dan nama lokasi yang
 * ditampilkan di form personalisasi.
 */

export type PickedLocation = {
  displayName: string;
  city: string;
  district: string;
  neighbourhood: string;
  lat: number;
  lng: number;
};

export interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  village?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
}

export interface NominatimResult {
  display_name: string;
  address: NominatimAddress;
  lat: string;
  lon: string;
}

/** Ubah hasil reverse-geocoding Nominatim jadi lokasi yang dipakai form. */
export function parseNominatim(result: NominatimResult, lat: number, lng: number): PickedLocation {
  const a = result.address;
  return {
    displayName:   result.display_name,
    city:          a.city ?? a.town ?? a.county ?? a.municipality ?? '',
    district:      a.city_district ?? a.county ?? '',
    neighbourhood: a.neighbourhood ?? a.village ?? a.suburb ?? '',
    lat,
    lng,
  };
}

/** Nama pendek "kelurahan, kecamatan, kota"; kalau semuanya kosong pakai nama lengkap. */
export function shortLocationName(loc: Pick<PickedLocation, 'displayName' | 'city' | 'district' | 'neighbourhood'>): string {
  const parts = [loc.neighbourhood, loc.district, loc.city].filter(Boolean);
  return parts.join(', ') || loc.displayName;
}
