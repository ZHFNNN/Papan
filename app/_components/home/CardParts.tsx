'use client';

import { useState, type ReactNode } from 'react';
import CardImageCarousel from '@/components/CardImageCarousel';
import styles from '@/app/HomePage.module.css';

const carouselClassNames = {
  wrapper: styles.cardImageWrapper,
  track: styles.cardImageTrack,
  image: styles.cardImage,
  dots: styles.dots,
  dot: styles.dot,
  dotActive: styles.dotActive,
};

/**
 * Kerangka kartu properti di home: area klik + keyboard, carousel gambar,
 * lalu isi kartu (children). Dipakai oleh kartu Best Seller, Rekomendasi,
 * dan Potongan Harga.
 */
export function CardShell({
  className,
  images,
  title,
  onOpen,
  badge,
  children,
}: {
  className: string;
  images: string[];
  title: string;
  onOpen: () => void;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <article
      className={className}
      role="button"
      tabIndex={0}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {badge}
      <CardImageCarousel
        images={images}
        alt={title}
        active={isHovered}
        classNames={carouselClassNames}
      />
      <div className={styles.cardBody}>{children}</div>
    </article>
  );
}

export function CardLocation({ text }: { text: string }) {
  return (
    <div className={styles.cardLokasi}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
          fill="currentColor"
        />
      </svg>
      <span>{text}</span>
    </div>
  );
}

export function CardStats({ values }: { values: string[] }) {
  return (
    <div className={styles.cardStats}>
      {values.map((value, i) => (
        <span key={i}>{value}</span>
      ))}
    </div>
  );
}

export function CardFacilities({ items }: { items: string[] }) {
  return (
    <div className={styles.cardFasilitas}>
      {items.map((item) => (
        <span key={item}>{item}</span>
      ))}
    </div>
  );
}

export function SkeletonCards({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={styles.skeletonCard} aria-hidden>
          <div className={`${styles.skeletonImg} ${styles.skeletonShimmer}`} />
          <div className={styles.skeletonBody}>
            <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.lg} ${styles.w70}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.md} ${styles.w50}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonShimmer} ${styles.sm} ${styles.w60}`} />
            <div className={styles.skeletonRow}>
              <span className={`${styles.skeletonPill} ${styles.skeletonShimmer}`} />
              <span className={`${styles.skeletonPill} ${styles.skeletonShimmer}`} />
              <span className={`${styles.skeletonPill} ${styles.skeletonShimmer}`} />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
