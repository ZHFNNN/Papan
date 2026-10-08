import { describe, expect, it } from "vitest";
import {
  FIXED_CRITERIA_WEIGHTS,
  getEffectivePrice,
  normalizeBudgetScore,
  normalizeFacilityScore,
  normalizeGenderScore,
  normalizeLocationScore,
  resolveCriteriaWeights,
  scoreProperty,
} from "@/lib/dss/scoring";

/**
 * Whitebox tests untuk fungsi DSS scoring.
 *
 * Strategi: Basis Path Testing.
 * - Setiap test case memetakan ke satu jalur independen di control flow graph.
 * - Tujuan utama: 100% branch coverage pada lib/dss/scoring.ts.
 */

describe("normalizeBudgetScore — basis path coverage", () => {
  // P1: min == null  -> return 0.5
  it("P1: returns 0.5 when min is null", () => {
    expect(normalizeBudgetScore(5_000_000, null, 10_000_000)).toBe(0.5);
  });

  // P1: max == null  -> return 0.5  (cabang lain dari short-circuit OR)
  it("P1b: returns 0.5 when max is null", () => {
    expect(normalizeBudgetScore(5_000_000, 1_000_000, null)).toBe(0.5);
  });

  // P2: price dalam range [min, max]  -> return 1
  it("P2: returns 1 when price is inside [min, max]", () => {
    expect(normalizeBudgetScore(5_000_000, 3_000_000, 7_000_000)).toBe(1);
  });

  // P2b: price tepat di boundary min
  it("P2b (boundary): returns 1 when price == min", () => {
    expect(normalizeBudgetScore(3_000_000, 3_000_000, 7_000_000)).toBe(1);
  });

  // P2c: price tepat di boundary max
  it("P2c (boundary): returns 1 when price == max", () => {
    expect(normalizeBudgetScore(7_000_000, 3_000_000, 7_000_000)).toBe(1);
  });

  // P3: price < min (lebih murah dari min) -> tetap return 1 (tidak kena penalti)
  it("P3: returns 1 when price is below min (affordable is better)", () => {
    const score = normalizeBudgetScore(2_000_000, 3_000_000, 7_000_000);
    expect(score).toBe(1);
  });

  // P5: price > max, max > 0  -> linear penalty
  it("P5: returns partial score when price is above max", () => {
    // (price - max) / max = (10jt - 7jt) / 7jt = 0.4285..
    // score = 1 - 0.4285.. = 0.5714..
    const score = normalizeBudgetScore(10_000_000, 3_000_000, 7_000_000);
    expect(score).toBeCloseTo(4 / 7, 4);
  });

  // P6: price > max, max <= 0  -> guard return 0
  it("P6: returns 0 when max <= 0 and price > max", () => {
    expect(normalizeBudgetScore(5_000_000, -10_000_000, 0)).toBe(0);
  });

  // P5 ekstrim: penalty terjepit ke 0 oleh Math.max
  it("P5 (extreme): clamps to 0 when price is far above max", () => {
    expect(normalizeBudgetScore(100_000_000, 3_000_000, 7_000_000)).toBe(0);
  });
});

