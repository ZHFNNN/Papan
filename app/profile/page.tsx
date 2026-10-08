'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';

const DEFAULT_AVATAR = '/images/ppdefault.png';

type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

type UserProfile = {
  id: string;
  name: string;
  username: string;
  email: string;
  image?: string | null;
  phoneNumber: string;
  role: string;
  kycStatus: KycStatus;
  createdAt: string;
};

const KYC_CONFIG: Record<KycStatus, {
  emoji: string;
  title: string;
  desc: string;
  btnLabel?: string;
  btnHref?: string;
  colorClass: string;
}> = {
  NONE: {
    emoji: '🔒',
    title: 'Belum Terverifikasi',
    desc: 'Verifikasi identitasmu untuk bisa menambahkan properti dan mengakses semua fitur PAPAN.',
    btnLabel: 'Mulai Verifikasi',
    btnHref: '/owner/verify',
    colorClass: 'kycNone',
  },
  PENDING: {
    emoji: '⏳',
    title: 'Sedang Ditinjau',
    desc: 'Pengajuan verifikasi kamu sedang diproses oleh tim kami. Proses peninjauan 1×24 jam kerja.',
    colorClass: 'kycPending',
  },
  APPROVED: {
    emoji: '✅',
    title: 'Terverifikasi',
    desc: 'Identitasmu telah berhasil diverifikasi. Kamu bisa menambahkan dan mengelola properti.',
    btnLabel: 'Tambah Properti',
    btnHref: '/owner/addProperty',
    colorClass: 'kycApproved',
  },
  REJECTED: {
    emoji: '❌',
    title: 'Pengajuan Ditolak',
    desc: 'Pengajuan verifikasimu ditolak. Silakan cek catatan admin dan ajukan ulang.',
    btnLabel: 'Ajukan Ulang',
    btnHref: '/owner/verify',
    colorClass: 'kycRejected',
  },
};
 
