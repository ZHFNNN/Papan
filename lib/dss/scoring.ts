export const FIXED_CRITERIA_WEIGHTS = {
  budget: 0.4,
  location: 0.3,
  facilities: 0.3,
} as const;

export function normalizeBudgetScore(
  price: number,
  min: number | null,
  max: number | null,
): number {
  if (min == null || max == null) {
    return 0.5;
  }

  // Harga lebih murah atau sama dengan budget maksimum bernilai sempurna (1.0)
  if (price <= max) {
    return 1;
  }

  if (max <= 0) return 0;
  return Math.max(0, 1 - (price - max) / max);
}

export function normalizeGenderScore(
  userGender: string | null | undefined,
  text: string,
  category?: string,
): number {
  // Gender hanya berlaku khusus untuk kategori KOSAN
  if (category && category !== "KOSAN") {
    return 1;
  }

  if (!userGender || !userGender.trim()) {
    return 1;
  }

  const lowerText = text.toLowerCase();
  const normalizedUser = userGender.toLowerCase().trim();

  const isPutriKos =
    lowerText.includes("putri") || lowerText.includes("wanita") || lowerText.includes("cewek");
  const isPutraKos =
    lowerText.includes("putra") || lowerText.includes("pria") || lowerText.includes("cowok");
  const isCampurKos =
    lowerText.includes("campur") || lowerText.includes("pasutri") || lowerText.includes("bebas");

  // Jika kos campur, bisa dihuni oleh putra maupun putri
  if (isCampurKos) {
    return 0.8;
  }

  if (normalizedUser === "perempuan" || normalizedUser === "wanita") {
    if (isPutriKos) return 1;
    if (isPutraKos) return 0; // Kos khusus putra: dilarang dihuni perempuan
    return 0.9; // Tidak spesifik/umum
  }

  if (normalizedUser === "laki-laki" || normalizedUser === "pria") {
    if (isPutraKos) return 1;
    if (isPutriKos) return 0; // Kos khusus putri: dilarang dihuni laki-laki
    return 0.9; // Tidak spesifik/umum
  }

  return 1;
}

export function normalizeLocationScore(
  locationPref: string | null,
  text: string,
): number {
  if (!locationPref || !locationPref.trim()) {
    return 0.5;
  }

  const tokens = locationPref
    .toLowerCase()
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return 0.5;
  }

  const hitCount = tokens.filter((token) => text.includes(token)).length;
  return hitCount / tokens.length;
}

export function normalizeFacilityScore(
  selectedCodes: string[],
  propertyCodes: string[],
): { score: number; matched: string[] } {
  if (selectedCodes.length === 0) {
    return { score: 0.5, matched: [] };
  }

  const selectedSet = new Set(selectedCodes);
  const matched = propertyCodes.filter((code) => selectedSet.has(code));

  return {
    score: matched.length / selectedCodes.length,
    matched: Array.from(new Set(matched)),
  };
}

export function filterRequiredFacilities<
  T extends { facilities: Array<{ facility: { code: string } }> },
>(properties: T[], requiredFacilityCodes: string[]): T[] {
  if (requiredFacilityCodes.length === 0) {
    return properties;
  }

  const filtered = properties.filter((property) => {
    const propCodes = new Set(property.facilities.map((item) => item.facility.code));
    return requiredFacilityCodes.every((code) => propCodes.has(code));
  });

  return filtered.length > 0 ? filtered : properties;
}
