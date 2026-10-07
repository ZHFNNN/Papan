'use client';

import { useRef, type ReactNode } from 'react';
import styles from '@/app/HomePage.module.css';
import { SCROLL_STEP } from './constants';

/**
 * Section dengan judul, tombol panah kiri/kanan, dan baris kartu yang bisa digeser.
 * `notice` (opsional) ditampilkan menggantikan baris kartu, mis. ajakan login.
 */
export default function CardRowSection({
  title,
  notice,
  children,
}: {
  title: string;
  notice?: ReactNode;
  children?: ReactNode;
}) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 1 | -1) => {
    trackRef.current?.scrollBy({ left: direction * SCROLL_STEP, behavior: 'smooth' });
  };

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        <div className={styles.arrowBtns}>
          <button type="button" className={styles.arrowBtn} onClick={() => scroll(-1)} aria-label="Geser kiri">
            &#8592;
          </button>
          <button type="button" className={styles.arrowBtn} onClick={() => scroll(1)} aria-label="Geser kanan">
            &#8594;
          </button>
        </div>
      </div>

      {notice ?? (
        <div className={styles.scrollTrack} ref={trackRef}>
          {children}
        </div>
      )}
    </section>
  );
}

export function RowMessage({ children }: { children: ReactNode }) {
  return <p className={styles.rowMessage}>{children}</p>;
}
