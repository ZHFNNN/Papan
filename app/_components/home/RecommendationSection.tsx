'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '@/app/HomePage.module.css';
import { formatPrice } from '@/lib/format-price';
import { buildLocation, formatListingType } from '@/types/property';
import { CardFacilities, CardLocation, CardShell, SkeletonCards } from './CardParts';
import CardRowSection from './CardRowSection';
import { propertyDetailHref } from './constants';

type RecommendationItem = {
  id: string;
  title: string;
  listingType: string;
  coverImageUrl?: string | null;
  images?: string[];
  address?: string | null;
  neighbourhood?: string | null;
  district?: string | null;
  city?: string | null;
  price: number;
  score: number;
  breakdown: {
    matchedFacilityCodes?: string[];
  };
};

type RecommendationState = {
  items: RecommendationItem[];
  isLoading: boolean;
  message: string | null;
};

const FALLBACK_IMAGES = ['/images/bgHomeKosan.jpeg', '/images/bgHomeApart.png'];

/** "WATER_HEATER" -> "Water Heater", "AC" -> "AC" */
const formatFacilityCode = (code: string) =>
  code
    .toLowerCase()
    .split('_')
    .map((word) => (word.length <= 2 ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');

const imagesOf = (item: RecommendationItem, idx: number) =>
  item.images?.length
    ? item.images
    : [item.coverImageUrl ?? FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length]];

function useRecommendations(): RecommendationState {
  const [state, setState] = useState<RecommendationState>({ items: [], isLoading: true, message: null });

  useEffect(() => {
    let cancelled = false;
    const finish = (items: RecommendationItem[], message: string | null) => {
      if (!cancelled) setState({ items, isLoading: false, message });
    };

    (async () => {
      try {
        const res = await fetch('/api/recommendations');
        const data = await res.json().catch(() => ({}));

        if (res.status === 401) return finish([], 'Silakan login untuk melihat rekomendasi personal.');
        if (!res.ok) return finish([], data.message ?? 'Gagal mengambil rekomendasi.');

        const items = Array.isArray(data.data) ? (data.data as RecommendationItem[]) : [];
        finish(items, items.length ? null : 'Isi personalisasi dulu supaya rekomendasi bisa ditampilkan.');
      } catch {
        finish([], 'Terjadi kesalahan saat mengambil rekomendasi.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export default function RecommendationSection() {
  const router = useRouter();
  const { items, isLoading, message } = useRecommendations();

  const notice =
    !isLoading && items.length === 0 ? (
      <div className={styles.recommendationNotice}>
        <p>{message ?? 'Belum ada rekomendasi.'}</p>
        <button type="button" className={styles.recommendationCta} onClick={() => router.push('/personalisasi')}>
          Atur Personalisasi
        </button>
      </div>
    ) : undefined;

  return (
    <CardRowSection title="Rekomendasi Untuk Kamu" notice={notice}>
      {isLoading ? (
        <SkeletonCards count={5} />
      ) : (
        items.map((item, idx) => (
          <CardShell
            key={item.id}
            className={styles.card}
            images={imagesOf(item, idx)}
            title={item.title}
            onOpen={() => router.push(propertyDetailHref(item.id))}
          >
            <h3 className={styles.cardTitle}>{item.title}</h3>
            <p className={styles.cardPrice}>{formatPrice(item.price)}</p>
            <p className={styles.cardBiaya}>Tipe: {formatListingType(item.listingType)}</p>
            <CardLocation text={buildLocation(item)} />
            <hr className={styles.divider} />
            <CardFacilities items={(item.breakdown.matchedFacilityCodes ?? []).slice(0, 4).map(formatFacilityCode)} />
          </CardShell>
        ))
      )}
    </CardRowSection>
  );
}
