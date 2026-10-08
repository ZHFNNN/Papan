'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';

// Dummy data tidak lagi digunakan, sekarang menggunakan API
type BookmarkedProperty = {
  id: string;
  title: string;
  address?: string | null;
  neighbourhood?: string | null;
  district?: string | null;
  city?: string | null;
  price: number;
  coverImageUrl?: string | null;
  listingType: string;
};

function formatRupiah(value: number): string {
  if (value >= 1_000_000_000) {
    const val = value / 1_000_000_000;
    return `Rp${val % 1 === 0 ? val : val.toFixed(1)} Miliar`;
  }
  if (value >= 1_000_000) {
    const val = value / 1_000_000;
    return `Rp${val % 1 === 0 ? val : val.toFixed(1)} Juta`;
  }
  return `Rp${value.toLocaleString('id-ID')}`;
}

function formatLocation(item: BookmarkedProperty): string {
  return (
    [item.neighbourhood, item.district, item.city]
      .filter((v) => Boolean(v?.trim()))
      .join(', ') || item.address || 'Lokasi belum tersedia'
  );
}

function BookmarkCard({
  item,
  onOpenRemoveConfirm,
  onDetail,
  removing,
}: {
  item: BookmarkedProperty;
  onOpenRemoveConfirm: (item: BookmarkedProperty) => void;
  onDetail: (id: string) => void;
  removing: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={styles.card}>
      <div className={styles.cardThumb}>
        {item.coverImageUrl && !imgError ? (
          <img
            src={optimizeImage(item.coverImageUrl, IMAGE_WIDTH.thumb * 2)}
            alt={item.title}
            className={styles.cardImg}
            loading="lazy" decoding="async"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={styles.cardImgFallback}>
            <span>🏠</span>
          </div>
        )}
      </div>

      <div className={styles.cardInfo}>
        <p className={styles.cardTitle}>{item.title}</p>
        <p className={styles.cardLocation}>
          {formatLocation(item)}
        </p>
        <p className={styles.cardPrice}>{formatRupiah(item.price)}</p>
      </div>

      <div className={styles.cardActions}>
        <button className={styles.btnPrimary} onClick={() => onDetail(item.id)}>
          Lihat Detail
        </button>
        <button
          className={`${styles.btnSecondary} ${styles.btnDanger}`}
          onClick={() => onOpenRemoveConfirm(item)}
          disabled={removing}
        >
          {removing ? 'Menghapus...' : 'Hapus dari bookmark'}
        </button>
      </div>
    </div>
  );
}

export default function BookmarkPage() {
  const router = useRouter();
  const { status } = useSession();
  const [bookmarks, setBookmarks] = useState<BookmarkedProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<BookmarkedProperty | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent('/bookmark')}`);
    }
  }, [status, router]);

  const fetchBookmarks = async () => {
    try {
      const res = await fetch('/api/bookmarks');
      const json = await res.json();
      if (res.ok && json.data) {
        setBookmarks(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch bookmarks:', error);
      setError('Terjadi kesalahan saat memuat bookmark.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchBookmarks();
    }
  }, [status]);

  const handleRemove = async (id: string) => {
    setRemovingId(id);
    // Optimistic UI update
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    
    try {
      const res = await fetch(`/api/bookmarks/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        // Revert if failed
        fetchBookmarks();
      }
    } catch (error) {
      console.error('Failed to remove bookmark:', error);
      fetchBookmarks();
    } finally {
      setRemovingId((prev) => (prev === id ? null : prev));
    }
  };

  const closeConfirm = () => {
    if (removingId) return;
    setConfirmItem(null);
  };

  const confirmRemove = async () => {
    if (!confirmItem) return;
    const id = confirmItem.id;
    setConfirmItem(null);
    await handleRemove(id);
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.contentArea}>
        <div className={styles.container}>
          {/* Header */}
          <div className={styles.pageHeader}>
            <div>
              <p className={styles.headerTitle}>Properti yang kamu tandai</p>
              <p className={styles.headerSubtitle}>
                {isLoading ? '...' : `${bookmarks.length} properti tersimpan`}
              </p>
            </div>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat bookmark...</p>
            </div>
          ) : error ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>⚠️</p>
              <p className={styles.emptyTitle}>Terjadi kesalahan</p>
              <p className={styles.emptyDesc}>{error}</p>
            </div>
          ) : bookmarks.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyIcon}>🔖</p>
              <p className={styles.emptyTitle}>Belum ada bookmark</p>
              <p className={styles.emptyDesc}>
                Tandai properti favoritmu agar mudah ditemukan kembali.
              </p>
              <button className={styles.emptyBtn} onClick={() => router.push('/')}>
                Jelajahi Properti
              </button>
            </div>
          ) : (
            <div className={styles.cardList}>
              {bookmarks.map((item) => (
                <BookmarkCard
                  key={item.id}
                  item={item}
                  onOpenRemoveConfirm={setConfirmItem}
                  onDetail={(id) => router.push(`/propertyDetail/${id}`)}
                  removing={removingId === item.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmItem && (
        <div
          className={styles.modalOverlay}
          onClick={closeConfirm}
          role="presentation"
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Konfirmasi hapus bookmark"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeConfirm();
            }}
            tabIndex={-1}
          >
            <p className={styles.modalTitle}>Hapus dari bookmark?</p>
            <p className={styles.modalDesc}>
              Properti <span className={styles.modalHighlight}>“{confirmItem.title}”</span> akan dihapus dari bookmark.
            </p>
            <div className={styles.modalActions}>
              <button className={styles.modalBtn} onClick={closeConfirm} disabled={Boolean(removingId)}>
                Batal
              </button>
              <button
                className={`${styles.modalBtn} ${styles.modalBtnDanger}`}
                onClick={confirmRemove}
                disabled={Boolean(removingId)}
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}