'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from '@/app/HomePage.module.css';
import { HERO_HOTSPOTS, HERO_HOVER_STORAGE_KEY, KATEGORI_TABS, type HeroHotspot } from './constants';

const CHARA_MIN_X = 5;
const CHARA_MAX_X = 88;

/** Baca (lalu hapus) bangunan yang terakhir di-hover sebelum pindah halaman. */
function consumeSavedSpot(): string | null {
  try {
    const saved = sessionStorage.getItem(HERO_HOVER_STORAGE_KEY);
    sessionStorage.removeItem(HERO_HOVER_STORAGE_KEY);
    return saved && HERO_HOTSPOTS.some((spot) => spot.id === saved) ? saved : null;
  } catch {
    return null;
  }
}

export default function HeroSection() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);
  const [charaX, setCharaX] = useState(50);
  const [hoveredSpot, setHoveredSpot] = useState<string | null>(null);
  // Overlay bangunan (~600KB/gambar) baru diunduh setelah mouse masuk ke hero
  const [overlaysArmed, setOverlaysArmed] = useState(false);

  // sessionStorage hanya ada di browser: dibaca setelah mount supaya render
  // server dan render pertama di browser sama (tidak hydration mismatch).
  useEffect(() => {
    const saved = consumeSavedSpot();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverlaysArmed(true);
      setHoveredSpot(saved);
    }
  }, []);

  useEffect(() => {
    KATEGORI_TABS.forEach((tab) => router.prefetch(`/kategori/${tab.toLowerCase()}`));
  }, [router]);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    const xPercent = ((e.clientX - rect.left) / rect.width) * 100;
    setCharaX(Math.min(Math.max(xPercent, CHARA_MIN_X), CHARA_MAX_X));
  };

  const handleHotspotClick = (spot: HeroHotspot) => {
    try {
      sessionStorage.setItem(HERO_HOVER_STORAGE_KEY, spot.id);
    } catch {
      // abaikan: storage tidak tersedia
    }
    router.push(spot.href);
  };

  return (
    <div
      className={`${styles.hero} ${styles.heroFadeIn}`}
      ref={heroRef}
      onMouseEnter={() => setOverlaysArmed(true)}
      onMouseMove={handleMouseMove}
    >
      <Image
        src="/images/bgHome.jpeg"
        alt="Hero"
        className={styles.heroBg}
        fill
        sizes="100vw"
        loading="eager"
        fetchPriority="high"
      />

      {/* Foto kategori — fade in saat hover bangunan, posisi/ukuran sama dengan heroBg */}
      {overlaysArmed &&
        HERO_HOTSPOTS.map((spot) => (
          <Image
            key={spot.id}
            src={spot.img}
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className={`${styles.heroBg} ${styles.heroBgOverlay} ${hoveredSpot === spot.id ? styles.heroBgOverlayVisible : ''}`}
          />
        ))}

      {/* Hitbox tak terlihat per bangunan */}
      {HERO_HOTSPOTS.map((spot) => (
        <div
          key={spot.id}
          className={styles.hotspot}
          style={{ left: `${spot.left}%`, top: `${spot.top}%`, width: `${spot.width}%`, height: `${spot.height}%` }}
          onMouseEnter={() => setHoveredSpot(spot.id)}
          onMouseLeave={() => setHoveredSpot(null)}
          onClick={() => handleHotspotClick(spot)}
          role="button"
          aria-label={`Lihat ${spot.id}`}
        />
      ))}

      <img src="/images/chara.png" alt="chara" className={styles.charaImg} style={{ left: `${charaX}%` }} />

      <div className={styles.tabsWrapper}>
        {KATEGORI_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            className={styles.tab}
            onClick={() => router.push(`/kategori/${tab.toLowerCase()}`)}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