function KycStatusCard({ status, onNavigate }: { status: KycStatus; onNavigate: (href: string) => void }) {
  const config = KYC_CONFIG[status];
  return (
    <div className={`${styles.kycCard} ${styles[config.colorClass]}`}>
      <div className={styles.kycLeft}>
        <span className={styles.kycEmoji}>{config.emoji}</span>
        <div>
          <p className={styles.kycTitle}>Status KYC: {config.title}</p>
          <p className={styles.kycDesc}>{config.desc}</p>
        </div>
      </div>
      {config.btnLabel && config.btnHref && (
        <button className={styles.kycBtn} onClick={() => onNavigate(config.btnHref!)}>
          {config.btnLabel}
        </button>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [avatarSrc, setAvatarSrc] = useState<string>(DEFAULT_AVATAR);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSwitchModal, setShowSwitchModal] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Gagal memuat profil.');
        }
        const data: UserProfile = await res.json();
        setProfile(data);
        setAvatarSrc(data.image ?? DEFAULT_AVATAR);
      } catch (err) {
        setError('Tidak dapat memuat data profil. Coba lagi nanti.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  const handleSwitchMode = () => {
    setShowSwitchModal(true);
  };

  const confirmSwitchMode = () => {
    setIsSwitchingMode(true);
    window.setTimeout(() => {
      const target = profile?.kycStatus === 'APPROVED' ? '/owner/dashboard' : '/owner/verify';
      router.push(target);
    }, 450);
  };

  const handleAvatarClick = () => {
    router.push('/profile/edit');
  };

  const kycLabel: Record<KycStatus, string> = {
    NONE: 'Belum Verifikasi',
    PENDING: 'Menunggu Verifikasi',
    APPROVED: 'Terverifikasi ✓',
    REJECTED: 'Ditolak',
  };

  const profileFields = profile
    ? [
        { label: 'Nama', value: profile.name },
        { label: 'Username', value: `@${profile.username}` },
        { label: 'Email', value: profile.email },
        { label: 'Nomor Handphone', value: profile.phoneNumber },
        { label: 'Role', value: profile.role === 'ADMIN' ? 'Admin' : 'Pencari Properti' },
        { label: 'Status KYC', value: kycLabel[profile.kycStatus] ?? profile.kycStatus },
      ]
    : [];

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.contentArea}>
        <div className={styles.container}>

          {/* ── Left Sidebar ── */}
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((prev) => !prev)}
            onSwitchMode={handleSwitchMode}
          />

          {/* ── Main Content ── */}
          <div className={styles.mainContent}>
            {isLoading ? (
              <div className={styles.skeletonWrap} aria-hidden>
                <div className={styles.skeletonCard}>
                  <div className={styles.skeletonRow}>
                    <div className={`${styles.skeletonAvatar} ${styles.skeletonShimmer}`} />
                    <div className={styles.skeletonFields}>
                      <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.lg} ${styles.w70}`} />
                      <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.md} ${styles.w60}`} />
                      <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.w40}`} />
                      <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.w60}`} />
                    </div>
                  </div>
                </div>
                <div className={`${styles.skeletonButton} ${styles.skeletonShimmer}`} />
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} className={styles.retryBtn}>
                  Coba Lagi
                </button>
              </div>
            ) : (
              <>
                {/* Profile Card */}
                <div className={styles.profileCard}>
                  <div className={styles.profileCardInner}>

                    {/* Avatar */}
                    <div className={styles.avatarSection}>
                      <div
                        className={styles.avatarWrapper}
                        onClick={handleAvatarClick}
                        title="Klik untuk edit profil"
                      >
                        <img
                          alt="Profile"
                          className={styles.avatarImage}
                          src={optimizeImage(avatarSrc, IMAGE_WIDTH.thumb * 2)}
                          decoding="async"
                          onError={() => setAvatarSrc(DEFAULT_AVATAR)}
                        />
                        <div className={styles.avatarOverlay}>
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                            <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm6.4-10.4H5.6A2.4 2.4 0 0 0 3.2 7.2v9.6a2.4 2.4 0 0 0 2.4 2.4h12.8a2.4 2.4 0 0 0 2.4-2.4V7.2a2.4 2.4 0 0 0-2.4-2.4zm-1.6-2.4H7.2L8.8.8h6.4l1.6 2.4z"/>
                          </svg>
                          <p className={styles.overlayText}>Edit Profil</p>
                        </div>
                      </div>                      
                      <p className={styles.avatarHelpText}>Klik foto untuk edit profil</p>
                    </div>

                    {/* Profile Fields */}
                    <div className={styles.fieldsGrid}>
                      {profileFields.map(({ label, value }) => (
                        <div key={label}>
                          <p className={styles.fieldLabel}>{label}</p>
                          <div className={styles.fieldValueWrapper}>
                            <p className={styles.fieldValue}>{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className={styles.actionButtons}>
                  <button onClick={handleEditProfile} className={styles.editButton}>
                    <p className={styles.editButtonText}>Edit Profile</p>
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {showSwitchModal && (
        <div className={styles.modeOverlay} onClick={() => !isSwitchingMode && setShowSwitchModal(false)}>
          <div className={styles.modeModal} onClick={(e) => e.stopPropagation()}>
            <p className={styles.modeModalTitle}>Pindah ke Mode Pemilik?</p>
            <p className={styles.modeModalDesc}>
              Kamu akan diarahkan ke area pemilik properti untuk verifikasi dan pengelolaan listing.
            </p>
            <div className={styles.modeModalActions}>
              <button
                className={styles.modeCancelBtn}
                onClick={() => setShowSwitchModal(false)}
                disabled={isSwitchingMode}
              >
                Batal
              </button>
              <button
                className={styles.modeConfirmBtn}
                onClick={confirmSwitchMode}
                disabled={isSwitchingMode}
              >
                {isSwitchingMode ? 'Memindahkan...' : 'Ya, lanjut'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}