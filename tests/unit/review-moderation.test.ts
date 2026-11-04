import { describe, expect, it } from "vitest";
import { groupReportsByReview, parseReason } from "@/lib/review-moderation";

/**
 * Unit tests untuk alasan yang diisi user saat melaporkan review dan admin saat menghapusnya.
 * Alasan penghapusan dikirim ke penulis review lewat notifikasi.
 */

describe("parseReason — validasi alasan laporan dan hapus review", () => {
  // A1: spasi di awal/akhir dibuang sebelum disimpan ke notifikasi
  it("A1: trims the reason", () => {
    expect(parseReason({ reason: "  Spam atau promosi  " })).toEqual({
      ok: true,
      reason: "Spam atau promosi",
    });
  });

  // A2: body tanpa reason bertipe string ditolak
  it.each([[null], [undefined], ["Spam"], [["Spam"]], [{}], [{ reason: 123 }]])(
    "A2: rejects a body without a string reason (%j)",
    (body: unknown) => {
      expect(parseReason(body).ok).toBe(false);
    },
  );

  // A3: minimal 3 karakter setelah di-trim, sama dengan aturan tombol di form admin
  it("A3: requires at least 3 characters after trimming", () => {
    expect(parseReason({ reason: "  ab  " }).ok).toBe(false);
    expect(parseReason({ reason: "abc" })).toEqual({ ok: true, reason: "abc" });
  });

  // A4: maksimal 500 karakter supaya isi notifikasi tetap wajar
  it("A4: rejects reasons longer than 500 characters", () => {
    expect(parseReason({ reason: "a".repeat(500) }).ok).toBe(true);
    expect(parseReason({ reason: "a".repeat(501) }).ok).toBe(false);
  });
});

function reportRow(id: string, reviewId: string, createdAt: string) {
  return {
    id,
    reason: `Alasan ${id}`,
    createdAt: new Date(createdAt),
    reporter: { id: `reporter-${id}`, name: `Pelapor ${id}`, username: null },
    review: {
      id: reviewId,
      rating: 1,
      comment: `Isi ${reviewId}`,
      imageUrls: [],
      createdAt: new Date("2026-10-01T00:00:00Z"),
      user: { id: `author-${reviewId}`, name: `Penulis ${reviewId}`, username: null, email: null },
      property: { id: "prop-1", title: "Kos Melati Jatinangor" },
    },
  };
}

describe("groupReportsByReview — daftar review yang dilaporkan untuk admin", () => {
  // G1: laporan untuk review yang sama digabung di bawah review itu, laporan terbaru di atas
  it("G1: puts every report of a review under that review, newest first", () => {
    const result = groupReportsByReview([
      reportRow("rep-1", "review-a", "2026-10-20T08:00:00Z"),
      reportRow("rep-2", "review-a", "2026-10-21T08:00:00Z"),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("review-a");
    expect(result[0].comment).toBe("Isi review-a");
    expect(result[0].reports.map((report) => report.id)).toEqual(["rep-2", "rep-1"]);
    expect(result[0].reports[0]).toEqual({
      id: "rep-2",
      reason: "Alasan rep-2",
      createdAt: new Date("2026-10-21T08:00:00Z"),
      reporter: { id: "reporter-rep-2", name: "Pelapor rep-2", username: null },
    });
  });

  // G2: review dengan laporan terbanyak tampil paling atas
  it("G2: lists the most reported review first", () => {
    const result = groupReportsByReview([
      reportRow("rep-1", "review-a", "2026-10-25T08:00:00Z"),
      reportRow("rep-2", "review-b", "2026-10-20T08:00:00Z"),
      reportRow("rep-3", "review-b", "2026-10-21T08:00:00Z"),
    ]);

    expect(result.map((review) => review.id)).toEqual(["review-b", "review-a"]);
  });

  // G3: jumlah laporan sama -> review dengan laporan paling baru di atas
  it("G3: breaks ties by the newest report", () => {
    const result = groupReportsByReview([
      reportRow("rep-1", "review-a", "2026-10-20T08:00:00Z"),
      reportRow("rep-2", "review-b", "2026-10-22T08:00:00Z"),
    ]);

    expect(result.map((review) => review.id)).toEqual(["review-b", "review-a"]);
  });
});
