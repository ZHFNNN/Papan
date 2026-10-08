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
  genderTargetOrText?: string | null,
  category?: string,
  fallbackText?: string,
): number {
  // Gender hanya berlaku khusus untuk kategori KOSAN
  if (category && category !== "KOSAN") {
    return 1;
  }

  if (!userGender || !userGender.trim()) {
    return 1;
  }

  const normalizedUser = userGender.toLowerCase().trim();
  const isFemaleUser =
    normalizedUser === "perempuan" || normalizedUser === "wanita" || normalizedUser === "female";
  const isMaleUser =
    normalizedUser === "laki-laki" || normalizedUser === "pria" || normalizedUser === "male";

  // Cek jika nilai berupa enum PUTRI / PUTRA / CAMPUR
  const upperVal = (genderTargetOrText ?? "").trim().toUpperCase();
  if (upperVal === "CAMPUR") return 0.8;
  if (upperVal === "PUTRI") {
    if (isFemaleUser) return 1;
    if (isMaleUser) return 0;
    return 0.9;
  }
  if (upperVal === "PUTRA") {
    if (isMaleUser) return 1;
    if (isFemaleUser) return 0;
    return 0.9;
  }

  // Jika bukan enum exact, scan teks (dari genderTargetOrText maupun fallbackText)
  const textToScan = `${genderTargetOrText ?? ""} ${fallbackText ?? ""}`.toLowerCase();
  const isPutriKos =
    textToScan.includes("putri") || textToScan.includes("wanita") || textToScan.includes("cewek");
  const isPutraKos =
    textToScan.includes("putra") || textToScan.includes("pria") || textToScan.includes("cowok");
  const isCampurKos =
    textToScan.includes("campur") || textToScan.includes("pasutri") || textToScan.includes("bebas");

  if (isCampurKos) {
    return 0.8;
  }

  if (isFemaleUser) {
    if (isPutriKos) return 1;
    if (isPutraKos) return 0;
    return 0.9;
  }

  if (isMaleUser) {
    if (isPutraKos) return 1;
    if (isPutriKos) return 0;
    return 0.9;
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
