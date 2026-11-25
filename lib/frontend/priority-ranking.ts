/**
 * Susunan prioritas kriteria DSS di halaman /personalisasi:
 * 3 kriteria (budget, lokasi, fasilitas) ditaruh ke 3 tingkat (high/medium/low).
 * Dipakai oleh klik chip, drag & drop, dan saat menyusun body request.
 */

export type CriteriaKey = 'budget' | 'location' | 'facilities';
export type PriorityTier = 'high' | 'medium' | 'low';
export type PriorityRanking = Record<PriorityTier, CriteriaKey | null>;

export const EMPTY_RANKING: PriorityRanking = { high: null, medium: null, low: null };

/** Level dikirim ke API: 3 = paling penting, 2 = penting, 1 = biasa saja. */
export const TIER_LEVEL: Record<PriorityTier, number> = { high: 3, medium: 2, low: 1 };

export const CRITERIA_KEYS: CriteriaKey[] = ['budget', 'location', 'facilities'];

export function isCriteriaKey(value: string): value is CriteriaKey {
  return (CRITERIA_KEYS as string[]).includes(value);
}

/** Tingkat tempat kriteria berada, atau null kalau belum ditaruh. */
export function tierOf(ranking: PriorityRanking, key: CriteriaKey): PriorityTier | null {
  return (Object.keys(ranking) as PriorityTier[]).find((t) => ranking[t] === key) ?? null;
}

/**
 * Taruh kriteria ke tingkat tujuan. Kalau tingkat tujuan sudah terisi dan
 * kriteria berasal dari tingkat lain, keduanya bertukar posisi.
 */
export function placeCriteria(ranking: PriorityRanking, key: CriteriaKey, target: PriorityTier): PriorityRanking {
  const next = { ...ranking };
  const from = tierOf(ranking, key);
  const displaced = ranking[target];
  if (from) next[from] = displaced;
  next[target] = key;
  return next;
}

/** Keluarkan kriteria dari tingkat mana pun (kembali ke kolam). */
export function unplaceCriteria(ranking: PriorityRanking, key: CriteriaKey): PriorityRanking {
  const next = { ...ranking };
  (Object.keys(next) as PriorityTier[]).forEach((t) => {
    if (next[t] === key) next[t] = null;
  });
  return next;
}

/** Susunan tingkat → { budget, location, facilities } berisi level 1-3. */
export function rankingToPriorities(ranking: PriorityRanking): Partial<Record<CriteriaKey, number>> {
  const priorities: Partial<Record<CriteriaKey, number>> = {};
  (Object.keys(TIER_LEVEL) as PriorityTier[]).forEach((tier) => {
    const key = ranking[tier];
    if (key) priorities[key] = TIER_LEVEL[tier];
  });
  return priorities;
}
