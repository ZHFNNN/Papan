'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';

const DEFAULT_AVATAR = '/images/ppdefault.png';

type KycStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

type OwnerProfile = {
  id: string;
  name: string;
  username: string;
  email: string;
  image?: string | null;
  phoneNumber: string;
  role: string;
  kycStatus: KycStatus;
  createdAt: string;
  _count?: { properties: number };
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

export default function OwnerProfilePage() {
  const router = useRouter();
  const [avatarSrc, setAvatarSrc] = useState<string>(DEFAULT_AVATAR);
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          if (res.status === 401) { router.push('/login'); return; }
          throw new Error('Gagal memuat profil.');
        }
        const data: OwnerProfile = await res.json();
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

  const handleAvatarClick = () => {
    router.push('/owner/profile/edit');
  };

  const profileFields = profile ? [
    { label: 'Nama', value: profile.name },
    { label: 'Username', value: `@${profile.username}` },
    { label: 'Email', value: profile.email },
    { label: 'Nomor Handphone', value: profile.phoneNumber },
    { label: 'Role', value: 'Pemilik Properti' },
    { label: 'Total Properti', value: `${profile._count?.properties ?? 0} Properti` },
  ] : [];

  return (
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
                

                <div className={styles.profileCard}>
                  <div className={styles.profileCardInner}>
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
                            <path d="M12 15.2A3.2 3.2 0 1 1 12 8.8a3.2 3.2 0 0 1 0 6.4zm6.4-10.4H5.6A2.4 2.4 0 0 0 3.2 7.2v9.6a2.4 2.4 0 0 0 2.4 2.4h12.8a2.4 2.4 0 0 0 2.4-2.4V7.2a2.4 2.4 0 0 0-2.4-2.4zm-1.6-2.4H7.2L8.8.8h6.4l1.6 2.4z" />
                          </svg>
                          <p className={styles.overlayText}>Edit Profil</p>
                        </div>
                      </div>
                      <p className={styles.avatarHelpText}>Klik foto untuk edit profil</p>
                    </div>

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

                <div className={styles.actionButtons}>
                  <button onClick={() => router.push('/owner/profile/edit')} className={styles.editButton}>
                    <p className={styles.editButtonText}>Edit Profile</p>
                  </button>                 
                </div>
              </>
            )}
    </div>
  );
}