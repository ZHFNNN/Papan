// Prioritas kriteria DSS dari halaman personalisasi.
// Level: 1 = biasa, 2 = penting, 3 = sangat penting.
export type CriteriaPriorities = {
  budget: number;
  location: number;
  facilities: number;
};

const PRIORITY_CRITERIA = [
  ["budget", "BUDGET"],
  ["location", "LOCATION"],
  ["facilities", "FACILITIES"],
] as const;

export type ParsedPriorities =
  | { ok: true; value: CriteriaPriorities | null }
  | { ok: false; error: string };

export function parsePriorities(input: unknown): ParsedPriorities {
  if (input === undefined || input === null) {
    return { ok: true, value: null };
  }

  if (typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "priorities harus berupa object { budget, location, facilities }." };
  }

  const record = input as Record<string, unknown>;
  const value: CriteriaPriorities = { budget: 0, location: 0, facilities: 0 };

  for (const [key] of PRIORITY_CRITERIA) {
    const level = record[key];
    if (typeof level !== "number" || !Number.isInteger(level) || level < 1 || level > 3) {
      return { ok: false, error: `priorities.${key} harus 1, 2, atau 3.` };
    }
    value[key] = level;
  }

  return { ok: true, value };
}

export function prioritiesToCriteriaRows(priorities: CriteriaPriorities) {
  return PRIORITY_CRITERIA.map(([key, criteria]) => ({ criteria, weight: priorities[key] }));
}

export function criteriaRowsToPriorities(
  rows: { criteria: string; weight: number }[],
): CriteriaPriorities | null {
  let found = false;
  // Kriteria tanpa baris dianggap 1, sama dengan aturan resolveCriteriaWeights.
  const priorities: CriteriaPriorities = { budget: 1, location: 1, facilities: 1 };

  for (const [key, criteria] of PRIORITY_CRITERIA) {
    const row = rows.find((item) => item.criteria === criteria);
    if (row) {
      priorities[key] = row.weight;
      found = true;
    }
  }

  return found ? priorities : null;
}
