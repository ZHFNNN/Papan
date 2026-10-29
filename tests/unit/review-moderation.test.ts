import { describe, expect, it } from "vitest";
import { parseRemovalReason } from "@/lib/review-moderation";

/**
 * Unit tests untuk alasan yang diisi admin saat menghapus review di halaman Moderasi Review.
 * Alasan ini dikirim ke penulis review lewat notifikasi.
 */

describe("parseRemovalReason — validasi alasan hapus review", () => {
  // A1: spasi di awal/akhir dibuang sebelum disimpan ke notifikasi
  it("A1: trims the reason", () => {
    expect(parseRemovalReason({ reason: "  Spam atau promosi  " })).toEqual({
      ok: true,
      reason: "Spam atau promosi",
    });
  });

  // A2: body tanpa reason bertipe string ditolak
  it.each([[null], [undefined], ["Spam"], [["Spam"]], [{}], [{ reason: 123 }]])(
    "A2: rejects a body without a string reason (%j)",
    (body: unknown) => {
      expect(parseRemovalReason(body).ok).toBe(false);
    },
  );

  // A3: minimal 3 karakter setelah di-trim, sama dengan aturan tombol di form admin
  it("A3: requires at least 3 characters after trimming", () => {
    expect(parseRemovalReason({ reason: "  ab  " }).ok).toBe(false);
    expect(parseRemovalReason({ reason: "abc" })).toEqual({ ok: true, reason: "abc" });
  });

  // A4: maksimal 500 karakter supaya isi notifikasi tetap wajar
  it("A4: rejects reasons longer than 500 characters", () => {
    expect(parseRemovalReason({ reason: "a".repeat(500) }).ok).toBe(true);
    expect(parseRemovalReason({ reason: "a".repeat(501) }).ok).toBe(false);
  });
});
