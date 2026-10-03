import { describe, expect, it } from "vitest";
import {
  MIN_PROPERTY_PHOTOS,
  hasEnoughPhotos,
  minPhotosMessage,
  sanitizePhotoUrls,
} from "@/lib/property-photos";

describe("aturan minimal foto properti", () => {
  it("minimal foto adalah 4", () => {
    expect(MIN_PROPERTY_PHOTOS).toBe(4);
  });

  it("boundary: 0, 3 ditolak; 4, 5 diterima", () => {
    expect(hasEnoughPhotos(0)).toBe(false);
    expect(hasEnoughPhotos(3)).toBe(false);
    expect(hasEnoughPhotos(4)).toBe(true);
    expect(hasEnoughPhotos(5)).toBe(true);
  });

  it("sanitizePhotoUrls membuang non-string, string kosong, dan duplikat", () => {
    expect(sanitizePhotoUrls(["a", " b ", "", "  ", 1, null, "a"])).toEqual(["a", "b"]);
  });

  it("sanitizePhotoUrls mengembalikan [] jika input bukan array", () => {
    expect(sanitizePhotoUrls(undefined)).toEqual([]);
    expect(sanitizePhotoUrls("http://x")).toEqual([]);
  });

  it("4 URL sama dihitung 1 foto (tidak bisa akal-akalan)", () => {
    const urls = sanitizePhotoUrls(["u", "u", "u", "u"]);
    expect(hasEnoughPhotos(urls.length)).toBe(false);
  });

  it("pesan error menyebut jumlah saat ini", () => {
    expect(minPhotosMessage(2)).toContain("4");
    expect(minPhotosMessage(2)).toContain("2");
  });
});
