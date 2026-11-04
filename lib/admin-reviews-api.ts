/**
 * API moderasi review untuk admin.
 *
 * DAFTAR REVIEW — data asli, dirakit dari endpoint yang sudah ada:
 *   GET /api/properties?take=200            -> daftar properti
 *   GET /api/properties/[id]/reviews        -> review per properti
 *
 * LAPORAN & KEPUTUSAN ADMIN (endpoint dari tim BE):
 *   GET    /api/admin/review-reports               -> review yang dilaporkan user
 *   PATCH  /api/admin/reviews/[reviewId]/dismiss   -> tolak laporan, review tetap tampil
 *   DELETE /api/admin/reviews/[reviewId]           body: { reason } -> hapus + notifikasi ke penulis
 */

export type AdminReview = {
  id: string;
  rating: number;
  comment: string | null;
  imageUrls: string[];
  createdAt: string;
  user: { id: string; name: string | null; username: string | null; email: string | null };
  property: { id: string; title: string };
};

export type ReviewReport = {
  id: string;
  reason: string;
  createdAt: string;
  reporter: { id: string; name: string | null; username: string | null };
};

export type ReportedReview = AdminReview & { reports: ReviewReport[] };

export type AdminReviewFilter = {
  q?: string;
  rating?: number | null;
  hasPhoto?: boolean;
};

const PROPERTY_LIMIT = 200;
/** Jumlah request review yang dijalankan bersamaan. */
const CONCURRENCY = 8;

type ApiPropertyLite = { id: string; title: string };
type ApiReview = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  photos?: { id: string; data: string }[];
  user: { id: string; name: string | null; username: string | null };
};

// Cache di memori supaya ganti filter tidak mengambil ulang semua data
let cachedReviews: AdminReview[] | null = null;
const locallyDeleted = new Set<string>();

async function fetchReviewsOfProperty(property: ApiPropertyLite): Promise<AdminReview[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(property.id)}/reviews`);
  if (!res.ok) return [];
  const json = await res.json().catch(() => ({}));
  const reviews: ApiReview[] = Array.isArray(json.data?.reviews) ? json.data.reviews : [];
  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    imageUrls: (r.photos ?? []).map((photo) => photo.data),
    createdAt: r.createdAt,
    user: { id: r.user.id, name: r.user.name, username: r.user.username, email: null },
    property: { id: property.id, title: property.title },
  }));
}

async function loadAllReviews(): Promise<AdminReview[]> {
  const res = await fetch(`/api/properties?take=${PROPERTY_LIMIT}`);
  if (!res.ok) throw new Error('Gagal memuat daftar properti.');
  const json = await res.json().catch(() => ({}));
  const properties: ApiPropertyLite[] = Array.isArray(json.data) ? json.data : [];

  const result: AdminReview[] = [];
  for (let i = 0; i < properties.length; i += CONCURRENCY) {
    const batch = await Promise.all(properties.slice(i, i + CONCURRENCY).map(fetchReviewsOfProperty));
    batch.forEach((list) => result.push(...list));
  }

  return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function applyFilter(list: AdminReview[], filter: AdminReviewFilter) {
  const q = filter.q?.trim().toLowerCase();
  return list.filter((r) => {
    if (locallyDeleted.has(r.id)) return false;
    if (filter.rating && r.rating !== filter.rating) return false;
    if (filter.hasPhoto && r.imageUrls.length === 0) return false;
    if (!q) return true;
    return [r.comment, r.user.name, r.user.username, r.property.title]
      .some((v) => v?.toLowerCase().includes(q));
  });
}

export async function fetchAdminReviews(filter: AdminReviewFilter = {}, options: { refresh?: boolean } = {}) {
  if (!cachedReviews || options.refresh) {
    cachedReviews = await loadAllReviews();
  }
  return applyFilter(cachedReviews, filter);
}

async function readError(res: Response, fallback: string) {
  if (res.status === 401 || res.status === 403) return new Error('UNAUTHORIZED');
  const json = await res.json().catch(() => ({}));
  return new Error(json.message ?? fallback);
}

export async function fetchReportedReviews(): Promise<ReportedReview[]> {
  const res = await fetch('/api/admin/review-reports');
  if (!res.ok) throw await readError(res, 'Gagal memuat laporan review.');
  const json = await res.json().catch(() => ({}));
  const items: ReportedReview[] = Array.isArray(json.data) ? json.data : [];
  return items.filter((r) => !locallyDeleted.has(r.id));
}

export async function dismissReviewReports(reviewId: string): Promise<void> {
  const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}/dismiss`, { method: 'PATCH' });
  if (!res.ok) throw await readError(res, 'Gagal menolak laporan.');
}

export async function deleteReviewAsAdmin(reviewId: string, reason: string): Promise<void> {
  const res = await fetch(`/api/admin/reviews/${encodeURIComponent(reviewId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw await readError(res, 'Gagal menghapus review.');
  // Supaya daftar dari cache tidak menampilkan review yang sudah dihapus
  locallyDeleted.add(reviewId);
}

/** Dipakai user biasa di halaman detail properti. */
export async function reportReview(reviewId: string, reason: string): Promise<void> {
  const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (res.status === 409) throw new Error('ALREADY_REPORTED');
  if (!res.ok) throw await readError(res, 'Gagal mengirim laporan.');
}
