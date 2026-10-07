export type KategoriType = 'Apartemen' | 'Rumah' | 'Kosan';

export const KATEGORI_TABS: KategoriType[] = ['Apartemen', 'Rumah', 'Kosan'];

export const HERO_HOTSPOTS = [
  {
    id: 'apartemen',
    href: '/kategori/apartemen',
    img: '/images/apartOverlay.png',
    // area bangunan apartemen (kiri-tengah)
    left: 24, top: 18, width: 18, height: 72,
  },
  {
    id: 'rumah',
    href: '/kategori/rumah',
    img: '/images/rumahOverlay.png',
    // rumah tengah
    left: 44, top: 25, width: 16, height: 65,
  },
  {
    id: 'kosan',
    href: '/kategori/kosan',
    img: '/images/kosanOverlay.png',
    // kosan kanan
    left: 62, top: 18, width: 18, height: 72,
  },
] as const;

export type HeroHotspot = (typeof HERO_HOTSPOTS)[number];

export const HERO_HOVER_STORAGE_KEY = 'hero-hover-spot';
export const PROMO_POPUP_SEEN_KEY = 'promo-popup-seen';

/** Jarak geser tombol panah pada baris kartu (px). */
export const SCROLL_STEP = 370;

export const propertyDetailHref = (id: string | number) =>
  `/propertyDetail/${encodeURIComponent(String(id))}`;
