'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { signOut } from 'next-auth/react';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { type AdminReview, deleteReviewAsAdmin, fetchAdminReviews } from '@/lib/admin-reviews-api';

const RATING_OPTIONS = [5, 4, 3, 2, 1];
const REASON_PRESETS = ['Kata kasar / tidak sopan', 'Spam atau promosi', 'Tidak relevan dengan properti', 'Informasi palsu'];

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));

const displayName = (u: AdminReview['user']) => u.name ?? u.username ?? u.email ?? 'Pengguna';

export default function AdminReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter
  const [query, setQuery] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [hasPhoto, setHasPhoto] = useState(false);

  // Dialog hapus
  const [target, setTarget] = useState<AdminReview | null>(null);
  const [reason, setReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const loadReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      setReviews(await fetchAdminReviews({ q: query, rating, hasPhoto }));
    } catch (err) {
      if (err instanceof Error && err.message === 'UNAUTHORIZED') {
        router.push('/login');
        return;
      }
      toast.error('Gagal memuat review.');
    } finally {
      setIsLoading(false);
    }
  }, [query, rating, hasPhoto, router]);

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
      toast.success('Review dihapus. User akan menerima notifikasi.');
      setTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus review.');
    } finally {
      setIsDeleting(false);
    }
  };

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
            <p className={styles.subtitle}>Hapus review yang melanggar aturan. User akan diberi tahu alasannya.</p>
          </div>
          <span className={styles.countBadge}>{isLoading ? '…' : `${reviews.length} review`}</span>
        </div>

        {/* Filter */}
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

        {/* Daftar review */}
        {isLoading ? (
          <div className={styles.list}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={`${styles.card} ${styles.skeleton}`} />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <div className={styles.empty}>Tidak ada review yang cocok dengan filter.</div>
        ) : (
          <div className={styles.list}>
            {reviews.map((review) => (
              <article key={review.id} className={styles.card}>
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

                <div className={styles.cardActions}>
                  <button className={styles.deleteBtn} onClick={() => openDelete(review)}>
                    Hapus Review
                  </button>
                </div>
              </article>
            ))}
          </div>
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