describe("normalizeGenderScore — branch coverage", () => {
  it("returns 1 for non-kosan categories (Rumah / Apartemen)", () => {
    expect(normalizeGenderScore("Perempuan", "Kost Putri", "RUMAH")).toBe(1);
    expect(normalizeGenderScore("Laki-laki", "Kost Putra", "APARTEMEN")).toBe(1);
  });

  it("returns 1 when userGender is null or empty", () => {
    expect(normalizeGenderScore(null, "Kost Putri", "KOSAN")).toBe(1);
    expect(normalizeGenderScore("", "Kost Putra", "KOSAN")).toBe(1);
  });

  it("returns 0.8 for campur kos", () => {
    expect(normalizeGenderScore("Perempuan", "Kost Campur Sakura", "KOSAN")).toBe(0.8);
    expect(normalizeGenderScore("Laki-laki", "Kost Campur Harmoni", "KOSAN")).toBe(0.8);
  });

  it("correctly scores female users", () => {
    expect(normalizeGenderScore("Perempuan", "Kost Putri Melati", "KOSAN")).toBe(1);
    expect(normalizeGenderScore("Perempuan", "Kost Khusus Pria", "KOSAN")).toBe(0);
    expect(normalizeGenderScore("Perempuan", "Kosan Asri Tanpa Tag", "KOSAN")).toBe(0.9);
  });

  it("correctly scores male users", () => {
    expect(normalizeGenderScore("Laki-laki", "Kost Putra Perkasa", "KOSAN")).toBe(1);
    expect(normalizeGenderScore("Laki-laki", "Kost Khusus Wanita", "KOSAN")).toBe(0);
    expect(normalizeGenderScore("Laki-laki", "Kosan Asri Tanpa Tag", "KOSAN")).toBe(0.9);
  });

  it("correctly handles direct genderTarget database column values", () => {
    // Kos Putri
    expect(normalizeGenderScore("Perempuan", "PUTRI", "KOSAN")).toBe(1);
    expect(normalizeGenderScore("Laki-laki", "PUTRI", "KOSAN")).toBe(0);

    // Kos Putra
    expect(normalizeGenderScore("Laki-laki", "PUTRA", "KOSAN")).toBe(1);
    expect(normalizeGenderScore("Perempuan", "PUTRA", "KOSAN")).toBe(0);

    // Kos Campur
    expect(normalizeGenderScore("Perempuan", "CAMPUR", "KOSAN")).toBe(0.8);
    expect(normalizeGenderScore("Laki-laki", "CAMPUR", "KOSAN")).toBe(0.8);

    // Rumah & Apartemen
    expect(normalizeGenderScore("Perempuan", null, "RUMAH")).toBe(1);
    expect(normalizeGenderScore("Laki-laki", null, "APARTEMEN")).toBe(1);
  });
});

describe("normalizeLocationScore — branch coverage", () => {
  // L1: locationPref null
  it("L1: returns 0.5 when locationPref is null", () => {
    expect(normalizeLocationScore(null, "jakarta selatan")).toBe(0.5);
  });

  // L1b: locationPref hanya whitespace
  it("L1b: returns 0.5 when locationPref is only whitespace", () => {
    expect(normalizeLocationScore("   ", "jakarta selatan")).toBe(0.5);
  });

  // L2: tokens kosong setelah split + filter (semua koma)
  it("L2: returns 0.5 when tokens are all empty after split", () => {
    expect(normalizeLocationScore(",,,", "jakarta selatan")).toBe(0.5);
  });

  // L3: semua token cocok
  it("L3: returns 1 when all tokens match", () => {
    expect(
      normalizeLocationScore("jakarta, depok", "rumah di jakarta dan dekat depok"),
    ).toBe(1);
  });

  // L4: sebagian token cocok
  it("L4: returns partial score when some tokens match", () => {
    expect(
      normalizeLocationScore("jakarta, depok, bekasi", "rumah di jakarta"),
    ).toBeCloseTo(1 / 3, 4);
  });

  // L5: tidak ada token yang cocok
  it("L5: returns 0 when no tokens match", () => {
    expect(normalizeLocationScore("bandung", "rumah di jakarta")).toBe(0);
  });

  // L6: case sensitivity — pref di-lowercase, text harus sudah lowercase di caller
  it("L6: location preference is lowercased before matching", () => {
    expect(normalizeLocationScore("JAKARTA", "jakarta selatan")).toBe(1);
  });
});

describe("normalizeFacilityScore — branch coverage", () => {
  // F1: selectedCodes kosong  -> default 0.5, matched []
  it("F1: returns 0.5 with empty matched when user has no selected facilities", () => {
    const result = normalizeFacilityScore([], ["AC", "WIFI"]);
    expect(result).toEqual({ score: 0.5, matched: [] });
  });

  // F2: semua selected ada di propertyCodes
  it("F2: returns 1 when all selected codes are matched", () => {
    const result = normalizeFacilityScore(["AC", "WIFI"], ["AC", "WIFI", "DAPUR"]);
    expect(result.score).toBe(1);
    expect(result.matched.sort()).toEqual(["AC", "WIFI"]);
  });

  // F3: sebagian cocok
  it("F3: returns partial score when some codes match", () => {
    const result = normalizeFacilityScore(["AC", "WIFI", "PET_FRIENDLY"], ["AC"]);
    expect(result.score).toBeCloseTo(1 / 3, 4);
    expect(result.matched).toEqual(["AC"]);
  });

  // F4: tidak ada yang cocok
  it("F4: returns 0 when no code matches", () => {
    const result = normalizeFacilityScore(["AC"], ["DAPUR", "WIFI"]);
    expect(result.score).toBe(0);
    expect(result.matched).toEqual([]);
  });

  // F5: matched tidak boleh duplikat (property punya code dobel)
  it("F5: deduplicates matched codes", () => {
    const result = normalizeFacilityScore(["AC"], ["AC", "AC"]);
    expect(result.matched).toEqual(["AC"]);
    // catatan: numerator pakai filter, jadi nilai score bisa > 1 — di sini kita
    // hanya menguji bahwa array matched dideduplikasi.
  });
});

