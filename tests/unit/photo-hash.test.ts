import { describe, expect, it } from "vitest";
import {
  buildPropertyPhotoPublicId,
  duplicatePhotoMessage,
  hasDuplicatePhotoUrls,
  hashBytes,
  splitDuplicatePhotos,
} from "@/lib/photo-hash";

const photo = (content: string, name: string) => new File([content], name, { type: "image/jpeg" });
const cloudinaryUrl = (version: number, publicId: string) =>
  `https://res.cloudinary.com/demo/image/upload/v${version}/papan/properties/${publicId}.jpg`;

describe("hashBytes", () => {
  it("gives the same hash for identical bytes and a different one otherwise", async () => {
    const a = await hashBytes(new TextEncoder().encode("foto-1"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashBytes(new TextEncoder().encode("foto-1"))).toBe(a);
    expect(await hashBytes(new TextEncoder().encode("foto-2"))).not.toBe(a);
  });
});

describe("splitDuplicatePhotos", () => {
  it("accepts photos with different content", async () => {
    const { accepted, duplicates } = await splitDuplicatePhotos([photo("a", "1.jpg"), photo("b", "2.jpg")], []);
    expect(accepted).toHaveLength(2);
    expect(duplicates).toHaveLength(0);
  });

  it("rejects the same content even when the file name differs", async () => {
    const { accepted, duplicates } = await splitDuplicatePhotos([photo("a", "depan.jpg"), photo("a", "copy.jpg")], []);
    expect(accepted.map((p) => p.file.name)).toEqual(["depan.jpg"]);
    expect(duplicates.map((f) => f.name)).toEqual(["copy.jpg"]);
  });

  it("rejects a photo that was already picked earlier", async () => {
    const first = await splitDuplicatePhotos([photo("a", "1.jpg")], []);
    const second = await splitDuplicatePhotos([photo("a", "1.jpg")], first.accepted.map((p) => p.hash));
    expect(second.accepted).toHaveLength(0);
    expect(second.duplicates).toHaveLength(1);
  });

  it("rejects a photo that is already stored on the property", async () => {
    const hash = await hashBytes(new TextEncoder().encode("a"));
    const stored = [cloudinaryUrl(1, buildPropertyPhotoPublicId("user1", hash))];
    const { accepted, duplicates } = await splitDuplicatePhotos([photo("a", "x.jpg"), photo("b", "y.jpg")], [], stored);
    expect(duplicates.map((f) => f.name)).toEqual(["x.jpg"]);
    expect(accepted.map((p) => p.file.name)).toEqual(["y.jpg"]);
  });
});

describe("duplicatePhotoMessage", () => {
  it("names up to three files and counts the rest", () => {
    expect(duplicatePhotoMessage(["a.jpg"])).toContain('"a.jpg"');
    expect(duplicatePhotoMessage(["a", "b", "c", "d", "e"])).toContain("dan 2 lainnya");
  });
});

describe("buildPropertyPhotoPublicId", () => {
  it("is stable per owner + content and differs between owners", () => {
    expect(buildPropertyPhotoPublicId("u1", "abc")).toBe(buildPropertyPhotoPublicId("u1", "abc"));
    expect(buildPropertyPhotoPublicId("u1", "abc")).not.toBe(buildPropertyPhotoPublicId("u2", "abc"));
  });
});

describe("hasDuplicatePhotoUrls", () => {
  it("flags the same image even when Cloudinary gave it a new version", () => {
    expect(hasDuplicatePhotoUrls([cloudinaryUrl(1, "u1_aaa"), cloudinaryUrl(2, "u1_aaa")])).toBe(true);
  });

  it("passes distinct images, including legacy and non-Cloudinary URLs", () => {
    expect(hasDuplicatePhotoUrls([cloudinaryUrl(1, "u1_aaa"), cloudinaryUrl(1, "u1_bbb"), cloudinaryUrl(1, "legacy123"), "https://images.unsplash.com/photo-1"])).toBe(false);
  });

  it("flags an identical non-Cloudinary URL repeated", () => {
    expect(hasDuplicatePhotoUrls(["https://x.test/a.jpg", "https://x.test/a.jpg"])).toBe(true);
  });
});
