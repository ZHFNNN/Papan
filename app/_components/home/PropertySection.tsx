'use client';

import { useRouter } from 'next/navigation';
import styles from '@/app/HomePage.module.css';
import { formatPrice } from '@/lib/format-price';
import type { PropertyCardData } from '@/types/property';
import { CardFacilities, CardLocation, CardShell, CardStats, SkeletonCards } from './CardParts';
import CardRowSection, { RowMessage } from './CardRowSection';
import { propertyDetailHref } from './constants';

function PropertyCard({ prop, onOpen }: { prop: PropertyCardData; onOpen: () => void }) {
  return (
    <CardShell className={styles.card} images={prop.images} title={prop.title} onOpen={onOpen}>
      <h3 className={styles.cardTitle}>{prop.title}</h3>
      <p className={styles.cardPrice}>{formatPrice(prop.price)}</p>
      <p className={styles.cardBiaya}>{prop.biayaHidup}</p>
      <CardLocation text={prop.lokasi} />
      <hr className={styles.divider} />
      <CardStats values={[prop.luas, prop.lantai, prop.kt, prop.km]} />
      <CardFacilities items={prop.fasilitas} />
    </CardShell>
  );
}

export default function PropertySection({
  title,
  items,
  isLoading,
  error,
}: {
  title: string;
  items: PropertyCardData[];
  isLoading: boolean;
  error: string | null;
}) {
  const router = useRouter();

  return (
    <CardRowSection title={title}>
      {isLoading ? (
        <SkeletonCards count={6} />
      ) : error ? (
        <RowMessage>{error}</RowMessage>
      ) : items.length === 0 ? (
        <RowMessage>Belum ada properti tersedia.</RowMessage>
      ) : (
        items.map((p) => (
          <PropertyCard key={p.id} prop={p} onOpen={() => router.push(propertyDetailHref(p.id))} />
        ))
      )}
    </CardRowSection>
  );
}
