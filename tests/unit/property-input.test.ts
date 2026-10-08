import { describe, expect, it } from "vitest";
import {
  customFacilityCode,
  normalizeCategory,
  normalizeGenderTarget,
  normalizeListingType,
} from "@/lib/property-input";

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