describe("FIXED_CRITERIA_WEIGHTS contract", () => {
  it("weights sum to 1.0", () => {
    const total =
      FIXED_CRITERIA_WEIGHTS.budget +
      FIXED_CRITERIA_WEIGHTS.location +
      FIXED_CRITERIA_WEIGHTS.facilities;
    expect(total).toBeCloseTo(1, 5);
  });
});

describe("resolveCriteriaWeights — bobot kriteria per pengguna", () => {
  // W1: user belum punya baris UserCriteriaWeight -> bobot default (perilaku lama)
  it("W1: falls back to default weights when the user has no rows", () => {
    const result = resolveCriteriaWeights([]);
    expect(result.source).toBe("default");
    expect(result.weights).toEqual({ budget: 0.4, location: 0.3, facilities: 0.3 });
  });

  // W2: semua kriteria diisi -> dinormalisasi supaya total = 1
  it("W2: normalizes user weights so they sum to 1", () => {
    const result = resolveCriteriaWeights([
      { criteria: "BUDGET", weight: 3 },
      { criteria: "LOCATION", weight: 1 },
      { criteria: "FACILITIES", weight: 1 },
    ]);
    expect(result.source).toBe("user_criteria_weight");
    expect(result.weights.budget).toBeCloseTo(0.6, 5);
    expect(result.weights.location).toBeCloseTo(0.2, 5);
    expect(result.weights.facilities).toBeCloseTo(0.2, 5);
  });

  // W3: kriteria tanpa baris memakai bobot 1 (sama dengan @default(1) di schema)
  it("W3: uses weight 1 for criteria without a row", () => {
    const result = resolveCriteriaWeights([{ criteria: "LOCATION", weight: 2 }]);
    expect(result.source).toBe("user_criteria_weight");
    expect(result.weights.budget).toBeCloseTo(0.25, 5);
    expect(result.weights.location).toBeCloseTo(0.5, 5);
    expect(result.weights.facilities).toBeCloseTo(0.25, 5);
  });

  // W4: GENDER belum dihitung -> tidak ikut normalisasi
  it("W4: ignores the GENDER weight because the criterion is not scored yet", () => {
    const result = resolveCriteriaWeights([
      { criteria: "BUDGET", weight: 1 },
      { criteria: "LOCATION", weight: 1 },
      { criteria: "FACILITIES", weight: 2 },
      { criteria: "GENDER", weight: 4 },
    ]);
    expect(result.weights.budget).toBeCloseTo(0.25, 5);
    expect(result.weights.location).toBeCloseTo(0.25, 5);
    expect(result.weights.facilities).toBeCloseTo(0.5, 5);
  });

  // W5: hanya baris GENDER -> dianggap belum mengatur bobot
  it("W5: falls back to default weights when only GENDER is set", () => {
    const result = resolveCriteriaWeights([{ criteria: "GENDER", weight: 5 }]);
    expect(result.source).toBe("default");
    expect(result.weights).toEqual({ budget: 0.4, location: 0.3, facilities: 0.3 });
  });

  // W6: bobot negatif / NaN diperlakukan sebagai 0
  it("W6: treats negative and NaN weights as 0", () => {
    const result = resolveCriteriaWeights([
      { criteria: "BUDGET", weight: -2 },
      { criteria: "LOCATION", weight: Number.NaN },
      { criteria: "FACILITIES", weight: 1 },
    ]);
    expect(result.weights).toEqual({ budget: 0, location: 0, facilities: 1 });
  });

  // W7: total bobot efektif 0 -> fallback default (hindari pembagian dengan 0)
  it("W7: falls back to default weights when every weight is 0 or Infinity", () => {
    const result = resolveCriteriaWeights([
      { criteria: "BUDGET", weight: 0 },
      { criteria: "LOCATION", weight: 0 },
      { criteria: "FACILITIES", weight: Number.POSITIVE_INFINITY },
    ]);
    expect(result.source).toBe("default");
    expect(result.weights).toEqual({ budget: 0.4, location: 0.3, facilities: 0.3 });
  });
});

