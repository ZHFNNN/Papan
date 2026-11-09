import { calculateDiscountedPrice, isDiscountStillActive } from "@/types/property";

export const FIXED_CRITERIA_WEIGHTS = {
  budget: 0.4,
  location: 0.3,
  facilities: 0.3,
} as const;

export type CriteriaWeights = {
  budget: number;
  location: number;
  facilities: number;
};

export type CriteriaWeightSource = "user_criteria_weight" | "default";

// GENDER belum punya data di Property, jadi belum ikut dihitung.
const SCORED_CRITERIA = new Map<string, keyof CriteriaWeights>([
  ["BUDGET", "budget"],
  ["LOCATION", "location"],
  ["FACILITIES", "facilities"],
]);

// Rank Order Centroid (ROC): bobot untuk peringkat ke-k dari n kriteria
// w_k = (1/n) * sum_{j=k..n} (1/j). Untuk n = 3: 0.6111, 0.2778, 0.1111 (total 1).
export function rocWeights(n: number): number[] {
  const weights: number[] = [];
  for (let k = 1; k <= n; k++) {
    let sum = 0;
    for (let j = k; j <= n; j++) {
      sum += 1 / j;
    }
    weights.push(sum / n);
  }
  return weights;
}

export function resolveCriteriaWeights(
  rows: { criteria: string; weight: number }[],
): { weights: CriteriaWeights; source: CriteriaWeightSource } {
  const fallback = { weights: { ...FIXED_CRITERIA_WEIGHTS }, source: "default" as const };
  const scoredRows = rows.filter((row) => SCORED_CRITERIA.has(row.criteria));

  if (scoredRows.length === 0) {
    return fallback;
  }

  // Level prioritas per kriteria (lebih besar = lebih penting).
  // Kriteria tanpa baris memakai level 1, sama dengan @default(1) di schema.
  const level: CriteriaWeights = { budget: 1, location: 1, facilities: 1 };
  for (const row of scoredRows) {
    const key = SCORED_CRITERIA.get(row.criteria)!;
    level[key] = Number.isFinite(row.weight) ? Math.max(0, row.weight) : 0;
  }

  const keys: (keyof CriteriaWeights)[] = ["budget", "location", "facilities"];
  if (keys.every((key) => level[key] <= 0)) {
    return fallback;
  }

  // Urutkan dari level tertinggi (peringkat 1) ke terendah.
  const ordered = [...keys].sort((a, b) => level[b] - level[a]);
  const roc = rocWeights(ordered.length);

  // Level yang sama berbagi peringkat: bobotnya dirata-rata dari posisi yang ditempati.
  const weights: CriteriaWeights = { budget: 0, location: 0, facilities: 0 };
  let start = 0;
  while (start < ordered.length) {
    let end = start;
    while (end + 1 < ordered.length && level[ordered[end + 1]] === level[ordered[start]]) {
      end++;
    }
    const slice = roc.slice(start, end + 1);
    const average = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    for (let i = start; i <= end; i++) {
      weights[ordered[i]] = average;
    }
    start = end + 1;
  }

  return { weights, source: "user_criteria_weight" };
}

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

export function getEffectivePrice(
  property: { price: number; discountPercentage: number | null; discountActiveUntil: Date | null },
  now: Date,
): number {
  const activeUntil = property.discountActiveUntil?.toISOString() ?? null;

  if (!isDiscountStillActive(property.discountPercentage, activeUntil, now)) {
    return property.price;
  }

  return calculateDiscountedPrice(property.price, property.discountPercentage);
}

export type ScoringCandidate = {
  price: number;
  discountPercentage: number | null;
  discountActiveUntil: Date | null;
  searchText: string;
  facilityCodes: string[];
};

export type ScoringPreference = {
  budgetMin: number | null;
  budgetMax: number | null;
  location: string | null;
  facilityCodes: string[];
};

export function scoreProperty(
  candidate: ScoringCandidate,
  preference: ScoringPreference,
  weights: CriteriaWeights,
  now: Date,
) {
  const effectivePrice = getEffectivePrice(candidate, now);
  const budgetScore = normalizeBudgetScore(effectivePrice, preference.budgetMin, preference.budgetMax);
  const locationScore = normalizeLocationScore(preference.location, candidate.searchText);
  const facility = normalizeFacilityScore(preference.facilityCodes, candidate.facilityCodes);

  return {
    score:
      budgetScore * weights.budget +
      locationScore * weights.location +
      facility.score * weights.facilities,
    effectivePrice,
    budgetScore,
    locationScore,
    facilityScore: facility.score,
    matchedFacilityCodes: facility.matched,
  };
}
