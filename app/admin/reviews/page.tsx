'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { signOut } from 'next-auth/react';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import {
  type AdminReview,
  type ReportedReview,
  deleteReviewAsAdmin,
  dismissReviewReports,
  fetchAdminReviews,
  fetchReportedReviews,
} from '@/lib/admin-reviews-api';

const RATING_OPTIONS = [5, 4, 3, 2, 1];
const REASON_PRESETS = ['Kata kasar / tidak sopan', 'Spam atau promosi', 'Tidak relevan dengan properti', 'Informasi palsu'];

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

const displayName = (u: { name: string | null; username: string | null; email?: string | null }) =>
  u.name ?? u.username ?? u.email ?? 'Pengguna';

type Tab = 'reported' | 'all';

export default function AdminReviewsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('reported');
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Laporan dari user
  const [reported, setReported] = useState<ReportedReview[]>([]);
  const [isLoadingReported, setIsLoadingReported] = useState(true);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  // Filter
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);

  // Dialog hapus
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleError = useCallback((err: unknown, fallback: string) => {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') {
      router.push('/login');
      return;
    }
    toast.error(err instanceof Error ? err.message : fallback);
  }, [router]);

  const loadReported = useCallback(async () => {
    setIsLoadingReported(true);
    try {
      setReported(await fetchReportedReviews());
    } catch (err) {
      handleError(err, 'Gagal memuat laporan review.');
    } finally {
      setIsLoadingReported(false);
    }
  }, [handleError]);

  useEffect(() => {
    loadReported();
  }, [loadReported]);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      setReviews(await fetchAdminReviews({ q: query, rating, hasPhoto }));
    } catch (err) {
      handleError(err, 'Gagal memuat review.');
    } finally {
      setIsLoading(false);
    }
  }, [query, rating, hasPhoto, handleError]);

  // Debounce supaya tidak fetch di setiap ketikan
  useEffect(() => {
    const id = setTimeout(loadReviews, 300);
    return () => clearTimeout(id);
  }, [loadReviews]);

  const openDelete = (review: AdminReview) => {
    setTarget(review);
    setReason('');
  };

  const closeDelete = () => {
    if (isDeleting) return;
    setTarget(null);
  };

  const confirmDelete = async () => {
    if (!target || reason.trim().length < 3) return;
    setIsDeleting(true);
    try {
      await deleteReviewAsAdmin(target.id, reason.trim());
      setReviews((prev) => prev.filter((r) => r.id !== target.id));
      setReported((prev) => prev.filter((r) => r.id !== target.id));
      toast.success('Review dihapus. User akan menerima notifikasi.');
      setTarget(null);
    } catch (err) {
      handleError(err, 'Gagal menghapus review.');
    } finally {
      setIsDeleting(false);
    }
  };

  const dismissReports = async (review: ReportedReview) => {
    setDismissingId(review.id);
    try {
      await dismissReviewReports(review.id);
      setReported((prev) => prev.filter((r) => r.id !== review.id));
      toast.success('Laporan ditolak. Review tetap tampil.');
    } catch (err) {
      handleError(err, 'Gagal menolak laporan.');
    } finally {
      setDismissingId(null);
    }
  };

  const renderReviewBody = (review: AdminReview) => (
    <>
      <div className={styles.cardHeader}>
        <div>
          <p className={styles.userName}>{displayName(review.user)}</p>
          <p className={styles.meta}>
            {review.user.username ? `@${review.user.username} · ` : ''}
            {formatDate(review.createdAt)}
          </p>
        </div>
        <span className={`${styles.rating} ${review.rating <= 2 ? styles.ratingLow : ''}`}>
          {'★'.repeat(review.rating)}
          {'☆'.repeat(5 - review.rating)}
        </span>
      </div>

      <button
        className={styles.propertyLink}
        onClick={() => router.push(`/propertyDetail/${encodeURIComponent(review.property.id)}`)}
      >
        🏠 {review.property.title}
      </button>

      <p className={styles.comment}>{review.comment || <em>Tanpa komentar</em>}</p>

      {review.imageUrls.length > 0 && (
        <div className={styles.photos}>
          {review.imageUrls.map((src, i) => (
            <img
              key={i}
              src={optimizeImage(src, IMAGE_WIDTH.thumb)}
              alt="Foto ulasan"
              className={styles.photo}
              loading="lazy"
              decoding="async"
            />
          ))}
        </div>
      )}
    </>
  );

  const skeletons = (
    <div className={styles.list}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`${styles.card} ${styles.skeleton}`} />
      ))}
    </div>
  );

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🏠</span>
          <span className={styles.brandName}>PAPAN Admin</span>
        </div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => router.push('/admin/kyc')}>
            <span>📋</span> Verifikasi KYC
          </button>
          <button className={styles.navItem} onClick={() => router.push('/admin/notifications')}>
            <span>🔔</span> Kirim Notifikasi
          </button>
          <button className={styles.navItem} onClick={() => router.push('/admin/chat')}>
            <span>💬</span> Monitoring Chat
          </button>
          <button className={`${styles.navItem} ${styles.navItemActive}`}>
            <span>⭐</span> Moderasi Review
          </button>
        </nav>
        <button className={styles.sidebarLogout} onClick={() => signOut({ callbackUrl: '/login' })}>
          Log Out
        </button>
      </aside>

      <main className={styles.main}>
        <div className={styles.topbar}>
          <div>
            <h1 className={styles.pageTitle}>Moderasi Review</h1>
            <p className={styles.subtitle}>Tinjau laporan dari user, lalu putuskan review dihapus atau tetap tampil.</p>
          </div>
        </div>

        <div className={styles.tabs} role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'reported'}
            className={`${styles.tab} ${tab === 'reported' ? styles.tabActive : ''}`}
            onClick={() => setTab('reported')}
          >
            Dilaporkan
            <span className={styles.tabCount}>{isLoadingReported ? '…' : reported.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'all'}
            className={`${styles.tab} ${tab === 'all' ? styles.tabActive : ''}`}
            onClick={() => setTab('all')}
          >
            Semua Review
            <span className={styles.tabCount}>{isLoading ? '…' : reviews.length}</span>
          </button>
        </div>

        {/* Review yang dilaporkan user */}
        {tab === 'reported' && (
          isLoadingReported ? skeletons : reported.length === 0 ? (
            <div className={styles.empty}>Belum ada laporan review yang perlu ditinjau. 🎉</div>
          ) : (
            <div className={styles.list}>
              {reported.map((review) => (
                <article key={review.id} className={styles.card}>
                  {renderReviewBody(review)}

                  <div className={styles.reports}>
                    <p className={styles.reportsTitle}>🚩 Dilaporkan {review.reports.length} user</p>
                    <ul className={styles.reportList}>
                      {review.reports.map((report) => (
                        <li key={report.id} className={styles.reportItem}>
                          <p className={styles.reportReason}>&ldquo;{report.reason}&rdquo;</p>
                          <p className={styles.reportMeta}>
                            {displayName(report.reporter)} · {formatDate(report.createdAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className={styles.cardActions}>
                    <button
                      className={styles.dismissBtn}
                      onClick={() => dismissReports(review)}
                      disabled={dismissingId === review.id}
                    >
                      {dismissingId === review.id ? 'Memproses…' : 'Tolak Laporan'}
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => {
                        openDelete(review);
                        setReason(review.reports[0]?.reason ?? '');
                      }}
                    >
                      Hapus Review
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )
        )}

        {/* Semua review */}
        {tab === 'all' && (
        <>
        <div className={styles.filters}>
          <input
            className={styles.searchInput}
            placeholder="Cari komentar, nama user, atau properti…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className={styles.ratingFilter}>
            <button
              className={`${styles.chip} ${rating === null ? styles.chipActive : ''}`}
              onClick={() => setRating(null)}
            >
              Semua
            </button>
            {RATING_OPTIONS.map((r) => (
              <button
                key={r}
                className={`${styles.chip} ${rating === r ? styles.chipActive : ''}`}
                onClick={() => setRating(r)}
              >
                {r} ⭐
              </button>
            ))}
          </div>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={hasPhoto} onChange={(e) => setHasPhoto(e.target.checked)} />
            Ada foto
          </label>
        </div>

        {isLoading ? skeletons : reviews.length === 0 ? (
          <div className={styles.empty}>Tidak ada review yang cocok dengan filter.</div>
        ) : (
          <div className={styles.list}>
            {reviews.map((review) => (
              <article key={review.id} className={styles.card}>
                {renderReviewBody(review)}
                <div className={styles.cardActions}>
                  <button className={styles.deleteBtn} onClick={() => openDelete(review)}>
                    Hapus Review
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        </>
        )}
      </main>

      {/* Dialog konfirmasi hapus + alasan */}
      {target && (
        <div className={styles.overlay} onClick={closeDelete}>
          <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.dialogTitle}>Hapus review ini?</h2>
            <p className={styles.dialogText}>
              Review dari <strong>{displayName(target.user)}</strong> untuk <strong>{target.property.title}</strong>{' '}
              akan dihapus permanen beserta balasannya.
            </p>

            <p className={styles.dialogLabel}>Alasan penghapusan (dikirim ke user)</p>
            <div className={styles.reasonPresets}>
              {REASON_PRESETS.map((preset) => (
                <button
                  key={preset}
                  className={`${styles.chip} ${reason === preset ? styles.chipActive : ''}`}
                  onClick={() => setReason(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              className={styles.reasonInput}
              placeholder="Atau tulis alasan sendiri…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />

            <div className={styles.dialogActions}>
              <button className={styles.cancelBtn} onClick={closeDelete} disabled={isDeleting}>
                Batal
              </button>
              <button
                className={styles.confirmBtn}
                onClick={confirmDelete}
                disabled={isDeleting || reason.trim().length < 3}
              >
                {isDeleting ? 'Menghapus…' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
