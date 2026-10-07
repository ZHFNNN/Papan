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

export function resolveCriteriaWeights(
  rows: { criteria: string; weight: number }[],
): { weights: CriteriaWeights; source: CriteriaWeightSource } {
  const fallback = { weights: { ...FIXED_CRITERIA_WEIGHTS }, source: "default" as const };
  const scoredRows = rows.filter((row) => SCORED_CRITERIA.has(row.criteria));

  if (scoredRows.length === 0) {
    return fallback;
  }

  // Kriteria tanpa baris memakai bobot 1, sama dengan @default(1) di schema.
  const raw: CriteriaWeights = { budget: 1, location: 1, facilities: 1 };
  for (const row of scoredRows) {
    const key = SCORED_CRITERIA.get(row.criteria)!;
    raw[key] = Number.isFinite(row.weight) ? Math.max(0, row.weight) : 0;
  }

  const total = raw.budget + raw.location + raw.facilities;
  if (total <= 0) {
    return fallback;
  }

  return {
    weights: {
      budget: raw.budget / total,
      location: raw.location / total,
      facilities: raw.facilities / total,
    },
    source: "user_criteria_weight",
  };
}

export function normalizeBudgetScore(
  price: number,
  min: number | null,
  max: number | null,
): number {
  if (min == null || max == null) {
    return 0.5;
  }

  if (price >= min && price <= max) {
    return 1;
  }

  if (price < min) {
    if (min <= 0) return 0;
    return Math.max(0, 1 - (min - price) / min);
  }

  if (max <= 0) return 0;
  return Math.max(0, 1 - (price - max) / max);
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
