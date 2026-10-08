import { describe, expect, it } from "vitest";
import {
  buildKycImagePublicId,
  isAcceptableKycImageRef,
  isKycImageKind,
  isLegacyKycImageUrl,
  isOwnKycImageRef,
  parseLegacyCloudinaryUrl,
} from "@/lib/kyc-image";

const USER = "cmuser123abc";
const OTHER = "cmother456def";
const UUID = "3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b";
const OWN_KTP = `papan/ktp/${USER}/${UUID}`;

describe("isKycImageKind", () => {
  it("accepts ktp and selfie", () => {
    expect(isKycImageKind("ktp")).toBe(true);
    expect(isKycImageKind("selfie")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isKycImageKind("properties")).toBe(false);
    expect(isKycImageKind("")).toBe(false);
  });
});

describe("buildKycImagePublicId", () => {
  it("places the image under the user's own folder", () => {
    expect(buildKycImagePublicId("selfie", USER, UUID)).toBe(`papan/selfie/${USER}/${UUID}`);
  });
});

describe("isOwnKycImageRef", () => {
  it("accepts the user's own upload of the same kind", () => {
    expect(isOwnKycImageRef(OWN_KTP, "ktp", USER)).toBe(true);
  });

  it("rejects another user's upload", () => {
    expect(isOwnKycImageRef(OWN_KTP, "ktp", OTHER)).toBe(false);
  });

  it("rejects a selfie submitted as ktp", () => {
    expect(isOwnKycImageRef(`papan/selfie/${USER}/${UUID}`, "ktp", USER)).toBe(false);
  });

  it("rejects path tricks after the prefix", () => {
    expect(isOwnKycImageRef(`papan/ktp/${USER}/../${OTHER}/${UUID}`, "ktp", USER)).toBe(false);
    expect(isOwnKycImageRef(`papan/ktp/${USER}/${UUID}/extra`, "ktp", USER)).toBe(false);
  });

  it("rejects public URLs and non-strings", () => {
    expect(isOwnKycImageRef("https://evil.example/ktp.jpg", "ktp", USER)).toBe(false);
    expect(isOwnKycImageRef(undefined, "ktp", USER)).toBe(false);
    expect(isOwnKycImageRef(123, "ktp", USER)).toBe(false);
  });

  it("rejects when userId is empty", () => {
    expect(isOwnKycImageRef(`papan/ktp//${UUID}`, "ktp", "")).toBe(false);
  });
});

describe("isAcceptableKycImageRef", () => {
  const legacy = "https://res.cloudinary.com/demo/image/upload/v1712/papan/ktp/abc.jpg";

  it("accepts a fresh upload of the user", () => {
    expect(isAcceptableKycImageRef(OWN_KTP, "ktp", USER, null)).toBe(true);
  });

  it("accepts resubmitting the photo already stored in the submission", () => {
    expect(isAcceptableKycImageRef(legacy, "ktp", USER, legacy)).toBe(true);
  });

  it("rejects an arbitrary URL that is not the stored one", () => {
    expect(isAcceptableKycImageRef("https://evil.example/x.jpg", "ktp", USER, legacy)).toBe(false);
  });

  it("rejects an empty value even when nothing is stored", () => {
    expect(isAcceptableKycImageRef("", "ktp", USER, "")).toBe(false);
    expect(isAcceptableKycImageRef("", "ktp", USER, null)).toBe(false);
  });
});

describe("isLegacyKycImageUrl", () => {
  it("detects stored URLs", () => {
    expect(isLegacyKycImageUrl("https://res.cloudinary.com/x/image/upload/a.jpg")).toBe(true);
    expect(isLegacyKycImageUrl("HTTP://example.com/a.jpg")).toBe(true);
  });

  it("treats public_ids as private refs", () => {
    expect(isLegacyKycImageUrl(OWN_KTP)).toBe(false);
  });
});

describe("parseLegacyCloudinaryUrl", () => {
  it("extracts the public_id with version and folder", () => {
    expect(
      parseLegacyCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/v1712345/papan/ktp/abc123.jpg"),
    ).toEqual({ publicId: "papan/ktp/abc123" });
  });

  it("extracts the public_id without version", () => {
    expect(parseLegacyCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/papan/selfie/x.png")).toEqual({
      publicId: "papan/selfie/x",
    });
  });

  it("keeps dots inside the public_id", () => {
    expect(parseLegacyCloudinaryUrl("https://res.cloudinary.com/demo/image/upload/v1/papan/ktp/a.b.jpg")).toEqual({
      publicId: "papan/ktp/a.b",
    });
  });

  it("rejects other hosts (no SSRF through the image proxy)", () => {
    expect(parseLegacyCloudinaryUrl("https://evil.example/demo/image/upload/v1/a.jpg")).toBeNull();
    expect(parseLegacyCloudinaryUrl("https://res.cloudinary.com.evil.example/demo/image/upload/v1/a.jpg")).toBeNull();
    expect(parseLegacyCloudinaryUrl("http://169.254.169.254/latest/meta-data")).toBeNull();
  });

  it("rejects plain http and non-upload Cloudinary paths", () => {
    expect(parseLegacyCloudinaryUrl("http://res.cloudinary.com/demo/image/upload/v1/a.jpg")).toBeNull();
    expect(parseLegacyCloudinaryUrl("https://res.cloudinary.com/demo/image/authenticated/s--x--/v1/a.jpg")).toBeNull();
  });

  it("rejects invalid URLs", () => {
    expect(parseLegacyCloudinaryUrl("not a url")).toBeNull();
  });
});
