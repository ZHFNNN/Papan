/**
 * Isi ulang form edit personalisasi (app/profile/personalisasi/page.tsx)
 * dari respons GET /api/personalisasi.
 */

export const BUDGET_LABEL_MAP: Record<string, string> = {
  '0-2000000': '0 - 2 juta',
  '2000000-4000000': '2 - 4 juta',
  '4000000-6000000': '4 - 6 juta',
  '6000000-8000000': '6 - 8 juta',
};

export type SavedPersonalization = {
  location?: string | null;
  occupation?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  gender?: string | null;
  prefFurnished?: boolean;
  prefUnfurnished?: boolean;
  prefPetFriendly?: boolean;
  prefParkirMobil?: boolean;
  prefAc?: boolean;
  prefWaterHeater?: boolean;
  prefDekatTransportasi?: boolean;
};

export type PersonalisasiFormState = {
  location: string;
  occupation: string;
  budget: string;
  propertyType: string;
  gender: string;
  preferences: string[];
};

/** Rentang budget tersimpan → label pilihan budget di form. */
export function budgetLabelFromRange(budgetMin?: number | null, budgetMax?: number | null): string {
  const budgetKey = `${budgetMin ?? ''}-${budgetMax ?? ''}`;
  return BUDGET_LABEL_MAP[budgetKey] ?? ((budgetMin ?? 0) >= 8_000_000 ? '8 juta+' : '0 - 2 juta');
}

/** Flag boolean preferensi → daftar label preferensi di form. */
export function preferencesFromFlags(data: SavedPersonalization): string[] {
  const prefs: string[] = [];
  if (data.prefFurnished) prefs.push('Furnished');
  if (data.prefUnfurnished) prefs.push('Unfurnished');
  if (data.prefPetFriendly) prefs.push('Pet-friendly');
  if (data.prefParkirMobil) prefs.push('Parkir Mobil');
  if (data.prefAc) prefs.push('AC');
  if (data.prefWaterHeater) prefs.push('Water Heater');
  if (data.prefDekatTransportasi) prefs.push('Dekat transportasi umum');
  return prefs;
}

/** Gabungkan data tersimpan ke state form (nilai kosong mempertahankan default form). */
export function applySavedPersonalization<T extends PersonalisasiFormState>(prev: T, data: SavedPersonalization): T {
  return {
    ...prev,
    location: data.location ?? prev.location,
    occupation: data.occupation ?? prev.occupation,
    budget: budgetLabelFromRange(data.budgetMin, data.budgetMax),
    // Tipe properti belum disimpan di DB; gender tersimpan berarti sebelumnya pilih kosan
    propertyType: data.gender ? 'Kosan' : prev.propertyType,
    gender: data.gender ?? prev.gender,
    preferences: preferencesFromFlags(data),
  };
}

/** Tambah / hapus preferensi dari daftar pilihan. */
export function togglePreference(current: string[], pref: string): string[] {
  return current.includes(pref) ? current.filter((p) => p !== pref) : [...current, pref];
}
