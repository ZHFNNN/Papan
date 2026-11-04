// Moderasi review: alasan laporan dari user dan alasan penghapusan dari admin.
const MIN_REASON_LENGTH = 3; // sama dengan syarat tombol Hapus di halaman Moderasi Review
const MAX_REASON_LENGTH = 500;

export type ParsedReason = { ok: true; reason: string } | { ok: false; error: string };

export function parseReason(input: unknown): ParsedReason {
  const reason =
    typeof input === "object" && input !== null ? (input as { reason?: unknown }).reason : undefined;

  if (typeof reason !== "string") {
    return { ok: false, error: "Alasan wajib diisi." };
  }

  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return { ok: false, error: `Alasan minimal ${MIN_REASON_LENGTH} karakter.` };
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `Alasan maksimal ${MAX_REASON_LENGTH} karakter.` };
  }

  return { ok: true, reason: trimmed };
}

export type PendingReportRow = {
  id: string;
  reason: string;
  createdAt: Date;
  reporter: { id: string; name: string | null; username: string | null };
  review: {
    id: string;
    rating: number;
    comment: string | null;
    imageUrls: string[];
    createdAt: Date;
    user: { id: string; name: string | null; username: string | null; email: string | null };
    property: { id: string; title: string };
  };
};

export type ReportedReview = PendingReportRow["review"] & {
  reports: Omit<PendingReportRow, "review">[];
};

// Satu item per review untuk antrean admin: laporan terbanyak di atas, seri -> laporan terbaru.
export function groupReportsByReview(rows: PendingReportRow[]): ReportedReview[] {
  const byReview = new Map<string, ReportedReview>();
  for (const { review, ...report } of rows) {
    const item = byReview.get(review.id) ?? { ...review, reports: [] };
    item.reports.push(report);
    byReview.set(review.id, item);
  }

  const items = [...byReview.values()];
  for (const item of items) {
    item.reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  const newestReport = (item: ReportedReview) => item.reports[0].createdAt.getTime();
  return items.sort((a, b) => b.reports.length - a.reports.length || newestReport(b) - newestReport(a));
}

// Tipe ini tidak punya ikon khusus, jadi tampil sebagai notifikasi umum di halaman Notifikasi.
export function reviewRemovedNotification(propertyTitle: string, reason: string) {
  return {
    type: "REVIEW_REMOVED",
    title: "Ulasan kamu dihapus admin",
    message: `Ulasan kamu untuk "${propertyTitle}" dihapus oleh admin. Alasan: ${reason}`,
  };
}
