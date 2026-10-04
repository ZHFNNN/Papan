'use client';

import dynamic from 'next/dynamic';
import styles from './HomePage.module.css';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import HeroSection from './_components/home/HeroSection';
import PropertySection from './_components/home/PropertySection';
import RecommendationSection from './_components/home/RecommendationSection';
import { useHomeProperties, usePromoPopup } from './_components/home/useHomeData';

// Kode popup (termasuk animasi canvas) baru diunduh saat popup dibuka
const DiscountPopup = dynamic(() => import('./_components/home/DiscountPopup'), { ssr: false });

export default function HomePage() {
  const properties = useHomeProperties();
  const promo = usePromoPopup();

  return (
    <div className={styles.page}>
      <Navbar />
      <HeroSection />

      <div className={styles.content}>
        <RecommendationSection />
        <PropertySection
          title="Best Seller"
          items={properties.items}
          isLoading={properties.isLoading}
          error={properties.error}
        />
      </div>
      <Footer />

      {promo.isOpen ? (
        <DiscountPopup
          items={properties.items}
          isLoading={properties.isLoading}
          error={properties.error}
          onClose={promo.close}
        />
      ) : (
        <button
          type="button"
          className={styles.promoFab}
          onClick={promo.open}
          aria-label="Buka promo potongan harga"
        >
          <span className={styles.promoFabIcon}>🔥</span>
          <span className={styles.promoFabText}>Promo</span>
        </button>
      )}
    </div>
  );
}
