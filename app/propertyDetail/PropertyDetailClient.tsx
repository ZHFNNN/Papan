'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import StartChatButton from '@/components/chat/StartChatButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import styles from './page.module.css';
import { formatPrice } from '@/lib/format-price';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { MAX_REVIEW_PHOTOS, MAX_REVIEW_PHOTO_BYTES } from '@/lib/review-photos';

// ─── Types ────────────────────────────────────────────────────

type PropertyDetail = {
  id: string;
  title: string;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  neighbourhood?: string | null;
  imageUrls?: string[];
  description: string | null;
  price: string;
  listingType: string;
  lat?: number | null;
  lng?: number | null;
  owner?: { id?: string | null; name?: string | null; username?: string | null; image?: string | null };
  facilities: Array<{ code: string; name: string }>;
  createdAt: string;
  discountPercentage?: number | null;
  discountActiveUntil?: string | null;
  isDiscountActive?: boolean;
};

type ReviewPhoto = { id: string; data: string };

type ReviewReply = {
  id: string;
  comment: string;
  createdAt: string;
  owner: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
};

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  photos: ReviewPhoto[];
  replies?: ReviewReply[];
  user: {
    id: string;
    name: string | null;
    username: string | null;
    image: string | null;
  };
};

type ReviewsData = {
  reviews: Review[];
  totalReviews: number;
  avgRating: number;
};

type DisplayProperty = {
  id: string;
  title: string;
  kategori: string;
  price: string;
  originalPrice: string | null;
  discountPercentage: number | null;
  discountActiveUntil: string | null;
  isDiscountActive: boolean;
  biayaHidup: string;
  lokasi: string;
  luas: string;
  lantai: string;
  kt: string;
  km: string;
  fasilitas: string[];
  images: string[];
  description: string;
  lat: number | null;
  lng: number | null;
  ownerName: string;
  ownerId: string | null;
  ownerImage: string | null;
};

type CurrentUser = {
  id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
};

type PropertyDetailClientProps = { propertyId: string };

// ─── Constants ───────────────────────────────────────────────

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1494526585095-c41746248156?w=1200&q=80';
const MAX_PHOTO_UPLOAD = MAX_REVIEW_PHOTOS;

// ─── Helpers ─────────────────────────────────────────────────

function mapApiProperty(data: PropertyDetail): DisplayProperty {
  const lokasi = [data.address, data.neighbourhood, data.district, data.city]
    .filter((v) => Boolean(v && v.trim()))
    .join(', ');

  // Hitung diskon — hanya aktif kalau persentase > 0 dan belum kadaluarsa
  const now = new Date();
  const expiry = data.discountActiveUntil ? new Date(data.discountActiveUntil) : null;
  const discountActive =
    typeof data.discountPercentage === 'number' &&
    data.discountPercentage > 0 &&
    (expiry === null || expiry > now);
  const numericPrice = Number(data.price);
  const finalPrice = discountActive && Number.isFinite(numericPrice)
    ? Math.round(numericPrice * (100 - (data.discountPercentage ?? 0)) / 100)
    : numericPrice;

  return {
    id: data.id,
    title: data.title,
    kategori:
      data.listingType === 'RENT'
        ? 'Properti Sewa'
        : data.listingType === 'SELL'
          ? 'Properti Jual'
          : 'Properti',
    price: formatPrice(String(finalPrice)),
    originalPrice: discountActive ? formatPrice(data.price) : null,
    discountPercentage: discountActive ? (data.discountPercentage ?? null) : null,
    discountActiveUntil: data.discountActiveUntil ?? null,
    isDiscountActive: discountActive,
    biayaHidup: 'Estimasi biaya hidup: -',
    lokasi: lokasi || 'Lokasi belum tersedia',
    luas: '-',
    lantai: '-',
    kt: '-',
    km: '-',
    fasilitas: data.facilities.map((f) => f.name),
    images:
      data.imageUrls && data.imageUrls.length > 0
        ? data.imageUrls
        : [FALLBACK_IMAGE],
    description: data.description ?? 'Tidak ada deskripsi.',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    ownerName:
      data.owner?.name ?? data.owner?.username ?? data.owner?.image ??'Pemilik Properti',
    ownerId: data.owner?.id ?? null,
    ownerImage: data.owner?.image ?? null,
  };
}

