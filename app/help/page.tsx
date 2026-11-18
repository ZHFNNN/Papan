'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';
import styles from './page.module.css';
import Icon, { type IconName } from '@/components/Icon';

type FAQ = { q: string; a: string };
type Category = { icon: IconName; title: string; desc: string; faqs: FAQ[] };

const CATEGORIES: Category[] = [
  {
    icon: 'user',
    title: 'Akun & Profil',
    desc: 'Pengaturan akun, verifikasi, dan profil',
    faqs: [
      { q: 'Bagaimana cara mengubah foto profil?', a: 'Buka halaman Profil, lalu klik foto profil kamu. Akan muncul opsi untuk memilih gambar baru dari perangkat.' },
      { q: 'Bagaimana cara verifikasi KYC?', a: 'Klik tombol "Aktifkan Mode Pemilik Properti" di halaman Profil, lalu ikuti langkah-langkah verifikasi dengan mengunggah KTP dan foto selfie.' },
      { q: 'Saya lupa password, bagaimana reset-nya?', a: 'Di halaman login, klik "Lupa Password" dan masukkan email terdaftar. Link reset akan dikirim ke email kamu.' },
    ],
  },
  {
    icon: 'home',
    title: 'Cari Properti',
    desc: 'Filter, bookmark, dan pencarian properti',
    faqs: [
      { q: 'Bagaimana cara menyimpan properti favorit?', a: 'Klik ikon bookmark pada kartu properti yang kamu minati. Properti tersimpan bisa diakses di menu Bookmark.' },
      { q: 'Apakah bisa filter berdasarkan harga?', a: 'Ya! Gunakan filter di halaman pencarian untuk mengatur rentang harga, jumlah kamar, dan lokasi sesuai kebutuhanmu.' },
      { q: 'Bagaimana cara melihat riwayat pencarian?', a: 'Riwayat pencarian tersedia di menu History di navigasi atas halaman.' },
    ],
  },
  {
    icon: 'wallet',
    title: 'Pembayaran',
    desc: 'Proses transaksi dan metode pembayaran',
    faqs: [
      { q: 'Metode pembayaran apa saja yang tersedia?', a: 'PAPAN mendukung transfer bank, kartu kredit/debit, dan dompet digital seperti GoPay dan OVO.' },
      { q: 'Apakah ada biaya layanan dari PAPAN?', a: 'PAPAN mengenakan biaya layanan sebesar 2.5% dari nilai transaksi untuk memastikan keamanan dan kenyamanan pengguna.' },
      { q: 'Bagaimana cara melihat riwayat transaksi?', a: 'Buka menu History di navigasi atas untuk melihat semua riwayat transaksi dan pembayaran.' },
    ],
  },
  {
    icon: 'lock',
    title: 'Keamanan',
    desc: 'Keamanan akun dan privasi data',
    faqs: [
      { q: 'Bagaimana PAPAN melindungi data saya?', a: 'Data kamu dienkripsi dengan standar industri. Kami tidak pernah menjual data pribadi kepada pihak ketiga.' },
      { q: 'Apa itu verifikasi dua langkah?', a: 'Verifikasi dua langkah (2FA) menambahkan lapisan keamanan ekstra dengan mengirimkan OTP ke nomor HP kamu setiap login.' },
    ],
  },
];

export default function HelpPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const allFaqs = CATEGORIES.flatMap((c, ci) => c.faqs.map((f, fi) => ({ ...f, ci, fi })));
  const filtered = search
    ? allFaqs.filter(f => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : null;

  const currentFaqs = filtered ?? CATEGORIES[activeCategory].faqs;

  return (
    <div className={styles.page}>
      <Navbar />
      <div className={styles.contentArea}>
        <div className={styles.container}>

          <div className={styles.sidebarWrapper}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />
          </div>

          {/* Main Content */}
          <div className={`${styles.mainContent} ${sidebarCollapsed ? styles.mainContentFull : ''}`}>

            {/* Header */}
            <div className={styles.pageHeader}>
              <div className={styles.headerIcon}><Icon name="lifeBuoy" /></div>
              <div className={styles.headerText}>
                <h1 className={styles.pageTitle}>Pusat Bantuan</h1>
                <p className={styles.pageSubtitle}>Temukan jawaban atas pertanyaanmu di sini</p>
              </div>
            </div>

            {/* Search */}
            <div className={styles.searchCard}>
              <div className={styles.searchWrapper}>
                <span className={styles.searchIcon}><Icon name="search" /></span>
                <input
                  className={styles.searchInput}
                  placeholder="Cari topik bantuan..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setOpenFaq(null); }}
                />
                {search && (
                  <button className={styles.searchClear} onClick={() => setSearch('')}>✕</button>
                )}
              </div>
            </div>

            {/* Category Tabs (hidden when searching) */}
            {!search && (
              <div className={styles.categoryTabs}>
                {CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.title}
                    className={`${styles.catTab} ${activeCategory === i ? styles.catTabActive : ''}`}
                    onClick={() => { setActiveCategory(i); setOpenFaq(null); }}
                  >
                    <span className={styles.catTabIcon}><Icon name={cat.icon} /></span>
                    <span className={styles.catTabLabel}>{cat.title}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Category Header (hidden when searching) */}
            {!search && (
              <div className={styles.catHeader}>
                <span className={styles.catHeaderIcon}><Icon name={CATEGORIES[activeCategory].icon} /></span>
                <div>
                  <p className={styles.catHeaderTitle}>{CATEGORIES[activeCategory].title}</p>
                  <p className={styles.catHeaderDesc}>{CATEGORIES[activeCategory].desc}</p>
                </div>
              </div>
            )}

            {/* Search result count */}
            {search && (
              <p className={styles.searchCount}>
                {filtered!.length} hasil untuk &quot;{search}&quot;
              </p>
            )}

            {/* FAQ Accordion */}
            <div className={styles.faqList}>
              {currentFaqs.length === 0 ? (
                <div className={styles.emptyState}>
                  <p className={styles.emptyIcon}><Icon name="search" /></p>
                  <p className={styles.emptyText}>Tidak ada hasil untuk pencarian ini.</p>
                  <p className={styles.emptyDesc}>Coba kata kunci lain atau hubungi tim kami.</p>
                </div>
              ) : (
                currentFaqs.map((faq, i) => (
                  <div key={i} className={`${styles.faqItem} ${openFaq === i ? styles.faqItemOpen : ''}`}>
                    <button
                      className={styles.faqQuestion}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    >
                      <span className={styles.faqQ}>{faq.q}</span>
                      <span className={`${styles.faqChevron} ${openFaq === i ? styles.chevronOpen : ''}`}>▾</span>
                    </button>
                    {openFaq === i && (
                      <div className={styles.faqAnswer}>
                        <p>{faq.a}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Still need help */}
            <div className={styles.helpCard}>
              <div className={styles.helpLeft}>
                <span className={styles.helpIcon}><Icon name="message" /></span>
                <div>
                  <p className={styles.helpTitle}>Masih butuh bantuan?</p>
                  <p className={styles.helpDesc}>Tim support kami siap membantu kamu secara langsung</p>
                </div>
              </div>
              <button className={styles.helpBtn} onClick={() => router.push('/contact')}>
                Hubungi Kami
              </button>
            </div>

          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}