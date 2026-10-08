import { describe, expect, it } from "vitest";
import { parseCloudinaryUploadUrl } from "@/lib/image";
import { isBase64ImageDataUri, isReviewPhotoUrl } from "@/lib/review-photos";

const CLOUD = "papancloud";
const GOOD = `https://res.cloudinary.com/${CLOUD}/image/upload/v1712345/papan/reviews/abc123.jpg`;

describe("parseCloudinaryUploadUrl", () => {
  it("returns cloud name and public_id", () => {
    expect(parseCloudinaryUploadUrl(GOOD)).toEqual({ cloudName: CLOUD, publicId: "papan/reviews/abc123" });
  });

  it("works without a version segment", () => {
    expect(parseCloudinaryUploadUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/papan/x.png`)).toEqual({
      cloudName: CLOUD,
      publicId: "papan/x",
    });
  });

  it("rejects other hosts, http, and non-upload paths", () => {
    expect(parseCloudinaryUploadUrl("https://evil.example/papancloud/image/upload/v1/a.jpg")).toBeNull();
    expect(parseCloudinaryUploadUrl(`http://res.cloudinary.com/${CLOUD}/image/upload/v1/a.jpg`)).toBeNull();
    expect(parseCloudinaryUploadUrl(`https://res.cloudinary.com/${CLOUD}/video/upload/v1/a.mp4`)).toBeNull();
  });

  it("returns null for malformed input instead of throwing", () => {
    expect(parseCloudinaryUploadUrl("not a url")).toBeNull();
    expect(parseCloudinaryUploadUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/%E0%A4%A.jpg`)).toBeNull();
  });
});

describe("isReviewPhotoUrl", () => {
  it("accepts an uploaded review photo from our own cloud", () => {
    expect(isReviewPhotoUrl(GOOD, CLOUD)).toBe(true);
  });

  it("rejects base64 data URIs (the old storage format)", () => {
    expect(isReviewPhotoUrl("data:image/png;base64,iVBORw0KGgo=", CLOUD)).toBe(false);
  });

  it("rejects photos from another Cloudinary account", () => {
    expect(isReviewPhotoUrl(GOOD.replace(CLOUD, "othercloud"), CLOUD)).toBe(false);
  });

  it("rejects images outside the reviews folder (e.g. old public KTP photos)", () => {
    expect(isReviewPhotoUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/papan/ktp/abc.jpg`, CLOUD)).toBe(false);
    expect(isReviewPhotoUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/papan/reviews.jpg`, CLOUD)).toBe(false);
  });

  it("rejects path traversal out of the reviews folder", () => {
    expect(
      isReviewPhotoUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/papan/reviews/../ktp/abc.jpg`, CLOUD),
    ).toBe(false);
  });

  it("rejects everything when the cloud name is not configured", () => {
    expect(isReviewPhotoUrl(GOOD, undefined)).toBe(false);
    expect(isReviewPhotoUrl(GOOD, "")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isReviewPhotoUrl(null, CLOUD)).toBe(false);
    expect(isReviewPhotoUrl(42, CLOUD)).toBe(false);
  });
});

describe("isBase64ImageDataUri", () => {
  it("detects base64 image data URIs", () => {
    expect(isBase64ImageDataUri("data:image/jpeg;base64,/9j/4AAQ")).toBe(true);
    expect(isBase64ImageDataUri("data:image/svg+xml;base64,PHN2Zz4=")).toBe(true);
  });

  it("ignores URLs and other data URIs", () => {
    expect(isBase64ImageDataUri(GOOD)).toBe(false);
    expect(isBase64ImageDataUri("data:text/plain;base64,aGk=")).toBe(false);
  });
});
