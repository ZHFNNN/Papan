'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { signOut } from 'next-auth/react';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';

type PropertyCategory = 'RUMAH' | 'APARTEMEN' | 'KOSAN';

interface Owner {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  propertyCount: number;
  categories: PropertyCategory[];
  cities: string[];
}

interface SentNotification {
  id: string;
  title: string;
  message: string;
  imageUrl: string | null;
  createdAt: string;
  recipientCount: number;
}

export default function AdminNotificationsPage() {
  const router = useRouter();
  const [hasMounted, setHasMounted] = useState(false);

  const sanitizeImageUrl = (rawUrl: string): string => {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.toString();
      }
    } catch {
      // Invalid URL; ignore for preview safety
    }

    return '';
  };

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [filterCategory, setFilterCategory] = useState<PropertyCategory | 'ALL'>('ALL');
  const [filterCity, setFilterCity] = useState('');
  const [notificationType, setNotificationType] = useState<'ADMIN_BROADCAST' | 'PROMO_SUGGESTION'>('ADMIN_BROADCAST');
  const safeImageUrl = sanitizeImageUrl(imageUrl);

  // Data state
  const [owners, setOwners] = useState<Owner[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingOwners, setLoadingOwners] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentHistory, setSentHistory] = useState<SentNotification[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [tab, setTab] = useState<'compose' | 'history'>('compose');

  const fetchOwners = useCallback(async () => {
    setLoadingOwners(true);
    try {
      const params = new URLSearchParams();
      if (filterCategory !== 'ALL') params.set('category', filterCategory);
      if (filterCity.trim()) params.set('city', filterCity.trim());
      const res = await fetch(`/api/admin/notifications/owners?${params}`);
      if (res.status === 401) { router.push('/login'); return; }
      if (res.status === 403) { router.push('/'); return; }
      const data = await res.json() as { owners: Owner[]; cities: string[] };
      setOwners(data.owners);
      setCities(data.cities);
    } catch {
      toast.error('Gagal memuat daftar owner.');
    } finally {
      setLoadingOwners(false);
    }
  }, [router, filterCategory, filterCity]);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/admin/notifications/history');
      if (!res.ok) return;
      const data = await res.json() as SentNotification[];
      setSentHistory(data);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    void fetchOwners();
    void fetchHistory();
  }, [fetchOwners, fetchHistory]);

  const handleSend = async () => {
    if (!title.trim()) { toast.error('Judul notifikasi wajib diisi.'); return; }
    if (!message.trim()) { toast.error('Isi pesan wajib diisi.'); return; }
    if (owners.length === 0) { toast.error('Tidak ada owner yang sesuai filter.'); return; }

    setSending(true);
    try {
      const res = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          imageUrl: imageUrl.trim() || null,
          category: filterCategory !== 'ALL' ? filterCategory : null,
          city: filterCity.trim() || null,
          type: notificationType,
        }),
      });
      const data = await res.json() as { message: string; count: number };
      if (!res.ok) throw new Error(data.message);
      toast.success(`Notifikasi berhasil dikirim ke ${data.count} owner!`);
      setTitle('');
      setMessage('');
      setImageUrl('');
      void fetchHistory();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim notifikasi.');
    } finally {
      setSending(false);
    }
  };

  const CATEGORIES: { label: string; value: PropertyCategory | 'ALL' }[] = [
    { label: 'Semua Kategori', value: 'ALL' },
    { label: 'Rumah', value: 'RUMAH' },
    { label: 'Apartemen', value: 'APARTEMEN' },
    { label: 'Kosan', value: 'KOSAN' },
  ];

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    }).format(new Date(iso));
  }

  if (!hasMounted) return <div className={styles.loadingFull}><p>Memuat...</p></div>;

  return (
    <div className={styles.page}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>🏠</span>
          <span className={styles.brandName}>PAPAN Admin</span>
        </div>
        <nav className={styles.nav}>
          <button className={styles.navItem} onClick={() => router.push('/admin/kyc')}>
            <span>📋</span> Verifikasi KYC
          </button>
          <button className={`${styles.navItem} ${styles.navItemActive}`}>
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
          <h1 className={styles.pageTitle}>Kirim Notifikasi</h1>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'compose' ? styles.tabActive : ''}`}
              onClick={() => setTab('compose')}
            >✍️ Buat Pesan</button>
            <button
              className={`${styles.tab} ${tab === 'history' ? styles.tabActive : ''}`}
              onClick={() => setTab('history')}
            >📜 Riwayat</button>
          </div>
        </div>

        {tab === 'compose' ? (
          <div className={styles.composeLayout}>
            {/* Left: Form */}
            <div className={styles.composeCard}>
              <h2 className={styles.cardTitle}>Tulis Notifikasi</h2>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Judul <span className={styles.required}>*</span></label>
                <input
                  className={styles.input}
                  placeholder="Contoh: Promo Boost Properti Akhir Tahun"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={100}
                />
                <span className={styles.charCount}>{title.length}/100</span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Isi Pesan <span className={styles.required}>*</span></label>
                <textarea
                  className={styles.textarea}
                  placeholder="Tulis pesan lengkap untuk para owner..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={6}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>URL Gambar <span className={styles.optional}>(opsional)</span></label>
                <input
                  className={styles.input}
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                />
                {safeImageUrl && (
                  <div className={styles.imagePreviewBox}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={safeImageUrl} alt="preview" className={styles.imagePreview}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                )}
              </div>

              {/* Jenis Notifikasi */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Jenis Notifikasi</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setNotificationType('ADMIN_BROADCAST')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: notificationType === 'ADMIN_BROADCAST' ? '2px solid #305496' : '1px solid #ccc',
                      background: notificationType === 'ADMIN_BROADCAST' ? '#e7f0ff' : '#fff',
                      cursor: 'pointer',
                      fontWeight: notificationType === 'ADMIN_BROADCAST' ? 600 : 400,
                    }}
                  >
                    📢 Broadcast Umum
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationType('PROMO_SUGGESTION')}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: notificationType === 'PROMO_SUGGESTION' ? '2px solid #dc2626' : '1px solid #ccc',
                      background: notificationType === 'PROMO_SUGGESTION' ? '#ffe9e9' : '#fff',
                      cursor: 'pointer',
                      fontWeight: notificationType === 'PROMO_SUGGESTION' ? 600 : 400,
                    }}
                  >
                    🏷️ Saran Promo
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  {notificationType === 'PROMO_SUGGESTION'
                    ? 'Notifikasi akan menampilkan tombol "Atur Promo" yang mengarah ke dashboard owner.'
                    : 'Notifikasi umum tanpa CTA khusus.'}
                </p>
              </div>

              {/* Preview card */}
              <div className={styles.previewSection}>
                <p className={styles.previewLabel}>Preview Notifikasi</p>
                <div className={styles.previewCard}>
                  <div className={styles.previewIcon}>{notificationType === 'PROMO_SUGGESTION' ? '🏷️' : '🔔'}</div>
                  <div className={styles.previewContent}>
                    <p className={styles.previewTitle}>{title || 'Judul notifikasi...'}</p>
                    <p className={styles.previewMsg}>{message ? message.slice(0, 80) + (message.length > 80 ? '...' : '') : 'Isi pesan akan muncul di sini...'}</p>
                  </div>
                </div>
              </div>

              <button
                className={styles.sendBtn}
                onClick={() => void handleSend()}
                disabled={sending || owners.length === 0}
              >
                {sending ? 'Mengirim...' : `🚀 Kirim ke ${owners.length} Owner`}
              </button>
            </div>

            {/* Right: Filter + Recipients */}
            <div className={styles.recipientCard}>
              <h2 className={styles.cardTitle}>Target Penerima</h2>

              <div className={styles.filterGroup}>
                <label className={styles.label}>Kategori Properti</label>
                <div className={styles.categoryChips}>
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      className={`${styles.chip} ${filterCategory === cat.value ? styles.chipActive : ''}`}
                      onClick={() => setFilterCategory(cat.value)}
                    >{cat.label}</button>
                  ))}
                </div>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.label}>Kota / Lokasi</label>
                <div className={styles.cityInputRow}>
                  <input
                    className={styles.input}
                    placeholder="Ketik nama kota..."
                    value={filterCity}
                    onChange={e => setFilterCity(e.target.value)}
                    list="city-suggestions"
                  />
                  <datalist id="city-suggestions">
                    {cities.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div className={styles.ownerListHeader}>
                <span className={styles.ownerCount}>
                  {loadingOwners ? 'Memuat...' : `${owners.length} owner ditemukan`}
                </span>
                <button className={styles.refreshBtn} onClick={() => void fetchOwners()} disabled={loadingOwners}>
                  ↻ Refresh
                </button>
              </div>

              <div className={styles.ownerList}>
                {loadingOwners ? (
                  <div className={styles.loadingInner}><div className={styles.spinner} /><p>Memuat owner...</p></div>
                ) : owners.length === 0 ? (
                  <div className={styles.emptyInner}><p>Tidak ada owner yang sesuai filter.</p></div>
                ) : (
                  owners.map(owner => (
                    <div key={owner.id} className={styles.ownerItem}>
                      <div className={styles.ownerAvatar}>
                        {(owner.name ?? owner.email ?? '?')[0].toUpperCase()}
                      </div>
                      <div className={styles.ownerInfo}>
                        <p className={styles.ownerName}>{owner.name ?? '(tanpa nama)'}</p>
                        <p className={styles.ownerMeta}>@{owner.username} · {owner.propertyCount} properti</p>
                        <div className={styles.ownerTags}>
                          {owner.categories.map(c => (
                            <span key={c} className={styles.catTag}>{c}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* History tab */
          <div className={styles.historyCard}>
            <h2 className={styles.cardTitle}>Riwayat Notifikasi Terkirim</h2>
            {loadingHistory ? (
              <div className={styles.loadingInner}><div className={styles.spinner} /><p>Memuat riwayat...</p></div>
            ) : sentHistory.length === 0 ? (
              <div className={styles.emptyInner}><p>Belum ada notifikasi yang dikirim.</p></div>
            ) : (
              <div className={styles.historyList}>
                {sentHistory.map(n => (
                  <div key={n.id} className={styles.historyItem}>
                    {n.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={optimizeImage(n.imageUrl, IMAGE_WIDTH.thumb)} alt="" className={styles.historyImg} loading="lazy" decoding="async" />
                    )}
                    <div className={styles.historyContent}>
                      <p className={styles.historyTitle}>{n.title}</p>
                      <p className={styles.historyMsg}>{n.message.slice(0, 120)}{n.message.length > 120 ? '...' : ''}</p>
                      <p className={styles.historyMeta}>{formatDate(n.createdAt)} · {n.recipientCount} penerima</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}