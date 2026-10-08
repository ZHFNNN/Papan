'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { formatPrice } from '../../../lib/format-price';
import ConfirmDialog from '@/components/ConfirmDialog';

type ActiveBoost = {
  id: string;
  packageId: string;
  packageTitle: string;
  days: number;
  price: number;
  startDate: string;
  endDate: string;
  remainingDays: number;
  remainingTimeMs?: number;
};

type Property = {
  id: string;
  title: string;
  description: string | null;
  price: string;
  listingType: string;
  address?: string;
  imageUrls?: string[];
  bookmarkCount?: number;
  status?: string;
  createdAt: string;
  isBoosted?: boolean;
  activeBoost?: ActiveBoost | null;
  discountPercentage?: number | null;
  discountActiveUntil?: string | null;
  isDiscountActive?: boolean;
};

type DashboardStats = {
  totalProperties: number;
  activeProperties: number;
  rentedRooms: number;
  soldProperties: number;
  totalRevenue: number;
};

type DashboardData = {
  stats: DashboardStats;
  properties: Property[];
};

const LISTING_TYPE_LABEL: Record<string, string> = {
  JUAL: 'Dijual',
  SEWA: 'Disewa',
  KOSAN: 'Kosan',
};

const STATUS_COLOR: Record<string, string> = {
  Aktif: styles.statusAktif,
  Nonaktif: styles.statusNonaktif,
  Terjual: styles.statusTerjual,
};