describe("getEffectivePrice — harga setelah diskon aktif", () => {
  const now = new Date("2026-10-07T12:00:00Z");
  const tomorrow = new Date("2026-10-08T12:00:00Z");
  const yesterday = new Date("2026-10-06T12:00:00Z");

  // E1: diskon aktif -> harga dipotong
  it("E1: applies an active discount", () => {
    const price = getEffectivePrice(
      { price: 2_000_000, discountPercentage: 10, discountActiveUntil: tomorrow },
      now,
    );
    expect(price).toBe(1_800_000);
  });

  // E2: diskon kedaluwarsa -> harga normal
  it("E2: ignores an expired discount", () => {
    const price = getEffectivePrice(
      { price: 2_000_000, discountPercentage: 10, discountActiveUntil: yesterday },
      now,
    );
    expect(price).toBe(2_000_000);
  });

  // E3: diskon tanpa tanggal berakhir dianggap aktif (sama dengan aturan home page)
  it("E3: treats a discount without an end date as active", () => {
    const price = getEffectivePrice(
      { price: 2_000_000, discountPercentage: 25, discountActiveUntil: null },
      now,
    );
    expect(price).toBe(1_500_000);
  });

  // E4: tidak ada diskon (null / 0) -> harga normal
  it("E4: returns the normal price when there is no discount", () => {
    expect(
      getEffectivePrice({ price: 2_000_000, discountPercentage: null, discountActiveUntil: null }, now),
    ).toBe(2_000_000);
    expect(
      getEffectivePrice({ price: 2_000_000, discountPercentage: 0, discountActiveUntil: tomorrow }, now),
    ).toBe(2_000_000);
  });

  // E5: boundary — tepat di waktu berakhir, diskon sudah tidak berlaku
  it("E5 (boundary): discount is no longer active exactly at its end time", () => {
    const price = getEffectivePrice(
      { price: 2_000_000, discountPercentage: 10, discountActiveUntil: now },
      now,
    );
    expect(price).toBe(2_000_000);
  });
});

describe("scoreProperty — skor SAW satu properti", () => {
  const now = new Date("2026-10-07T12:00:00Z");

  // S1: skor budget memakai harga setelah diskon, bukan harga normal
  it("S1: scores the budget criterion with the discounted price", () => {
    const result = scoreProperty(
      {
        price: 2_200_000,
        discountPercentage: 10,
        discountActiveUntil: null,
        searchText: "kos di jatinangor",
        facilityCodes: [],
      },
      { budgetMin: 0, budgetMax: 2_000_000, location: null, facilityCodes: [] },
      { budget: 0.4, location: 0.3, facilities: 0.3 },
      now,
    );
    // harga efektif 1.980.000 masuk budget -> budgetScore 1
    // total = 0.4*1 + 0.3*0.5 + 0.3*0.5 = 0.7 (kalau pakai harga normal: 0.4*0.9 + 0.3 = 0.66)
    expect(result.effectivePrice).toBe(1_980_000);
    expect(result.budgetScore).toBe(1);
    expect(result.score).toBeCloseTo(0.7, 5);
  });

  // S2: tiap bobot dipasangkan ke kriteria yang benar
  it("S2: applies each weight to its own criterion", () => {
    const result = scoreProperty(
      {
        price: 2_500_000,
        discountPercentage: null,
        discountActiveUntil: null,
        searchText: "kos di jatinangor",
        facilityCodes: ["AC", "WIFI"],
      },
      { budgetMin: 1_000_000, budgetMax: 2_000_000, location: "bandung", facilityCodes: ["AC"] },
      { budget: 0.5, location: 0.2, facilities: 0.3 },
      now,
    );
    // budget = 1 - (2.5jt - 2jt) / 2jt = 0.75, lokasi = 0, fasilitas = 1
    // total = 0.5*0.75 + 0.2*0 + 0.3*1 = 0.675 (bobot tertukar memberi 0.45 / 0.725 / 0.575)
    expect(result.budgetScore).toBeCloseTo(0.75, 5);
    expect(result.locationScore).toBe(0);
    expect(result.facilityScore).toBe(1);
    expect(result.matchedFacilityCodes).toEqual(["AC"]);
    expect(result.score).toBeCloseTo(0.675, 5);
  });
});
