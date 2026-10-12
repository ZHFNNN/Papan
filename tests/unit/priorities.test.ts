import { describe, expect, it } from "vitest";
import {
  criteriaRowsToPriorities,
  parsePriorities,
  prioritiesToCriteriaRows,
} from "@/lib/dss/priorities";
import { resolveCriteriaWeights } from "@/lib/dss/scoring";

/**
 * Unit tests untuk prioritas kriteria DSS yang diisi user di halaman personalisasi.
 * Level: 1 = biasa, 2 = penting, 3 = sangat penting.
 */

describe("parsePriorities — validasi input dari form", () => {
  // R1: field tidak dikirim -> bobot lama tidak diubah
  it("R1: returns null when priorities are not sent", () => {
    expect(parsePriorities(undefined)).toEqual({ ok: true, value: null });
    expect(parsePriorities(null)).toEqual({ ok: true, value: null });
  });

  // R2: input valid diteruskan apa adanya
  it("R2: accepts levels 1 to 3 for every criterion", () => {
    expect(parsePriorities({ budget: 3, location: 2, facilities: 1 })).toEqual({
      ok: true,
      value: { budget: 3, location: 2, facilities: 1 },
    });
  });

  // R3: level di luar 1-3 ditolak
  it("R3: rejects levels outside 1 to 3", () => {
    expect(parsePriorities({ budget: 0, location: 2, facilities: 2 }).ok).toBe(false);
    expect(parsePriorities({ budget: 2, location: 4, facilities: 2 }).ok).toBe(false);
  });

  // R4: level harus bilangan bulat bertipe number
  it("R4: rejects non-integer and string levels", () => {
    expect(parsePriorities({ budget: 2.5, location: 2, facilities: 2 }).ok).toBe(false);
    expect(parsePriorities({ budget: "3", location: 2, facilities: 2 }).ok).toBe(false);
  });

  // R5: ketiga kriteria wajib ada
  it("R5: rejects priorities with a missing criterion", () => {
    const result = parsePriorities({ budget: 3, location: 2 });
    expect(result).toEqual({ ok: false, error: "priorities.facilities harus 1, 2, atau 3." });
  });

  // R6: bukan object -> ditolak
  it("R6: rejects values that are not an object", () => {
    expect(parsePriorities([3, 2, 2]).ok).toBe(false);
    expect(parsePriorities("3,2,2").ok).toBe(false);
  });
});

describe("prioritiesToCriteriaRows — mapping ke tabel UserCriteriaWeight", () => {
  // M1: tiap kriteria masuk ke baris enum yang benar
  it("M1: maps each criterion to its DssCriteria row", () => {
    expect(prioritiesToCriteriaRows({ budget: 3, location: 2, facilities: 1 })).toEqual([
      { criteria: "BUDGET", weight: 3 },
      { criteria: "LOCATION", weight: 2 },
      { criteria: "FACILITIES", weight: 1 },
    ]);
  });
});

describe("criteriaRowsToPriorities — isi awal form dari database", () => {
  // G1: user belum pernah mengatur prioritas
  it("G1: returns null when the user has no rows", () => {
    expect(criteriaRowsToPriorities([])).toBeNull();
  });

  // G2: baris GENDER saja tidak dihitung sebagai prioritas
  it("G2: returns null when only a GENDER row exists", () => {
    expect(criteriaRowsToPriorities([{ criteria: "GENDER", weight: 2 }])).toBeNull();
  });

  // G3: baris dikembalikan ke key yang benar
  it("G3: maps rows back to budget, location, and facilities", () => {
    expect(
      criteriaRowsToPriorities([
        { criteria: "FACILITIES", weight: 1 },
        { criteria: "BUDGET", weight: 3 },
        { criteria: "LOCATION", weight: 2 },
      ]),
    ).toEqual({ budget: 3, location: 2, facilities: 1 });
  });

  // G4: kriteria tanpa baris dianggap 1, sama dengan aturan resolveCriteriaWeights
  it("G4: uses 1 for criteria without a row", () => {
    expect(criteriaRowsToPriorities([{ criteria: "BUDGET", weight: 3 }])).toEqual({
      budget: 3,
      location: 1,
      facilities: 1,
    });
  });
});

describe("prioritas -> bobot DSS", () => {
  // I1: default UI (3/2/2) menghasilkan bobot yang dipakai scoring
  it("I1: turns saved priorities into normalized DSS weights", () => {
    const rows = prioritiesToCriteriaRows({ budget: 3, location: 2, facilities: 2 });
    const { weights, source } = resolveCriteriaWeights(rows);
    // 3 / (3 + 2 + 2) = 0.4286, 2 / 7 = 0.2857
    expect(source).toBe("user_criteria_weight");
    expect(weights.budget).toBeCloseTo(3 / 7, 5);
    expect(weights.location).toBeCloseTo(2 / 7, 5);
    expect(weights.facilities).toBeCloseTo(2 / 7, 5);
  });
});
