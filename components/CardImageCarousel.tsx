'use client';

import { useEffect, useState, type MouseEvent, type ReactNode } from 'react';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';

type CarouselClassNames = {
  wrapper: string;
  track: string;
  image: string;
  dots: string;
  dot: string;
  dotActive: string;
};

type CardImageCarouselProps = {
  images: string[];
  alt: string;
  /** true saat kartu di-hover: carousel mulai berputar & gambar berikutnya baru diunduh. */
  active: boolean;
  classNames: CarouselClassNames;
  intervalMs?: number;
  /** Sembunyikan titik navigasi bila hanya ada satu gambar. */
  hideSingleDot?: boolean;
  children?: ReactNode;
};

/**
 * Carousel gambar kartu properti.
 * Hanya gambar pertama yang dimuat di awal (lazy). Gambar lain baru diunduh
 * ketika kartu di-hover atau titiknya diklik, jadi kartu yang tidak disentuh
 * tidak memakan bandwidth.
 */
export default function CardImageCarousel({
  images,
  alt,
  active,
  classNames,
  intervalMs = 1200,
  hideSingleDot = false,
  children,
}: CardImageCarouselProps) {
  const [index, setIndex] = useState(0);
  const total = images.length;
  // Gambar yang sedang tampil + (saat hover) satu gambar berikutnya
  const loadedCount = Math.min(total, index + 1 + (active ? 1 : 0));

  useEffect(() => {
    if (!active || total <= 1) return;
    const id = setInterval(() => setIndex((prev) => (prev + 1) % total), intervalMs);
    return () => clearInterval(id);
  }, [active, total, intervalMs]);

  const goTo = (e: MouseEvent, i: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIndex(i);
  };

  return (
    <div className={classNames.wrapper}>
      <div className={classNames.track} style={{ transform: `translateX(-${index * 100}%)` }}>
        {images.map((src, i) =>
          i < loadedCount ? (
            <img
              key={i}
              src={optimizeImage(src, IMAGE_WIDTH.card)}
              alt={alt}
              className={classNames.image}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div key={i} className={classNames.image} aria-hidden />
          ),
        )}
      </div>

      {!(hideSingleDot && total <= 1) && (
        <div className={classNames.dots}>
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`${classNames.dot} ${i === index ? classNames.dotActive : ''}`}
              onClick={(e) => goTo(e, i)}
              aria-label={`Foto ${i + 1}`}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