function StarRating({
  value,
  onChange,
  size = 20,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = readonly ? value : hovered || value;

  return (
    <div
      className={styles.starRow}
      style={{ gap: size * 0.2 }}
      onMouseLeave={() => !readonly && setHovered(0)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${styles.starBtn} ${display >= star ? styles.starFilled : styles.starEmpty}`}
          style={{ fontSize: size, width: size + 4, height: size + 4 }}
          onClick={() => !readonly && onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          disabled={readonly}
          aria-label={`Beri ${star} bintang`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className={styles.ratingBarRow}>
      <span className={styles.ratingBarLabel}>{label}</span>
      <div className={styles.ratingBarTrack}>
        <div className={styles.ratingBarFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.ratingBarCount}>{count}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Main Component ──────────────────────────────────────────

export default function PropertyDetailClient({ propertyId }: PropertyDetailClientProps) {
  const router = useRouter();

  // Property state
  const [data, setData] = useState<PropertyDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // Review state
  const [reviewsData, setReviewsData] = useState<ReviewsData | null>(null);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [reviewDeleteCandidate, setReviewDeleteCandidate] = useState<{ id: string } | null>(null);
  const [reviewDeleteLoading, setReviewDeleteLoading] = useState(false);
  const [reviewDeleteError, setReviewDeleteError] = useState<string | null>(null);

  // Review form
  const [formRating, setFormRating] = useState(0);
  const [formComment, setFormComment] = useState('');
  const [formPhotos, setFormPhotos] = useState<File[]>([]);
  const [formPreviews, setFormPreviews] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);

  // ── Fetch property ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!propertyId) { setError('ID properti tidak tersedia.'); setIsLoading(false); return; }
      setIsLoading(true); setError(null);
      try {
        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? (res.status === 404 ? 'Properti tidak ditemukan.' : 'Gagal memuat detail properti.'));
        if (!cancelled) { setData(json.data as PropertyDetail); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [propertyId]);

  // ── Fetch bookmark ──────────────────────────────────────────
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/bookmarks/${encodeURIComponent(propertyId)}`);
        if (res.status === 401 || !res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setBookmarked(Boolean(json.isBookmarked));
      } catch { /* silent */ }
    };
    check();
    return () => { cancelled = true; };
  }, [propertyId]);

  // ── Fetch reviews ───────────────────────────────────────────
  const fetchReviews = async () => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/reviews`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setReviewsData(json.data as ReviewsData);
    } catch { /* silent */ } finally {
      setReviewsLoading(false);
    }
  };

  useEffect(() => {
    if (propertyId) fetchReviews();
  }, [propertyId]);

  useEffect(() => {
    let cancelled = false;

    const loadMe = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json?.user?.id) {
          setCurrentUser(json.user as CurrentUser);
        }
      } catch {
        // ignore
      }
    };

    loadMe();
    return () => { cancelled = true; };
  }, []);

  // ── Derived ─────────────────────────────────────────────────
  const prop = useMemo<DisplayProperty | null>(() => (data ? mapApiProperty(data) : null), [data]);

  const isOwner = Boolean(currentUser?.id && prop?.ownerId && currentUser.id === prop.ownerId);

  useEffect(() => { setActiveImage(0); setDescExpanded(false); }, [prop?.id]);

  // ── Handlers ────────────────────────────────────────────────
  const handleShare = async () => {
    if (!prop) return;
    try {
      if (navigator.share) await navigator.share({ title: prop.title, url: window.location.href });
      else throw new Error('no share api');
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link berhasil disalin!');
    }
  };

  const handleBookmark = async () => {
    if (bookmarkLoading || !propertyId) return;
    setBookmarkLoading(true);
    try {
      if (bookmarked) {
        const res = await fetch(`/api/bookmarks/${encodeURIComponent(propertyId)}`, { method: 'DELETE', credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) { toast.error(json.message ?? 'Gagal menghapus bookmark.'); return; }
        setBookmarked(false);
        toast.success('Dihapus dari bookmark.');
      } else {
        const res = await fetch('/api/bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId }), credentials: 'include' });
        const json = await res.json().catch(() => ({}));
        if (res.status === 401) { router.push('/login'); return; }
        if (!res.ok) { toast.error(json.message ?? 'Gagal menyimpan bookmark.'); return; }
        setBookmarked(true);
        toast.success('Disimpan ke bookmark.');
      }
    } catch { toast.error('Terjadi kesalahan saat memperbarui bookmark.'); }
    finally { setBookmarkLoading(false); }
  };

  // ── Review photo pick ────────────────────────────────────────
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    const files = picked.filter((f) => f.type.startsWith('image/') && f.size <= MAX_REVIEW_PHOTO_BYTES);
    if (files.length < picked.length) toast.error('Foto harus berupa gambar, maksimal 5 MB per foto.');
    const remaining = MAX_PHOTO_UPLOAD - formPhotos.length;
    const added = files.slice(0, remaining);
    setFormPhotos((prev) => [...prev, ...added]);
    const previews = added.map((f) => URL.createObjectURL(f));
    setFormPreviews((prev) => [...prev, ...previews]);
    e.target.value = '';
  };

  const removePhoto = (idx: number) => {
    URL.revokeObjectURL(formPreviews[idx]);
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
    setFormPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Review submit ────────────────────────────────────────────
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formRating === 0) { setFormError('Pilih rating bintang terlebih dahulu.'); return; }
    setFormSubmitting(true); setFormError(null);

    try {
      // Upload foto ke Cloudinary satu per satu, ulasan cukup menyimpan URL-nya
      const photoUrls: string[] = await Promise.all(
        formPhotos.map(async (file) => {
          const fd = new FormData();
          fd.append('file', file);
          const uploadRes = await fetch('/api/uploads/review', { method: 'POST', body: fd, credentials: 'include' });
          const uploadJson = await uploadRes.json().catch(() => ({}));
          if (uploadRes.status === 401) throw new Error('Silakan login terlebih dahulu.');
          if (!uploadRes.ok || !uploadJson.data?.url) {
            throw new Error(uploadJson.message ?? `Gagal mengunggah foto ${file.name}`);
          }
          return uploadJson.data.url as string;
        })
      );

      const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          rating: formRating,
          comment: formComment.trim() || undefined,
          photos: photoUrls,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 409) { setFormError('Kamu sudah pernah memberikan review untuk properti ini.'); return; }
      if (!res.ok) { setFormError(json.message ?? 'Gagal mengirim review.'); return; }

      // Reset form
      setFormRating(0); setFormComment('');
      formPreviews.forEach((u) => URL.revokeObjectURL(u));
      setFormPhotos([]); setFormPreviews([]);
      setFormSuccess(true);
      await fetchReviews();
      setTimeout(() => setFormSuccess(false), 4000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Delete own review ────────────────────────────────────────
  const openDeleteReviewModal = (reviewId: string) => {
    setReviewDeleteCandidate({ id: reviewId });
    setReviewDeleteError(null);
  };

  const closeDeleteReviewModal = () => {
    if (reviewDeleteLoading) return;
    setReviewDeleteCandidate(null);
    setReviewDeleteError(null);
  };

  const confirmDeleteReview = async () => {
    if (!reviewDeleteCandidate) return;
    setReviewDeleteLoading(true);
    setReviewDeleteError(null);
    try {
      const res = await fetch(
        `/api/properties/${encodeURIComponent(propertyId)}/reviews/${reviewDeleteCandidate.id}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { setReviewDeleteError('Gagal menghapus review.'); return; }
      setReviewDeleteCandidate(null);
      await fetchReviews();
    } catch {
      setReviewDeleteError('Terjadi kesalahan.');
    } finally {
      setReviewDeleteLoading(false);
    }
  };

  // ── Rating distribution ──────────────────────────────────────
  const ratingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    reviewsData?.reviews.forEach((r) => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist.reverse(); // [5★, 4★, 3★, 2★, 1★]
  }, [reviewsData]);

  const handleReplyChange = (reviewId: string, value: string) => {
    setReplyDrafts((prev) => ({ ...prev, [reviewId]: value }));
  };

  const handleReplySubmit = async (reviewId: string) => {
    const comment = (replyDrafts[reviewId] ?? '').trim();
    if (!comment) return;
    setReplySubmitting(reviewId);

    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ comment }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push('/login'); return; }
      if (!res.ok) { toast.error(json.message ?? 'Gagal mengirim balasan.'); return; }

      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      await fetchReviews();
      toast.success('Balasan berhasil dikirim.');
    } catch {
      toast.error('Terjadi kesalahan saat mengirim balasan.');
    } finally {
      setReplySubmitting(null);
    }
  };

  // ── Render guards ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Memuat properti…</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!prop) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.loadingWrapper}>
          <p className={styles.loadingText}>{error ?? 'Properti tidak ditemukan.'}</p>
          <button className={styles.backBtn} onClick={() => router.push('/')}>← Kembali ke Home</button>
        </div>
        <Footer />
      </div>
    );
  }

  const SHORT = 220;
  const deskripsi = prop.description;
  const displayDesc = descExpanded || deskripsi.length <= SHORT ? deskripsi : `${deskripsi.slice(0, SHORT)}…`;
  const activeImageSrc = prop.images[activeImage] ?? prop.images[0];
  const mapQuery = prop.lat && prop.lng ? `${prop.lat},${prop.lng}` : encodeURIComponent(prop.lokasi);
  const mapZoom = prop.lat && prop.lng ? 15 : 12;
  const mapSrc = `https://maps.google.com/maps?q=${mapQuery}&z=${mapZoom}&output=embed`;

  const totalReviews = reviewsData?.totalReviews ?? 0;
  const avgRating = reviewsData?.avgRating ?? 0;
  const reviews = reviewsData?.reviews ?? [];

  return (
    <div className={styles.page}>
      <Navbar />

      {/* ── Lightbox ── */}
      {lightboxSrc && (
        <div className={styles.lightboxOverlay} onClick={() => setLightboxSrc(null)}>
          <button className={styles.lightboxClose} onClick={() => setLightboxSrc(null)}>✕</button>
          <img src={optimizeImage(lightboxSrc, IMAGE_WIDTH.detail)} alt="Review foto" className={styles.lightboxImg} onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <ConfirmDialog
        open={Boolean(reviewDeleteCandidate)}
        title="Hapus review?"
        description="Review kamu akan dihapus dan tidak bisa dikembalikan."
        confirmText="Hapus"
        cancelText="Batal"
        loading={reviewDeleteLoading}
        errorText={reviewDeleteError}
        onCancel={closeDeleteReviewModal}
        onConfirm={confirmDeleteReview}
      />

      <div className={styles.contentArea}>
        <div className={styles.container}>
          <button className={styles.backBtn} onClick={() => router.back()}>← Kembali</button>

          {/* ── Top: Gallery + Price Card ── */}
          <div className={styles.topSection}>
            <div className={styles.galleryWrapper}>
              <div className={styles.mainImage}>
                <img src={optimizeImage(activeImageSrc, IMAGE_WIDTH.detail)} alt={prop.title} decoding="async" fetchPriority="high" />
              </div>
              <div className={styles.thumbnailColumn}>
                {prop.images.map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className={`${styles.thumbnail} ${activeImage === i ? styles.thumbnailActive : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={optimizeImage(src, IMAGE_WIDTH.thumb * 2)} alt={`Foto ${i + 1}`} loading="lazy" decoding="async" />
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.priceCard}>
              <p className={styles.priceLabel}>Harga</p>
              {prop.isDiscountActive && prop.originalPrice ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 6 }}>
                  <span style={{ display: 'inline-block', background: '#ef4444', color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 999, width: 'fit-content' }}>
                    PROMO -{prop.discountPercentage}%
                  </span>
                  <p style={{ textDecoration: 'line-through', color: '#888', fontSize: 14, margin: 0 }}>
                    {prop.originalPrice}
                  </p>
                  <p className={styles.priceValue} style={{ color: '#dc2626' }}>{prop.price}</p>
                  {prop.discountActiveUntil && (
                    <p style={{ fontSize: 11, color: '#666', margin: 0 }}>
                      Berlaku sampai {new Date(prop.discountActiveUntil).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              ) : (
                <p className={styles.priceValue}>{prop.price}</p>
              )}
              <p className={styles.priceEstimate}>{prop.biayaHidup}</p>

          {prop.ownerId ? (
            <StartChatButton propertyId={prop.id} ownerId={prop.ownerId} variant="light" />
          ) : null}

              <button
                className={`${styles.btnOutline} ${bookmarked ? styles.btnOutlineActive : ''}`}
                onClick={handleBookmark}
                disabled={bookmarkLoading}
              >
                {bookmarkLoading ? '…' : bookmarked ? '✓ Hapus dari Simpanan' : 'Simpan'}
              </button>
              <button className={styles.btnOutline} onClick={handleShare}>Bagikan</button>
              <hr className={styles.divider} />
              <div className={styles.agentRow}>
                <div className={styles.agentAvatar}>
                  {prop.ownerImage ? (
                    <img
                      src={optimizeImage(prop.ownerImage, IMAGE_WIDTH.thumb)}
                      alt={prop.ownerName}
                      loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                    />
                  ) : (
                    <span>👤</span>
                  )}
                </div>
                <div className={styles.agentInfo}>
                  <p className={styles.agentName}>{prop.ownerName}</p>
                  <p className={styles.agentRole}>Pemilik Properti</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Property Info ── */}
          <h1 className={styles.propertyTitle}>{prop.title}</h1>
          <div className={styles.lokasi}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor" />
            </svg>
            <span>{prop.lokasi}</span>
          </div>

          <div className={styles.chipsRow}>
            {prop.luas !== '-' && <span className={styles.chip}>Luas {prop.luas}</span>}
            {prop.km !== '-' && <span className={styles.chip}>{prop.km} Kamar Mandi</span>}
            {prop.kt !== '-' && <span className={styles.chip}>{prop.kt} Kamar Tidur</span>}
            {prop.fasilitas.map((f) => <span key={f} className={styles.chip}>{f}</span>)}
            {prop.lantai !== '-' && <span className={styles.chip}>{prop.lantai}</span>}
          </div>

          <h2 className={styles.sectionTitle}>Deskripsi</h2>
          <p className={styles.descText}>{displayDesc}</p>
          {deskripsi.length > SHORT && (
            <button className={styles.readMoreBtn} onClick={() => setDescExpanded((p) => !p)}>
              {descExpanded ? 'Tampilkan lebih sedikit' : 'Baca selengkapnya'}
            </button>
          )}

          <div className={styles.mapSection}>
            <h2 className={styles.sectionTitle}>Lokasi</h2>
            <iframe title="Lokasi properti" src={mapSrc} className={styles.mapFrame} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>

          {/* REVIEW SECTION */}
          <div className={styles.reviewSection} id="reviews">
            <div className={styles.reviewSectionHeader}>
              <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Ulasan</h2>
              {totalReviews > 0 && (
                <span className={styles.reviewCount}>{totalReviews} ulasan</span>
              )}
            </div>

            {/* ── Rating Summary ── */}
            {totalReviews > 0 && (
              <div className={styles.ratingSummary}>
                <div className={styles.ratingBig}>
                  <span className={styles.ratingBigNum}>{avgRating.toFixed(1)}</span>
                  <StarRating value={Math.round(avgRating)} size={18} readonly />
                  <span className={styles.ratingBigSub}>{totalReviews} ulasan</span>
                </div>
                <div className={styles.ratingBars}>
                  {[5, 4, 3, 2, 1].map((star, idx) => (
                    <RatingBar key={star} label={`${star}★`} count={ratingDist[idx]} total={totalReviews} />
                  ))}
                </div>
              </div>
            )}

            {/* ── Review Form ── */}
            {isOwner ? (
              <div className={styles.ownerNotice}>
                Balas review dari pembeli/penyewa yang ada.
              </div>
            ) : (
              <div className={styles.reviewFormCard}>
                <p className={styles.reviewFormTitle}>Tulis Ulasanmu</p>
                <form onSubmit={handleReviewSubmit}>
                <div className={styles.reviewFormRatingRow}>
                  <span className={styles.reviewFormLabel}>Rating</span>
                  <StarRating value={formRating} onChange={setFormRating} size={26} />
                  {formRating > 0 && (
                    <span className={styles.ratingHint}>
                      {['', 'Sangat Buruk', 'Buruk', 'Cukup', 'Bagus', 'Sangat Bagus'][formRating]}
                    </span>
                  )}
                </div>

                <textarea
                  className={styles.reviewTextarea}
                  placeholder="Ceritakan pengalamanmu tentang properti ini… (opsional)"
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  maxLength={1000}
                  rows={4}
                />
                <div className={styles.textareaCount}>{formComment.length}/1000</div>

                {/* Photo upload */}
                <div className={styles.photoUploadRow}>
                  {formPreviews.map((src, idx) => (
                    <div key={idx} className={styles.photoPreviewItem}>
                      <img src={src} alt={`preview ${idx}`} className={styles.photoPreviewImg} />
                      <button type="button" className={styles.photoRemoveBtn} onClick={() => removePhoto(idx)}>✕</button>
                    </div>
                  ))}
                  {formPhotos.length < MAX_PHOTO_UPLOAD && (
                    <button
                      type="button"
                      className={styles.photoAddBtn}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <span className={styles.photoAddIcon}>📷</span>
                      <span className={styles.photoAddText}>Tambah Foto</span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handlePhotoChange}
                  />
                </div>
                {formPhotos.length > 0 && (
                  <p className={styles.photoHint}>{formPhotos.length}/{MAX_PHOTO_UPLOAD} foto dipilih</p>
                )}

                {formError && <p className={styles.formError}>{formError}</p>}
                {formSuccess && <p className={styles.formSuccess}>✓ Ulasan berhasil dikirim!</p>}

                  <button
                    type="submit"
                    className={styles.reviewSubmitBtn}
                    disabled={formSubmitting || formRating === 0}
                  >
                    {formSubmitting ? 'Mengirim…' : 'Kirim Ulasan'}
                  </button>
                </form>
              </div>
            )}

            {/* ── Review List ── */}
            {reviewsLoading && (
              <div className={styles.reviewsLoadingRow}>
                <div className={styles.spinnerSmall} />
                <span>Memuat ulasan…</span>
              </div>
            )}

            {!reviewsLoading && reviews.length === 0 && (
              <div className={styles.emptyReviews}>            
                <p className={styles.emptyReviewsText}>Belum ada ulasan untuk properti ini.</p>
                <p className={styles.emptyReviewsSub}>Jadilah yang pertama memberikan ulasan!</p>
              </div>
            )}

            <div className={styles.reviewList}>
              {reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewCardHeader}>
                    <div className={styles.reviewAvatar}>
                      {review.user.image
                        ? <img src={optimizeImage(review.user.image, IMAGE_WIDTH.thumb)} alt={review.user.name ?? ''} loading="lazy" decoding="async" />
                        : <span>{(review.user.name ?? review.user.username ?? '?').charAt(0).toUpperCase()}</span>
                      }
                    </div>
                    <div className={styles.reviewMeta}>
                      <span className={styles.reviewAuthor}>
                        {review.user.name ?? review.user.username ?? 'Pengguna'}
                      </span>
                      <span className={styles.reviewDate}>{formatDate(review.createdAt)}</span>
                    </div>
                    <div className={styles.reviewCardRight}>
                      <StarRating value={review.rating} size={14} readonly />
                      {currentUser?.id === review.user.id && (
                        <button
                          type="button"
                          className={styles.reviewDeleteBtn}
                          onClick={() => openDeleteReviewModal(review.id)}
                          title="Hapus ulasan"
                        >
                          Hapus review
                        </button>
                      )}
                    </div>
                  </div>

                  {review.comment && (
                    <p className={styles.reviewComment}>{review.comment}</p>
                  )}

                  {review.photos.length > 0 && (
                    <div className={styles.reviewPhotos}>
                      {review.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className={styles.reviewPhotoThumb}
                          onClick={() => setLightboxSrc(photo.data)}
                        >
                          <img src={optimizeImage(photo.data, IMAGE_WIDTH.thumb)} alt="Foto ulasan" loading="lazy" decoding="async" />
                        </div>
                      ))}
                    </div>
                  )}

                  {review.replies && review.replies.length > 0 && (
                    <div className={styles.reviewReplies}>
                      {review.replies.map((reply) => (
                        <div key={reply.id} className={styles.reviewReplyItem}>
                          <div className={styles.reviewReplyHeader}>
                            <span className={styles.reviewReplyAuthor}>
                              {reply.owner.name ?? reply.owner.username ?? 'Owner'}
                            </span>
                            <span className={styles.ownerBadge}>Owner</span>
                            <span className={styles.reviewReplyDate}>{formatDate(reply.createdAt)}</span>
                          </div>
                          <p className={styles.reviewReplyText}>{reply.comment}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {isOwner && (
                    <div className={styles.reviewReplyForm}>
                      <input
                        className={styles.reviewReplyInput}
                        placeholder="Tulis balasan untuk review ini..."
                        value={replyDrafts[review.id] ?? ''}
                        onChange={(e) => handleReplyChange(review.id, e.target.value)}
                      />
                      <button
                        className={styles.reviewReplyBtn}
                        onClick={() => handleReplySubmit(review.id)}
                        disabled={replySubmitting === review.id || !(replyDrafts[review.id] ?? '').trim()}
                      >
                        {replySubmitting === review.id ? 'Mengirim...' : 'Balas'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}