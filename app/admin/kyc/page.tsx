'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { signOut } from 'next-auth/react';

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface Submission {
  id: string;
  nik: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  cityOrRegency: string;
  district: string;
  rt: string;
  rw: string;
  postalCode: string;
  ktpImageUrl: string;
  selfieImageUrl: string;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  status: KycStatus;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
  };
}

type FilterStatus = 'ALL' | KycStatus;

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(iso));
}

const STATUS_LABEL: Record<KycStatus, string> = {
  PENDING: 'Menunggu',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
};

// ─── Modal Detail ─────────────────────────────────────────────────────────────

interface ModalProps {
  submission: Submission;
  onClose: () => void;
  onReview: (id: string, action: 'APPROVED' | 'REJECTED', notes: string) => Promise<void>;
  reviewing: boolean;
}

function DetailModal({ submission, onClose, onReview, reviewing }: ModalProps) {
  const [notes, setNotes] = useState('');
  const [activeImg, setActiveImg] = useState<'ktp' | 'selfie' | null>(null);

  const isPending = submission.status === 'PENDING';

  return (
    <>
      {/* Image lightbox */}
      {activeImg && (
        <div className={styles.lightbox} onClick={() => setActiveImg(null)}>
          <img
            src={activeImg === 'ktp' ? submission.ktpImageUrl : submission.selfieImageUrl}
            alt={activeImg}
            className={styles.lightboxImg}
            onClick={(e) => e.stopPropagation()}
          />
          <button className={styles.lightboxClose} onClick={() => setActiveImg(null)}>✕</button>
        </div>
      )}

      <div className={styles.modalOverlay} onClick={onClose}>
        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className={styles.modalHeader}>
            <div>
              <h2 className={styles.modalTitle}>{submission.fullName}</h2>
              <p className={styles.modalSub}>@{submission.user.username} · {submission.user.email}</p>
            </div>
            <button className={styles.closeBtn} onClick={onClose}>✕</button>
          </div>

          {/* Status banner jika sudah diproses */}
          {!isPending && (
            <div className={`${styles.reviewedBanner} ${submission.status === 'APPROVED' ? styles.approvedBanner : styles.rejectedBanner}`}>
              {submission.status === 'APPROVED' ? '✓ Disetujui' : '✕ Ditolak'}
              {submission.reviewedBy && ` oleh ${submission.reviewedBy}`}
              {submission.reviewedAt && ` · ${formatDate(submission.reviewedAt)}`}
              {submission.adminNotes && (
                <p className={styles.bannerNotes}>Catatan: {submission.adminNotes}</p>
              )}
            </div>
          )}

          <div className={styles.modalBody}>
            {/* Foto */}
            <div className={styles.photoRow}>
              <div className={styles.photoBox}>
                <span className={styles.photoLabel}>Foto KTP</span>
                <img
                  src={optimizeImage(submission.ktpImageUrl, IMAGE_WIDTH.card)}
                  alt="KTP"
                  loading="lazy"
                  decoding="async"
                  className={styles.photoThumb}
                  onClick={() => setActiveImg('ktp')}
                />
              </div>
              <div className={styles.photoBox}>
                <span className={styles.photoLabel}>Selfie + KTP</span>
                <img
                  src={optimizeImage(submission.selfieImageUrl, IMAGE_WIDTH.card)}
                  alt="Selfie"
                  loading="lazy"
                  decoding="async"
                  className={styles.photoThumb}
                  onClick={() => setActiveImg('selfie')}
                />
              </div>
            </div>

            {/* Data diri */}
            <div className={styles.dataGrid}>
              {[
                { label: 'NIK', value: submission.nik },
                { label: 'Nama Lengkap', value: submission.fullName },
                { label: 'Nomor HP', value: submission.phoneNumber },
                { label: 'Provinsi', value: submission.province },
                { label: 'Kota/Kabupaten', value: submission.cityOrRegency },
                { label: 'Kecamatan', value: submission.district },
                { label: 'RT', value: submission.rt },
                { label: 'RW', value: submission.rw },
                { label: 'Kode Pos', value: submission.postalCode },
                { label: 'Tanggal Pengajuan', value: formatDate(submission.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className={styles.dataField}>
                  <span className={styles.dataKey}>{label}</span>
                  <span className={styles.dataVal}>{value}</span>
                </div>
              ))}
            </div>

            {/* Aksi approve/reject — hanya jika PENDING */}
            {isPending && (
              <div className={styles.actionSection}>
                <div className={styles.notesGroup}>
                  <label className={styles.notesLabel}>
                    Catatan Admin <span className={styles.notesHint}>(wajib diisi jika menolak)</span>
                  </label>
                  <textarea
                    className={styles.notesInput}
                    placeholder="Tulis catatan untuk pengguna..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    disabled={reviewing}
                  />
                </div>

                <div className={styles.actionBtns}>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => void onReview(submission.id, 'REJECTED', notes)}
                    disabled={reviewing}
                  >
                    {reviewing ? 'Memproses...' : '✕ Tolak'}
                  </button>
                  <button
                    className={styles.approveBtn}
                    onClick={() => void onReview(submission.id, 'APPROVED', notes)}
                    disabled={reviewing}
                  >
                    {reviewing ? 'Memproses...' : '✓ Setujui'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminKycPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('ALL');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [search, setSearch] = useState('');
  const [hasMounted, setHasMounted] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/kyc');
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { router.push('/'); return; }
      const data = await res.json() as Submission[];
      setSubmissions(data);
    } catch {
      toast.error('Gagal memuat data pengajuan.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    setHasMounted(true);
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const handleReview = async (id: string, action: 'APPROVED' | 'REJECTED', notes: string) => {
    if (action === 'REJECTED' && !notes.trim()) {
      toast.error('Catatan wajib diisi jika menolak pengajuan.');
      return;
    }

    setReviewing(true);
    try {
      const endpoint = action === 'APPROVED'
        ? `/api/admin/kyc/${id}/approve`
        : `/api/admin/kyc/${id}/reject`;

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'REJECTED'
          ? JSON.stringify({ reason: notes })
          : undefined,
      });
      const data = await res.json() as { message: string };
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setSelected(null);
      await fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memproses.');
    } finally {
      setReviewing(false);
    }
  };

  const filtered = submissions.filter((s) => {
    if (filter !== 'ALL' && s.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.user.email.toLowerCase().includes(q) ||
      s.nik.includes(q) ||
      s.user.username.toLowerCase().includes(q) ||
      s.phoneNumber.toLowerCase().includes(q)
    );
  });

  const filters: { label: string; value: FilterStatus }[] = [
    { label: 'Pending', value: 'PENDING' },
    { label: 'Semua', value: 'ALL' },
    { label: 'Disetujui', value: 'APPROVED' },
    { label: 'Ditolak', value: 'REJECTED' },
  ];

  if (!hasMounted) {
    return (
      <div className={styles.loadingState}>
        <p>Memuat...</p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {selected && (
        <DetailModal
          submission={selected}
          onClose={() => setSelected(null)}
          onReview={handleReview}
          reviewing={reviewing}
        />
      )}

      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🏠</span>
          <span className={styles.brandName}>PAPAN Admin</span>
        </div>

        <nav className={styles.nav}>
          <button className={`${styles.navItem} ${styles.navItemActive}`}>
            <span>📋</span> Verifikasi KYC
          </button>
          <button className={styles.navItem} onClick={() => router.push('/admin/notifications')}>
            <span>🔔</span> Kirim Notifikasi
          </button>
          <button className={styles.navItem} onClick={() => router.push('/admin/chat')}>
            <span>💬</span> Monitoring Chat
          </button>
        </nav>

        <button className={styles.sidebarLogout} onClick={() => signOut({ callbackUrl: '/login' })}>
          Log Out
        </button>
      </aside>

      {/* Main */}
      <main className={styles.main}>
        <div className={styles.topbar}>
          <h1 className={styles.pageTitle}>Verifikasi KYC</h1>
          <input
            className={styles.searchInput}
            placeholder="Cari nama, email, username, NIK, no HP..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          {[
            { label: 'Total Pengajuan', value: submissions.length, valueClass: styles.statNumTotal },
            { label: 'Menunggu', value: submissions.filter(s => s.status === 'PENDING').length, valueClass: styles.statNumPending },
            { label: 'Disetujui', value: submissions.filter(s => s.status === 'APPROVED').length, valueClass: styles.statNumApproved },
            { label: 'Ditolak', value: submissions.filter(s => s.status === 'REJECTED').length, valueClass: styles.statNumRejected },
          ].map(({ label, value, valueClass }) => (
            <div key={label} className={styles.statCard}>
              <span className={`${styles.statNum} ${valueClass}`}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className={styles.filterRow}>
          {filters.map(({ label, value }) => (
            <button
              key={value}
              className={`${styles.filterTab} ${filter === value ? styles.filterTabActive : ''}`}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className={styles.tableWrapper}>
          {loading ? (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <p>Memuat data...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <p>Tidak ada pengajuan {filter !== 'ALL' ? STATUS_LABEL[filter as KycStatus] : ''} ditemukan.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Nama</th>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th}>NIK</th>
                  <th className={styles.th}>Tanggal</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className={styles.tr}>
                    <td className={styles.td}>
                      <div className={styles.nameCell}>
                        <span className={styles.nameText}>{s.fullName}</span>
                        <span className={styles.usernameText}>@{s.user.username}</span>
                      </div>
                    </td>
                    <td className={styles.td}>{s.user.email}</td>
                    <td className={styles.td}><code className={styles.nik}>{s.nik}</code></td>
                    <td className={styles.td} suppressHydrationWarning>
                      {formatDate(s.createdAt)}
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${styles[`badge${s.status}`]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className={styles.td}>
                      <button
                        className={styles.detailBtn}
                        onClick={() => setSelected(s)}
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}