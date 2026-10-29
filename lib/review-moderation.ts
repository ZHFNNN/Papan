// Moderasi review oleh admin: alasan penghapusan dikirim ke penulis review lewat notifikasi.
const MIN_REASON_LENGTH = 3; // sama dengan syarat tombol Hapus di halaman Moderasi Review
const MAX_REASON_LENGTH = 500;

export type ParsedRemovalReason = { ok: true; reason: string } | { ok: false; error: string };

export function parseRemovalReason(input: unknown): ParsedRemovalReason {
  const reason =
    typeof input === "object" && input !== null ? (input as { reason?: unknown }).reason : undefined;

  if (typeof reason !== "string") {
    return { ok: false, error: "Alasan penghapusan wajib diisi." };
  }

  const trimmed = reason.trim();
  if (trimmed.length < MIN_REASON_LENGTH) {
    return { ok: false, error: `Alasan penghapusan minimal ${MIN_REASON_LENGTH} karakter.` };
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `Alasan penghapusan maksimal ${MAX_REASON_LENGTH} karakter.` };
  }

  return { ok: true, reason: trimmed };
}

// Tipe ini tidak punya ikon khusus, jadi tampil sebagai notifikasi umum di halaman Notifikasi.
export function reviewRemovedNotification(propertyTitle: string, reason: string) {
  return {
    type: "REVIEW_REMOVED",
    title: "Ulasan kamu dihapus admin",
    message: `Ulasan kamu untuk "${propertyTitle}" dihapus oleh admin. Alasan: ${reason}`,
  };
}