function formatCountdown(targetDate: string, nowMs: number) {
  const remainingMs = new Date(targetDate).getTime() - nowMs;

  if (remainingMs <= 0) {
    return '0 detik';
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days} hari ${hours} jam`;
  }

  if (hours > 0) {
    return `${hours} jam ${minutes} menit`;
  }

  if (minutes > 0) {
    return `${minutes} menit ${seconds} detik`;
  }

  return `${seconds} detik`;
}

function StatCard({ title, value }: { title: string; value: string | number }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statTitle}>{title}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  );
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; title: string } | null>(null);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/owner/dashboard');
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Gagal memuat dashboard.');
      }
      const json: DashboardData = await res.json();
      setData(json);
    } catch (err) {
      setError('Tidak dapat memuat data dashboard. Coba lagi nanti.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const openDeleteModal = (property: Property) => {
    setDeleteCandidate({ id: property.id, title: property.title });
    setDeleteModalError(null);
  };

  const closeDeleteModal = () => {
    if (deletingId) return;
    setDeleteCandidate(null);
    setDeleteModalError(null);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const confirmDelete = async () => {
    if (!deleteCandidate) return;

    setDeletingId(deleteCandidate.id);
    setDeleteModalError(null);

    try {
      const res = await fetch(`/api/owner/properties/${deleteCandidate.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus properti.');
      setDeleteCandidate(null);
      await fetchDashboard();
    } catch (err) {
      setDeleteModalError('Gagal menghapus properti. Coba lagi.');
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };


  return (
    <div className={styles.contentArea}>
        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Dashboard</h1>
            <p className={styles.pageSubtitle}>Hai! Yuk cek properti-properti kamu!</p>
          </div>
        </div>

        {isLoading ? (
          <div className={styles.skeletonWrap} aria-hidden>
            <div className={styles.skeletonStats}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={`stat-skeleton-${i}`} className={`${styles.skeletonCard} ${styles.skeletonShimmer}`} />
              ))}
            </div>

            <div className={styles.skeletonSectionHeader}>
              <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.lg} ${styles.w40}`} />
              <div className={`${styles.skeletonPill} ${styles.skeletonShimmer}`} />
            </div>

            <div className={styles.skeletonList}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={`list-skeleton-${i}`} className={styles.skeletonPropertyCard}>
                  <div className={`${styles.skeletonThumb} ${styles.skeletonShimmer}`} />
                  <div className={styles.skeletonInfo}>
                    <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.lg} ${styles.w70}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.md} ${styles.w60}`} />
                    <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.w40}`} />
                  </div>
                  <div className={styles.skeletonActions}>
                    <div className={`${styles.skeletonBtn} ${styles.skeletonShimmer}`} />
                    <div className={`${styles.skeletonBtn} ${styles.skeletonShimmer}`} />
                    <div className={`${styles.skeletonBtn} ${styles.skeletonShimmer}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button onClick={() => { setIsLoading(true); setError(null); fetchDashboard(); }} className={styles.retryBtn}>
              Coba Lagi
            </button>
          </div>
        ) : data ? (
          <>
            {/* ── Stats ── */}
            <div className={styles.statsGrid}>
              <StatCard title="Total Properti" value={data.stats.totalProperties} />
              <StatCard title="Properti Aktif" value={data.stats.activeProperties} />
              <StatCard title="Kamar Kosan Tersewa" value={data.stats.rentedRooms} />
              <StatCard title="Properti Terjual" value={data.stats.soldProperties} />
              <StatCard title="Total Pendapatan" value={formatPrice(data.stats.totalRevenue)} />
            </div>

            {/* ── Properties List ── */}
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Properti Saya</h2>
              <span className={styles.propertyCount}>{data.properties.length} Properti</span>
            </div>

            {data.properties.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏠</div>
                <p className={styles.emptyTitle}>Belum Ada Properti</p>
                <p className={styles.emptyDesc}>Mulai tambahkan properti pertamamu sekarang.</p>
                <button
                  className={styles.emptyAddBtn}
                  onClick={() => router.push('/owner/addProperty')}
                >
                  + Tambah Properti
                </button>
              </div>
            ) : (
              <div className={styles.propertyList}>
                {data.properties.map((property) => (
                  <div key={property.id} className={styles.propertyCard}>
                    {/* Thumbnail placeholder */}
                    <div className={styles.propertyThumb}>
                      {Array.isArray(property.imageUrls) && property.imageUrls.length > 0 ? (
                        <img
                          src={optimizeImage(property.imageUrls[0], IMAGE_WIDTH.thumb * 2)}
                          alt={property.title}
                          className={styles.thumbImg}
                          loading="lazy" decoding="async"
                        />
                      ) : (
                        <div className={styles.thumbPlaceholder}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            <polyline points="9 22 9 12 15 12 15 22"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className={styles.propertyInfo}>
                      <div className={styles.propertyTopRow}>
                        <h3 className={styles.propertyTitle}>{property.title}</h3>
                        <div className={styles.propertyBadges}>
                          <span className={styles.listingBadge}>
                            {LISTING_TYPE_LABEL[property.listingType] ?? property.listingType}
                          </span>
                          {property.activeBoost && (
                            <span className={styles.boosterBadge}>Booster</span>
                          )}
                          {property.isDiscountActive && property.discountPercentage && (
                            <span className={styles.promoBadge}>Promo -{property.discountPercentage}%</span>
                          )}
                          <span className={`${styles.statusBadge} ${STATUS_COLOR[property.status ?? 'Aktif'] ?? styles.statusAktif}`}>
                            {property.status ?? 'Aktif'}
                          </span>
                        </div>
                      </div>
                      {property.isDiscountActive && property.discountPercentage ? (
                        <div className={styles.promoPriceRow}>
                          <p className={styles.promoOriginalPrice}>{formatPrice(property.price)}</p>
                          <p className={`${styles.propertyPrice} ${styles.promoNewPrice}`}>
                            {formatPrice(
                              String(
                                Math.round(
                                  Number(property.price) * (100 - property.discountPercentage) / 100
                                )
                              )
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className={styles.propertyPrice}>{formatPrice(property.price)}</p>
                      )}
                      {property.activeBoost && (
                        <div className={styles.boosterInfo}>
                          <p className={styles.boosterTitle}>Booster aktif</p>
                          <p className={styles.boosterCountdown}>
                            Sisa booster: {formatCountdown(property.activeBoost.endDate, now)}
                          </p>
                        </div>
                      )}
                      {property.isDiscountActive && (
                        <div className={styles.promoInfo}>
                          <p className={styles.promoTitle}>Promo aktif -{property.discountPercentage}%</p>
                          <p className={styles.promoCountdown}>
                            {property.discountActiveUntil
                              ? `Berlaku sampai ${new Date(property.discountActiveUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
                              : 'Berlaku tanpa batas waktu'}
                          </p>
                        </div>
                      )}
                      {property.address && (
                        <p className={styles.propertyAddress}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          {property.address}
                        </p>
                      )}
                      <p className={styles.propertyViews}>
                        {property.bookmarkCount ?? 0} pencari properti menyimpan properti kamu
                      </p>
                    </div>

                    {/* Actions */}
                    <div className={styles.propertyActions}>
                      <button
                        className={styles.boostBtn}
                        onClick={() => router.push(`/propertyDetail/${property.id}#reviews`)}
                      >
                        Review
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => router.push(`/owner/properties/${property.id}/edit`)}
                      >
                        Edit
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => openDeleteModal(property)}
                        disabled={deletingId === property.id}
                      >
                        {deletingId === property.id ? '...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <ConfirmDialog
              open={Boolean(deleteCandidate)}
              title="Hapus properti?"
              description={
                deleteCandidate
                  ? `Properti “${deleteCandidate.title}” akan dihapus dari daftar kamu.`
                  : 'Properti ini akan dihapus dari daftar kamu.'
              }
              confirmText="Hapus"
              cancelText="Batal"
              loading={Boolean(deletingId)}
              errorText={deleteModalError}
              onCancel={closeDeleteModal}
              onConfirm={confirmDelete}
            />
          </>
        ) : null}
    </div>
  );
}