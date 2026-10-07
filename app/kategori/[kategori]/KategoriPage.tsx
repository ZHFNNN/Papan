'use client';

// components/KategoriPage.tsx
// Komponen reusable untuk semua halaman kategori (Apartemen, Rumah, Kosan)
// Usage: tinggal pass props category, aktif, bgImage, overlays

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { formatPrice } from '@/lib/format-price';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import CardImageCarousel from '@/components/CardImageCarousel';
import { type ApiProperty, type PropertyCardData, mapApiPropertyToCard } from '@/types/property';
import styles from './Kategoripage.module.css';

// ─── Types ────────────────────────────────────────────────────

type ViewMode = 'grid' | 'list' | 'map';
type SortKey = 'default' | 'price_asc' | 'price_desc' | 'newest';
type ListingType = 'RENT' | 'SELL' | null;

export type KategoriType = 'Apartemen' | 'Rumah' | 'Kosan';
export type CategoryApiValue = 'APARTEMEN' | 'RUMAH' | 'KOSAN';

interface HotspotDef {
  id: string;
  href: string;
  img: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface KategoriPageProps {
  aktif: KategoriType;
  categoryApiValue: CategoryApiValue;
  bgImage: string;
  hotspots: readonly HotspotDef[];
}

// ─── Constants ────────────────────────────────────────────────

const TABS: KategoriType[] = ['Apartemen', 'Rumah', 'Kosan'];

const CITIES = ['Jakarta', 'Bandung', 'Yogyakarta', 'Semarang', 'Surabaya'];

const FACILITIES_OPTIONS = [
  { code: 'AC', label: 'AC' },
  { code: 'PARKIR_MOBIL', label: 'Parkir Mobil' },
  { code: 'PARKIR_MOTOR', label: 'Parkir Motor' },
  { code: 'PET_FRIENDLY', label: 'Pet Friendly' },
  { code: 'FURNISHED', label: 'Furnished' },
  { code: 'WIFI', label: 'WiFi' },
  { code: 'DAPUR', label: 'Dapur' },
  { code: 'LAUNDRY', label: 'Laundry' },
  { code: 'KOLAM_RENANG', label: 'Kolam Renang' },
  { code: 'GYM', label: 'Gym' },
];

const PRICE_PRESETS = [
  { label: '< 1 Jt', min: 0, max: 1_000_000 },
  { label: '1–3 Jt', min: 1_000_000, max: 3_000_000 },
  { label: '3–10 Jt', min: 3_000_000, max: 10_000_000 },
  { label: '> 10 Jt', min: 10_000_000, max: Infinity },
];

// ─── Helpers ─────────────────────────────────────────────────

function parseRawPrice(price: string | number): number {
  if (typeof price === 'number') return price;
  return parseInt(String(price).replace(/[^0-9]/g, ''), 10) || 0;
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

// ─── Sub-components ───────────────────────────────────────────

// Price range slider
function PriceRangeSlider({
  min, max, value, onChange,
}: {
  min: number; max: number; value: [number, number]; onChange: (v: [number, number]) => void;
}) {
  const range = max - min;
  const leftPct = ((value[0] - min) / range) * 100;
  const rightPct = ((value[1] - min) / range) * 100;

  return (
    <div className={styles.sliderWrap}>
      <div className={styles.sliderTrack}>
        <div
          className={styles.sliderFill}
          style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%` }}
        />
        <input
          type="range" min={min} max={max} step={500_000}
          value={value[0]}
          className={styles.sliderInput}
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), value[1] - 500_000);
            onChange([v, value[1]]);
          }}
        />
        <input
          type="range" min={min} max={max} step={500_000}
          value={value[1]}
          className={styles.sliderInput}
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), value[0] + 500_000);
            onChange([value[0], v]);
          }}
        />
      </div>
      <div className={styles.sliderLabels}>
        <span>{formatPrice(value[0])}</span>
        <span>{value[1] >= max ? '∞' : formatPrice(value[1])}</span>
      </div>
    </div>
  );
}

// Single property card — grid mode
const gridCarouselClassNames = {
  wrapper: styles.gcImgWrap,
  track: styles.gcImgTrack,
  image: styles.gcImg,
  dots: styles.gcDots,
  dot: styles.gcDot,
  dotActive: styles.gcDotActive,
};

function GridCard({ prop }: { prop: PropertyCardData }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/propertyDetail/${prop.id}`} className={styles.gridCardLink}>
      <article
        className={styles.gridCard}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <CardImageCarousel
          images={prop.images}
          alt={prop.title}
          active={hovered}
          intervalMs={1400}
          hideSingleDot
          classNames={gridCarouselClassNames}
        >
          <span className={styles.gcListingBadge}>{prop.listingType === 'RENT' ? 'Sewa' : 'Jual'}</span>
        </CardImageCarousel>

        <div className={styles.gcBody}>
          <p className={styles.gcTitle}>{prop.title}</p>
          <p className={styles.gcPrice}>{formatPrice(prop.price)}</p>
          <div className={styles.gcLokasi}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>{prop.lokasi}</span>
          </div>
          <div className={styles.gcStats}>
            {prop.luas !== '-' && <span>{prop.luas}</span>}
            {prop.kt !== '-' && <span>{prop.kt} KT</span>}
            {prop.km !== '-' && <span>{prop.km} KM</span>}
          </div>
          {prop.fasilitas.length > 0 && (
            <div className={styles.gcFasilitas}>
              {prop.fasilitas.slice(0, 3).map((f) => <span key={f}>{f}</span>)}
              {prop.fasilitas.length > 3 && <span>+{prop.fasilitas.length - 3}</span>}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

// Single property card — list mode
function ListCard({ prop }: { prop: PropertyCardData }) {
  return (
    <Link href={`/propertyDetail/${prop.id}`} className={styles.listCardLink}>
      <article className={styles.listCard}>
        <div className={styles.lcImgWrap}>
          <img src={optimizeImage(prop.images[0], IMAGE_WIDTH.card)} alt={prop.title} className={styles.lcImg} loading="lazy" decoding="async" />
          <span className={styles.lcBadge}>{prop.listingType === 'RENT' ? 'Sewa' : 'Jual'}</span>
        </div>
        <div className={styles.lcBody}>
          <div className={styles.lcTop}>
            <h3 className={styles.lcTitle}>{prop.title}</h3>
            <p className={styles.lcPrice}>{formatPrice(prop.price)}</p>
          </div>
          <div className={styles.lcLokasi}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
            </svg>
            <span>{prop.lokasi}</span>
          </div>
          <div className={styles.lcStats}>
            {prop.luas !== '-' && <span>📐 {prop.luas}</span>}
            {prop.kt !== '-' && <span>🛏 {prop.kt} Kamar Tidur</span>}
            {prop.km !== '-' && <span>🚿 {prop.km} Kamar Mandi</span>}
          </div>
          {prop.fasilitas.length > 0 && (
            <div className={styles.lcFasilitas}>
              {prop.fasilitas.slice(0, 5).map((f) => <span key={f}>{f}</span>)}
              {prop.fasilitas.length > 5 && <span>+{prop.fasilitas.length - 5} lainnya</span>}
            </div>
          )}
        </div>
        <div className={styles.lcArrow}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </article>
    </Link>
  );
}

// Map pin marker
function MapPin({ prop, active, onClick }: { prop: PropertyCardData; active: boolean; onClick: () => void }) {
  return (
    <button
      className={`${styles.mapPin} ${active ? styles.mapPinActive : ''}`}
      style={{
        // Kalau lat/lng ada, ini bisa diposisikan dengan CSS absolute
        // Untuk sekarang kita tampilkan sebagai list di samping map
      }}
      onClick={onClick}
      aria-label={prop.title}
    >
      <span className={styles.mapPinPrice}>{formatPrice(prop.price)}</span>
    </button>
  );
}

// Skeleton card
function SkeletonGridCard() {
  return (
    <div className={styles.skeletonCard}>
      <div className={`${styles.skeletonImg} ${styles.shimmer}`} />
      <div className={styles.skeletonBody}>
        <div className={`${styles.skeletonLine} ${styles.shimmer}`} style={{ width: '70%', height: 14 }} />
        <div className={`${styles.skeletonLine} ${styles.shimmer}`} style={{ width: '50%', height: 12 }} />
        <div className={`${styles.skeletonLine} ${styles.shimmer}`} style={{ width: '60%', height: 12 }} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function KategoriPage({ aktif, categoryApiValue, bgImage, hotspots }: KategoriPageProps) {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);

  // Hero state
  const [charaX, setCharaX] = useState(50);
  const [hoveredSpot, setHoveredSpot] = useState<string | null>(null);
  // Overlay bangunan (~600KB/gambar) baru diunduh setelah mouse masuk ke hero
  const [overlaysArmed, setOverlaysArmed] = useState(false);

  // When navigating between kategori pages, this client component can be re-used.
  // Clear any active overlay so we don't get a stuck/blank-looking hero until the next mouse event.
  useEffect(() => {
    setHoveredSpot(null);
  }, [aktif, bgImage]);

  // Data state
  const [items, setItems] = useState<PropertyCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Filter state
  const MAX_PRICE = 50_000_000;
  const [filterCity, setFilterCity] = useState<string | null>(null);
  const [filterListing, setFilterListing] = useState<ListingType>(null);
  const [filterFacilities, setFilterFacilities] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE]);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

  // Map state
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null);

  // ── Fetch properties ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const res = await fetch(`/api/properties?category=${categoryApiValue}&take=120`);
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
        if (!cancelled) setItems(data.map(mapApiPropertyToCard));
      } catch {
        if (!cancelled) { setError('Gagal memuat properti.'); setItems([]); }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [categoryApiValue]);

  // ── Filter + sort (client-side) ───────────────────────────────
  const filtered = useMemo(() => {
    let result = [...items];

    // Listing type
    if (filterListing) {
      result = result.filter((p) => p.listingType === filterListing);
    }

    // City
    if (filterCity) {
      result = result.filter((p) =>
        (p.lokasi ?? '').toLowerCase().includes(filterCity.toLowerCase())
      );
    }

    // Price range
    result = result.filter((p) => {
      const raw = parseRawPrice(p.price);
      return raw >= priceRange[0] && (priceRange[1] >= MAX_PRICE || raw <= priceRange[1]);
    });

    // Facilities — filter properti yang punya SEMUA fasilitas yang dipilih
    if (filterFacilities.length > 0) {
      result = result.filter((p) =>
        filterFacilities.every((fc) =>
          p.fasilitas.some((f) => f.toLowerCase().includes(fc.toLowerCase()))
        )
      );
    }

    // Sort
    if (sortKey === 'price_asc') result.sort((a, b) => parseRawPrice(a.price) - parseRawPrice(b.price));
    else if (sortKey === 'price_desc') result.sort((a, b) => parseRawPrice(b.price) - parseRawPrice(a.price));
    else if (sortKey === 'newest') result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    return result;
  }, [items, filterListing, filterCity, priceRange, filterFacilities, sortKey, MAX_PRICE]);

  // Active filter count for badge
  const activeFilterCount = [
    filterCity !== null,
    filterListing !== null,
    filterFacilities.length > 0,
    priceRange[0] > 0 || priceRange[1] < MAX_PRICE,
  ].filter(Boolean).length;

  const clearAllFilters = useCallback(() => {
    setFilterCity(null);
    setFilterListing(null);
    setFilterFacilities([]);
    setPriceRange([0, MAX_PRICE]);
    setSortKey('default');
  }, [MAX_PRICE]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    setCharaX(Math.min(Math.max(((e.clientX - rect.left) / rect.width) * 100, 5), 88));
  };

  const handleHotspotClick = (spot: HotspotDef) => {
    setHoveredSpot(null);
    if (spot.id === aktif.toLowerCase()) { router.push('/'); return; }
    router.push(spot.href);
  };

  const handleTabClick = (tab: KategoriType) => {
    setHoveredSpot(null);
    if (tab === aktif) { router.push('/'); return; }
    router.push(`/kategori/${tab.toLowerCase()}`);
  };

  const toggleFacility = (code: string) => {
    setFilterFacilities((prev) =>
      prev.includes(code) ? prev.filter((f) => f !== code) : [...prev, code]
    );
  };

  // Map query for iframe
  const mapQuery = filterCity
    ? `${aktif} ${filterCity} Indonesia`
    : `${aktif} Indonesia`;

  return (
    <div className={styles.page}>
      <Navbar />

      {/* ── Hero ── */}
      <div
        key={`${aktif}-${bgImage}`}
        className={styles.hero}
        ref={heroRef}
        onMouseEnter={() => setOverlaysArmed(true)}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredSpot(null)}
      >
        <Image
          src={bgImage}
          alt="Hero"
          className={styles.heroBg}
          fill
          sizes="100vw"
          loading="eager"
          fetchPriority="high"
        />

        {overlaysArmed &&
          hotspots.map((spot) => (
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

        {hotspots.map((spot) => (
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
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${tab === aktif ? styles.tabActive : ''}`}
              onClick={() => handleTabClick(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className={styles.contentWrap}>

        {/* ── Sticky toolbar ── */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {/* Filter toggle button */}
            <button
              className={`${styles.filterToggleBtn} ${filterPanelOpen ? styles.filterToggleBtnActive : ''}`}
              onClick={() => setFilterPanelOpen((p) => !p)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="8" y1="12" x2="16" y2="12" />
                <line x1="11" y1="18" x2="13" y2="18" />
              </svg>
              Filter
              {activeFilterCount > 0 && (
                <span className={styles.filterBadge}>{activeFilterCount}</span>
              )}
            </button>

            {/* Quick listing type pills */}
            <div className={styles.quickPills}>
              {(['RENT', 'SELL'] as ListingType[]).map((type) => (
                <button
                  key={type!}
                  className={`${styles.quickPill} ${filterListing === type ? styles.quickPillActive : ''}`}
                  onClick={() => setFilterListing(filterListing === type ? null : type)}
                >
                  {type === 'RENT' ? 'Sewa' : 'Jual'}
                </button>
              ))}
            </div>

            {/* Clear all */}
            {activeFilterCount > 0 && (
              <button className={styles.clearBtn} onClick={clearAllFilters}>
                Hapus filter
              </button>
            )}
          </div>

          <div className={styles.toolbarRight}>
            {/* Result count */}
            <span className={styles.resultCount}>
              {isLoading ? '...' : `${filtered.length} properti`}
            </span>

            {/* Sort */}
            <select
              className={styles.sortSelect}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="default">Relevansi</option>
              <option value="newest">Terbaru</option>
              <option value="price_asc">Harga ↑</option>
              <option value="price_desc">Harga ↓</option>
            </select>

            {/* View mode toggle */}
            <div className={styles.viewToggle}>
              {(['grid', 'list', 'map'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`${styles.viewBtn} ${viewMode === mode ? styles.viewBtnActive : ''}`}
                  onClick={() => setViewMode(mode)}
                  aria-label={`Tampilkan ${mode}`}
                  title={mode === 'grid' ? 'Grid' : mode === 'list' ? 'List' : 'Peta'}
                >
                  {mode === 'grid' && (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
                      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                    </svg>
                  )}
                  {mode === 'list' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="15" height="15">
                      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                      <circle cx="3" cy="6" r="1" fill="currentColor" /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle cx="3" cy="18" r="1" fill="currentColor" />
                    </svg>
                  )}
                  {mode === 'map' && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                      <line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Filter Panel (collapsible) ── */}
        <div className={`${styles.filterPanel} ${filterPanelOpen ? styles.filterPanelOpen : ''}`}>
          <div className={styles.filterPanelInner}>

            {/* Kota */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupLabel}>Kota</p>
              <div className={styles.filterChips}>
                {CITIES.map((city) => (
                  <button
                    key={city}
                    className={`${styles.fChip} ${filterCity === city ? styles.fChipActive : ''}`}
                    onClick={() => setFilterCity(filterCity === city ? null : city)}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Harga */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupLabel}>Harga</p>
              <div className={styles.pricePresets}>
                {PRICE_PRESETS.map((preset) => {
                  const isActive = priceRange[0] === preset.min && (preset.max === Infinity ? priceRange[1] >= MAX_PRICE : priceRange[1] === preset.max);
                  return (
                    <button
                      key={preset.label}
                      className={`${styles.fChip} ${isActive ? styles.fChipActive : ''}`}
                      onClick={() => setPriceRange([preset.min, preset.max === Infinity ? MAX_PRICE : preset.max])}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <PriceRangeSlider
                min={0}
                max={MAX_PRICE}
                value={priceRange}
                onChange={setPriceRange}
              />
            </div>

            {/* Fasilitas */}
            <div className={styles.filterGroup}>
              <p className={styles.filterGroupLabel}>Fasilitas</p>
              <div className={styles.filterChips}>
                {FACILITIES_OPTIONS.map((f) => (
                  <button
                    key={f.code}
                    className={`${styles.fChip} ${filterFacilities.includes(f.code) ? styles.fChipActive : ''}`}
                    onClick={() => toggleFacility(f.code)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* ── Active filter summary tags ── */}
        {activeFilterCount > 0 && (
          <div className={styles.activeFilterRow}>
            {filterListing && (
              <span className={styles.activeTag}>
                {filterListing === 'RENT' ? 'Sewa' : 'Jual'}
                <button onClick={() => setFilterListing(null)}>✕</button>
              </span>
            )}
            {filterCity && (
              <span className={styles.activeTag}>
                {filterCity}
                <button onClick={() => setFilterCity(null)}>✕</button>
              </span>
            )}
            {filterFacilities.map((fc) => (
              <span key={fc} className={styles.activeTag}>
                {FACILITIES_OPTIONS.find((f) => f.code === fc)?.label ?? fc}
                <button onClick={() => toggleFacility(fc)}>✕</button>
              </span>
            ))}
            {(priceRange[0] > 0 || priceRange[1] < MAX_PRICE) && (
              <span className={styles.activeTag}>
                {formatPrice(priceRange[0])} – {priceRange[1] >= MAX_PRICE ? '∞' : formatPrice(priceRange[1])}
                <button onClick={() => setPriceRange([0, MAX_PRICE])}>✕</button>
              </span>
            )}
          </div>
        )}

        {/* ── Content area ── */}
        <div className={styles.mainArea}>

          {/* ── GRID VIEW ── */}
          {viewMode === 'grid' && (
            <div className={styles.gridArea}>
              <div className={styles.gridHeading}>
                <h1 className={styles.gridTitle}>{aktif}</h1>
                <p className={styles.gridSub}>
                  {isLoading ? 'Memuat...' : error ? error : `${filtered.length} properti ditemukan`}
                </p>
              </div>

              {isLoading ? (
                <div className={styles.gridLayout}>
                  {Array.from({ length: 9 }).map((_, i) => <SkeletonGridCard key={i} />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🏠</div>
                  <p className={styles.emptyTitle}>Tidak ada properti</p>
                  <p className={styles.emptySub}>Coba ubah atau hapus filter yang aktif</p>
                  <button className={styles.emptyBtn} onClick={clearAllFilters}>Hapus semua filter</button>
                </div>
              ) : (
                <div className={styles.gridLayout}>
                  {filtered.map((p, i) => (
                    <div key={p.id} className={styles.gridCardWrap} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                      <GridCard prop={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div className={styles.listArea}>
              <div className={styles.gridHeading}>
                <h1 className={styles.gridTitle}>{aktif}</h1>
                <p className={styles.gridSub}>
                  {isLoading ? 'Memuat...' : `${filtered.length} properti ditemukan`}
                </p>
              </div>

              {isLoading ? (
                <div className={styles.listLayout}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`${styles.skeletonListCard} ${styles.shimmer}`} />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>🏠</div>
                  <p className={styles.emptyTitle}>Tidak ada properti</p>
                  <p className={styles.emptySub}>Coba ubah atau hapus filter yang aktif</p>
                  <button className={styles.emptyBtn} onClick={clearAllFilters}>Hapus semua filter</button>
                </div>
              ) : (
                <div className={styles.listLayout}>
                  {filtered.map((p, i) => (
                    <div key={p.id} style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }} className={styles.listCardWrap}>
                      <ListCard prop={p} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── MAP VIEW ── */}
          {viewMode === 'map' && (
            <div className={styles.mapView}>
              {/* Left: property list */}
              <div className={styles.mapSidebar}>
                <p className={styles.mapSidebarTitle}>
                  {isLoading ? 'Memuat...' : `${filtered.length} properti`}
                </p>
                <div className={styles.mapPropertyList}>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className={`${styles.mapPropertySkeletonItem} ${styles.shimmer}`} />
                    ))
                  ) : filtered.length === 0 ? (
                    <div className={styles.mapEmptyState}>
                      <p>Tidak ada properti dengan filter ini</p>
                      <button onClick={clearAllFilters}>Hapus filter</button>
                    </div>
                  ) : (
                    filtered.map((p) => (
                      <Link
                        key={p.id}
                        href={`/propertyDetail/${p.id}`}
                        className={`${styles.mapPropertyItem} ${activeMapPin === p.id ? styles.mapPropertyItemActive : ''}`}
                        onMouseEnter={() => setActiveMapPin(p.id)}
                        onMouseLeave={() => setActiveMapPin(null)}
                      >
                        <div className={styles.mpImgWrap}>
                          <img src={optimizeImage(p.images[0], IMAGE_WIDTH.thumb)} alt={p.title} className={styles.mpImg} loading="lazy" decoding="async" />
                          <span className={styles.mpBadge}>{p.listingType === 'RENT' ? 'Sewa' : 'Jual'}</span>
                        </div>
                        <div className={styles.mpInfo}>
                          <p className={styles.mpTitle}>{p.title}</p>
                          <p className={styles.mpPrice}>{formatPrice(p.price)}</p>
                          <p className={styles.mpLokasi}>{p.lokasi}</p>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              {/* Right: Google Maps embed */}
              <div className={styles.mapEmbed}>
                <iframe
                  title={`Peta ${aktif}`}
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=12&output=embed`}
                  className={styles.mapIframe}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
                {/* Overlay tip */}
                <div className={styles.mapTip}>
                  💡 Klik properti di sebelah kiri untuk melihat detailnya
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      <Footer />
    </div>
  );
}