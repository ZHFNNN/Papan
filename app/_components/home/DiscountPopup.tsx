'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/HomePage.module.css';
import { formatPrice } from '@/lib/format-price';
import type { PropertyCardData } from '@/types/property';
import { CardFacilities, CardLocation, CardShell, CardStats, SkeletonCards } from './CardParts';
import { propertyDetailHref } from './constants';
import { useSparkCanvas } from './useSparkCanvas';

/** Persentase diskon dummy, dirotasi per kartu. */
const DISCOUNT_RATES = [15, 20, 10, 25, 30, 18];
const TICKER_ICONS = ['😱', '🔥'];
const TICKER_REPEAT = 5;

function TickerGroup({ offset, hidden }: { offset: number; hidden?: boolean }) {
  return (
    <span className={styles.discountTickerGroup} aria-hidden={hidden || undefined}>
      {Array.from({ length: TICKER_REPEAT }).map((_, i) => (
        <span key={i} className={styles.discountTickerItem}>
          <span className={styles.discountPill}>
            <span className={styles.discountFlashIcon}>{TICKER_ICONS[(i + offset) % 2]}</span>
            <span className={styles.discountTitle}>Potongan Harga</span>
          </span>
        </span>
      ))}
    </span>
  );
}

/** Teks "POTONGAN HARGA" berjalan; dua grup identik supaya loop-nya mulus. */
function DiscountTicker({ position }: { position: 'top' | 'bottom' }) {
  const isTop = position === 'top';
  return (
    <div className={`${styles.discountHeader} ${isTop ? '' : styles.discountHeaderBottom}`}>
      <h2
        className={styles.discountTicker}
        aria-label={isTop ? 'Potongan Harga' : undefined}
        aria-hidden={isTop ? undefined : true}
      >
        <TickerGroup offset={0} />
        <TickerGroup offset={1} hidden />
      </h2>
    </div>
  );
}

function DiscountCard({ prop, discount, onOpen }: { prop: PropertyCardData; discount: number; onOpen: () => void }) {
  return (
    <CardShell
      className={styles.discountCard}
      images={prop.images}
      title={prop.title}
      onOpen={onOpen}
      badge={<div className={styles.discountBadge}>-{discount}%</div>}
    >
      <h3 className={styles.cardTitle}>{prop.title}</h3>
      <div className={styles.discountPriceRow}>
        <p className={styles.discountOriginalPrice}>{formatPrice(prop.price)}</p>
        <p className={styles.discountNewPrice}>{formatPrice(prop.price)}</p>
      </div>
      <p className={styles.cardBiaya}>{prop.biayaHidup}</p>
      <CardLocation text={prop.lokasi} />
      <hr className={styles.divider} />
      <CardStats values={[prop.luas, prop.lantai, prop.kt, prop.km]} />
      <CardFacilities items={prop.fasilitas} />
    </CardShell>
  );
}

/** Tutup pakai Esc + kunci scroll halaman selama popup terbuka. */
function useModalBehavior(onClose: () => void) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);
}

export default function DiscountPopup({
  items,
  isLoading,
  error,
  onClose,
}: {
  items: PropertyCardData[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useSparkCanvas(canvasRef);
  useModalBehavior(onClose);

  const renderCards = () => {
    if (isLoading) return <SkeletonCards count={5} />;
    if (error) return <p className={styles.discountMessage}>{error}</p>;
    if (items.length === 0) return <p className={styles.discountMessage}>Belum ada promo tersedia.</p>;
    return items.map((p, i) => (
      <DiscountCard
        key={p.id}
        prop={p}
        discount={DISCOUNT_RATES[i % DISCOUNT_RATES.length]}
        onOpen={() => router.push(propertyDetailHref(p.id))}
      />
    ));
  };

  return (
    <div className={styles.discountOverlay} onClick={onClose}>
      <section
        className={styles.discountModal}
        role="dialog"
        aria-modal="true"
        aria-label="Potongan Harga"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={styles.discountCloseBtn} onClick={onClose} aria-label="Tutup promo">
          ✕
        </button>

        <div className={styles.discountBg}>
          <canvas ref={canvasRef} className={styles.discountSparkCanvas} />
          <div className={styles.discountGlowLeft} />
          <div className={styles.discountGlowRight} />
          <div className={styles.discountGlowCenter} />

          <DiscountTicker position="top" />
          <div className={styles.discountTrackWrap}>
            <div className={styles.discountTrack}>{renderCards()}</div>
          </div>
          <DiscountTicker position="bottom" />
        </div>
      </section>
    </div>
  );
}
