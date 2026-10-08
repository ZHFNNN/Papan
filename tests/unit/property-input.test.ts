import { describe, expect, it } from "vitest";
import {
  KOSAN_GENDER_REQUIRED_MESSAGE,
  customFacilityCode,
  normalizeCategory,
  normalizeGenderTarget,
  normalizeListingType,
  resolveGenderTarget,
} from "@/lib/property-input";

describe("resolveGenderTarget", () => {
  const required = { ok: false, message: KOSAN_GENDER_REQUIRED_MESSAGE };

  it("changes the gender of an existing kosan when a new one is sent", () => {
    expect(resolveGenderTarget("KOSAN", "PUTRA", "PUTRI")).toEqual({ ok: true, genderTarget: "PUTRA" });
  });

  it("clears the gender when a kosan becomes another category", () => {
    expect(resolveGenderTarget("RUMAH", undefined, "PUTRI")).toEqual({ ok: true, genderTarget: null });
    expect(resolveGenderTarget("APARTEMEN", "PUTRI", "PUTRI")).toEqual({ ok: true, genderTarget: null });
  });

  it("keeps the stored gender when the request does not send one (older clients)", () => {
    expect(resolveGenderTarget("KOSAN", undefined, "CAMPUR")).toEqual({ ok: true, genderTarget: "CAMPUR" });
  });

  it("requires a gender when a property becomes a kosan", () => {
    expect(resolveGenderTarget("KOSAN", undefined, null)).toEqual(required);
    expect(resolveGenderTarget("KOSAN", "PUTRI", null)).toEqual({ ok: true, genderTarget: "PUTRI" });
  });

  it("rejects an invalid or emptied gender instead of silently keeping the old one", () => {
    expect(resolveGenderTarget("KOSAN", "pria", "PUTRA")).toEqual(required);
    expect(resolveGenderTarget("KOSAN", null, "PUTRA")).toEqual(required);
    expect(resolveGenderTarget("KOSAN", "", "PUTRA")).toEqual(required);
  });

  it("normalises the casing of the requested gender", () => {
    expect(resolveGenderTarget("KOSAN", "putri", null)).toEqual({ ok: true, genderTarget: "PUTRI" });
  });
});

describe("normalizeCategory", () => {
  it("accepts the three categories regardless of case and spaces", () => {
    expect(normalizeCategory("rumah")).toBe("RUMAH");
    expect(normalizeCategory(" Apartemen ")).toBe("APARTEMEN");
    expect(normalizeCategory("KOSAN")).toBe("KOSAN");
  });

  it("rejects unknown values and non-strings", () => {
    expect(normalizeCategory("villa")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
    expect(normalizeCategory(null)).toBeNull();
    expect(normalizeCategory(1)).toBeNull();
  });
});

describe("normalizeListingType", () => {
  it("maps legacy English / kosan values", () => {
    expect(normalizeListingType("SELL")).toBe("JUAL");
    expect(normalizeListingType("rent")).toBe("SEWA");
    expect(normalizeListingType("KOSAN")).toBe("SEWA");
  });

  it("keeps JUAL / SEWA", () => {
    expect(normalizeListingType(" jual ")).toBe("JUAL");
    expect(normalizeListingType("Sewa")).toBe("SEWA");
  });

  it("rejects anything else", () => {
    expect(normalizeListingType("LELANG")).toBeNull();
    expect(normalizeListingType(undefined)).toBeNull();
  });
});

describe("normalizeGenderTarget", () => {
  it("accepts PUTRA / PUTRI / CAMPUR in any case", () => {
    expect(normalizeGenderTarget("putra")).toBe("PUTRA");
    expect(normalizeGenderTarget("Putri")).toBe("PUTRI");
    expect(normalizeGenderTarget(" CAMPUR ")).toBe("CAMPUR");
  });

  it("rejects missing or unknown values", () => {
    expect(normalizeGenderTarget("pria")).toBeNull();
    expect(normalizeGenderTarget(undefined)).toBeNull();
    expect(normalizeGenderTarget(null)).toBeNull();
  });
});

describe("customFacilityCode", () => {
  it("builds a stable code from the typed name", () => {
    expect(customFacilityCode("Kolam Renang")).toBe("custom_kolam_renang");
    expect(customFacilityCode("CCTV 24 Jam!")).toBe("custom_cctv_24_jam");
  });

  it("is the same for names that differ only in case or spacing", () => {
    expect(customFacilityCode("kolam   renang")).toBe(customFacilityCode("Kolam Renang"));
    expect(customFacilityCode("KOLAM RENANG")).toBe(customFacilityCode("kolam renang"));
  });
});
