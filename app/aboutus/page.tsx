"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import styles from "./page.module.css";

const stats = [
  { value: "10K+", label: "Properti Terdaftar" },
  { value: "98%",  label: "Kepuasan Pengguna" },
  { value: "50+",  label: "Kota Terjangkau" },
  { value: "24/7", label: "Dukungan Pelanggan" },
];

const values = [
  {
    num: "01",
    title: "Akurasi DSS",
    desc: "Sistem rekomendasi berbasis Decision Support System menghasilkan skor kecocokan yang relevan dan personal untuk setiap pencari.",
  },
  {
    num: "02",
    title: "Keamanan Terverifikasi",
    desc: "Setiap pemilik properti dapat memverifikasi akun melalui KTP untuk membangun kepercayaan dan transparansi di platform.",
  },
  {
    num: "03",
    title: "Proses Cepat & Efisien",
    desc: "Dari pencarian hingga kontak pemilik, semua dapat dilakukan dalam hitungan menit tanpa proses yang berbelit.",
  },
  {
    num: "04",
    title: "Ekosistem Terpercaya",
    desc: "Kami membangun jembatan antara pencari dan pemilik properti yang saling menguntungkan dan berkeadilan.",
  },
];

export default function AboutPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.inView);
          }
        });
      },
      { threshold: 0.12 }
    );
    document.querySelectorAll(`.${styles.animate}`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        {/* ── Hero Banner ── */}
        <section className={styles.heroBanner}>
          <div className={styles.heroImg}>
            <Image
              src="/images/about-hero.jpg"
              alt="Tampilan properti modern"
              fill
              style={{ objectFit: "cover" }}
              priority
            />
          </div>
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <p className={styles.heroEyebrow}>Tentang Kami</p>
            <h1 className={styles.heroTitle}>
              Menemukan Properti yang Tepat,<br />
              Bukan Sekadar Banyak Pilihan
            </h1>
          </div>
        </section>

        {/* ── About Text ── */}
        <section className={styles.aboutSection}>
          <div className={styles.aboutGrid}>
            <div className={`${styles.aboutLabelCol} ${styles.animate}`}>
              <span className={styles.labelLine} />
              <span className={styles.labelText}>Misi Kami</span>
            </div>
            <div className={`${styles.aboutBody} ${styles.animate}`}>
              <h2 className={styles.aboutTitle}>About Us</h2>
              <p className={styles.aboutText}>
                Platform Marketplace Properti adalah solusi digital yang dirancang untuk memudahkan
                masyarakat dalam mencari, membeli, menyewa, maupun menjual properti secara lebih
                cepat, tepat, dan efisien. Dengan memanfaatkan teknologi Decision Support System
                (DSS), platform ini mampu memberikan rekomendasi properti yang dipersonalisasi
                berdasarkan kebutuhan, preferensi, dan budget pengguna, sehingga proses pencarian
                menjadi lebih terarah dan tidak membingungkan.
              </p>
              <p className={styles.aboutText}>
                Kami percaya bahwa menemukan properti yang tepat bukan hanya tentang melihat banyak
                pilihan, tetapi tentang menemukan yang paling sesuai. Oleh karena itu, kami
                menghadirkan fitur pencarian cerdas, filter yang fleksibel, serta sistem penilaian
                kecocokan untuk membantu pengguna mengambil keputusan dengan lebih percaya diri.
              </p>
              <p className={styles.aboutText}>
                Dengan mengutamakan kemudahan, transparansi, dan keamanan, Platform Marketplace
                Properti berkomitmen untuk menjadi jembatan terpercaya antara pencari dan pemilik
                properti, serta menghadirkan pengalaman digital yang modern dalam industri properti.
              </p>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className={styles.statsSection}>
          <div className={styles.statsInner}>
            {stats.map((s, i) => (
              <div
                key={i}
                className={`${styles.statCard} ${styles.animate}`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Values ── */}
        <section className={styles.valuesSection}>
          <div className={`${styles.valuesTitleWrap} ${styles.animate}`}>
            <h2 className={styles.valuesTitle}>Nilai yang Kami Pegang</h2>
            <p className={styles.valuesSub}>
              Empat prinsip yang memandu setiap keputusan dan fitur di platform kami.
            </p>
          </div>
          <div className={styles.valuesGrid}>
            {values.map((v, i) => (
              <div
                key={i}
                className={`${styles.valueCard} ${styles.animate}`}
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <span className={styles.valueNum}>{v.num}</span>
                <h3 className={styles.valueCardTitle}>{v.title}</h3>
                <p className={styles.valueCardDesc}>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA Band ── */}
        <section className={`${styles.ctaBand} ${styles.animate}`}>
          <div className={styles.ctaBandInner}>
            <h2 className={styles.ctaBandTitle}>Siap Menemukan Properti Impianmu?</h2>
            <div className={styles.ctaBandBtns}>
              <Link href="/" className={styles.btnPrimary}>Mulai Cari Properti</Link>
              <Link href="/contact" className={styles.btnSecondary}>Hubungi Kami</Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}