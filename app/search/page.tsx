'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { formatPrice } from '@/lib/format-price';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { type ApiProperty, type PropertyCardData, mapApiPropertyToCard } from '@/types/property';
import styles from './page.module.css';

type KategoriType = 'Rumah' | 'Apartemen' | 'Kosan';
type CityType = 'Jakarta' | 'Bandung' | 'Yogyakarta' | 'Semarang' | 'Surabaya';

type SortPrice = 'asc' | 'desc' | null;
type FilterKategori = KategoriType | null;
type FilterCity = CityType | null;

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_KEYWORDS: Record<KategoriType, string[]> = {
  Rumah: ['rumah', 'home', 'house'],
  Apartemen: ['apartemen', 'apartment', 'apt'],
  Kosan: ['kos', 'kost', 'kosan', 'boarding'],
};

const CITY_KEYWORDS: Record<CityType, string[]> = {
  Jakarta: ['jakarta'],
  Bandung: ['bandung'],
  Yogyakarta: ['yogyakarta', 'jogja', 'jogjakarta', 'yogya'],
  Semarang: ['semarang'],
  Surabaya: ['surabaya'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ');
}

function getTokens(value: string) {
  return normalizeText(value).split(/\s+/).filter(Boolean);
}

function detectCategory(query: string): KategoriType | null {
  const tokens = getTokens(query);
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[KategoriType, string[]]>) {
    if (tokens.some((token) => keywords.includes(token))) return category;
  }
  return null;
}

function matchesCity(cityField: string, filterCity: CityType): boolean {
  const normalized = normalizeText(cityField);
  const keywords = CITY_KEYWORDS[filterCity].map((k) => k.toLowerCase());
  return keywords.some((kw) => normalized.includes(kw));
}

/** Extract numeric price from a formatted string like "Rp 2.500.000/bulan" */
function parsePrice(priceStr: string): number {
  const digits = priceStr.replace(/[^0-9]/g, '');
  return parseInt(digits, 10) || 0;
}

// ─── Dropdown component ───────────────────────────────────────────────────────
interface DropdownProps {
  label: string;
  value: string | null;
  options: { label: string; value: string }[];
  onSelect: (value: string | null) => void;
  active: boolean;
}

function FilterDropdown({ label, value, options, onSelect, active }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? null;

  return (
    <div className={styles.filterChipWrapper} ref={ref}>
      <button
        className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        {active && (
          <span
            className={styles.filterChipClear}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(null);
              setOpen(false);
            }}
          >
            ✕
          </span>
        )}
        <span className={styles.filterChipLabel}>{label}</span>
        {active && selectedLabel && (
          <>
            <span className={styles.filterChipDivider}>|</span>
            <span className={styles.filterChipValue}>{selectedLabel}</span>
          </>
        )}
        <svg
          className={`${styles.filterChipArrow} ${open ? styles.filterChipArrowOpen : ''}`}
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
        >
          <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className={styles.filterDropdown}>
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.filterDropdownItem} ${value === opt.value ? styles.filterDropdownItemSelected : ''}`}
              onClick={() => {
                onSelect(value === opt.value ? null : opt.value);
                setOpen(false);
              }}
              type="button"
            >
              {opt.label}
              {value === opt.value && <span className={styles.checkmark}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── URL builder ──────────────────────────────────────────────────────────────
function buildPropertiesUrl(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `/api/properties?${query}` : '/api/properties';
}

// ─── Main content ─────────────────────────────────────────────────────────────
function SearchPageContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q')?.trim() ?? '';

  const [allItems, setAllItems] = useState<PropertyCardData[]>([]);
  const [recommendations, setRecommendations] = useState<PropertyCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & sort states
  const [sortPrice, setSortPrice] = useState<SortPrice>(null);
  const [filterKategori, setFilterKategori] = useState<FilterKategori>(null);
  const [filterCity, setFilterCity] = useState<FilterCity>(null);

  const priceOptions = [
    { label: 'Termurah', value: 'asc' },
    { label: 'Termahal', value: 'desc' },
  ];

  const kategoriOptions: { label: string; value: KategoriType }[] = [
    { label: 'Rumah', value: 'Rumah' },
    { label: 'Apartemen', value: 'Apartemen' },
    { label: 'Kosan', value: 'Kosan' },
  ];

  const cityOptions: { label: string; value: CityType }[] = [
    { label: 'Jakarta', value: 'Jakarta' },
    { label: 'Bandung', value: 'Bandung' },
    { label: 'Yogyakarta', value: 'Yogyakarta' },
    { label: 'Semarang', value: 'Semarang' },
    { label: 'Surabaya', value: 'Surabaya' },
  ];

  const hasActiveFilter = sortPrice !== null || filterKategori !== null || filterCity !== null;

  function clearAllFilters() {
    setSortPrice(null);
    setFilterKategori(null);
    setFilterCity(null);
  }

  // Fetch data from API
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setRecommendations([]);

      try {
        if (!q) {
          const res = await fetch(buildPropertiesUrl({ take: 60 }));
          const json = await res.json().catch(() => ({}));
          const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
          if (!cancelled) {
            setAllItems(data.map(mapApiPropertyToCard));
          }
          return;
        }

        const res = await fetch(buildPropertiesUrl({ q, take: 60 }));
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
        const mapped = data.map(mapApiPropertyToCard);

        if (!cancelled) {
          setAllItems(mapped);
        }

        // Fetch recommendations only if no results at all (before client filters)
        if (mapped.length === 0) {
          const detectedCategory = detectCategory(q);
          const recRes = await fetch(
            buildPropertiesUrl({ kategori: detectedCategory ?? undefined, take: 6 }),
          );
          const recJson = await recRes.json().catch(() => ({}));
          const recData = Array.isArray(recJson.data) ? (recJson.data as ApiProperty[]) : [];
          if (!cancelled) {
            setRecommendations(recData.map(mapApiPropertyToCard));
          }
        }
      } catch {
        if (!cancelled) {
          setError('Gagal memuat pencarian.');
          setAllItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => { cancelled = true; };
  }, [q]);

  // Client-side filter + sort on top of fetched data
  const filteredItems = useMemo(() => {
    let result = [...allItems];

    // Filter by city
    if (filterCity) {
      result = result.filter((p) => matchesCity(p.lokasi ?? '', filterCity));
    }

    // Filter by kategori
    if (filterKategori) {
      result = result.filter((p) => p.kategori === filterKategori);
    }

    // Sort by price
    if (sortPrice) {
      result.sort((a, b) => {
        const diff = parsePrice(String(a.price)) - parsePrice(String(b.price));
        return sortPrice === 'asc' ? diff : -diff;
      });
    }

    return result;
  }, [allItems, filterCity, filterKategori, sortPrice]);

  // Show "no results" only if API also returned nothing (recommendations are API-based)
  const apiReturnedEmpty = !isLoading && !error && allItems.length === 0 && q !== '';

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.contentArea}>
        <div className={styles.container}>
          <h1 className={styles.title}>Hasil Pencarian</h1>
          <p className={styles.subtitle}>
            {q ? `Menampilkan hasil untuk "${q}"` : 'Masukkan kata kunci di search bar.'}
          </p>

          {/* ── Filter bar ── */}
          <div className={styles.filterBar}>
            <FilterDropdown
              label="Harga"
              value={sortPrice}
              options={priceOptions}
              onSelect={(v) => setSortPrice(v as SortPrice)}
              active={sortPrice !== null}
            />
            <FilterDropdown
              label="Lokasi"
              value={filterCity}
              options={cityOptions}
              onSelect={(v) => setFilterCity(v as FilterCity)}
              active={filterCity !== null}
            />
            <FilterDropdown
              label="Jenis Properti"
              value={filterKategori}
              options={kategoriOptions}
              onSelect={(v) => setFilterKategori(v as FilterKategori)}
              active={filterKategori !== null}
            />
            {hasActiveFilter && (
              <button className={styles.clearAllBtn} onClick={clearAllFilters} type="button">
                Hapus semua
              </button>
            )}
          </div>

          {isLoading ? (
            <div className={styles.emptyState}>Memuat pencarian...</div>
          ) : error ? (
            <div className={styles.emptyState}>{error}</div>
          ) : apiReturnedEmpty ? (
            <>
              <div className={styles.emptyState}>
                Properti yang kamu cari tidak ada.
                {q ? ` Coba kata kunci lain untuk "${q}".` : ''}
              </div>

              {recommendations.length > 0 && (
                <section className={styles.recommendationSection}>
                  <h2 className={styles.recommendationTitle}>Rekomendasi properti mirip</h2>
                  <div className={styles.grid}>
                    {recommendations.map((item) => (
                      <Link key={`rec-${item.id}`} href={`/propertyDetail/${item.id}`} className={styles.cardLink}>
                        <article className={styles.card}>
                          <img src={optimizeImage(item.images[0], IMAGE_WIDTH.card)} alt={item.title} className={styles.cardImage} loading="lazy" decoding="async" />
                          <div className={styles.cardBody}>
                            <p className={styles.cardTitle}>{item.title}</p>
                            <p className={styles.cardLocation}>{item.lokasi}</p>
                            <p className={styles.cardPrice}>{formatPrice(item.price)}</p>
                          </div>
                        </article>
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : filteredItems.length === 0 ? (
            <div className={styles.emptyState}>
              Tidak ada properti yang cocok dengan filter yang dipilih.{' '}
              <button className={styles.clearAllBtn} onClick={clearAllFilters} type="button">
                Hapus semua filter
              </button>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredItems.map((item) => (
                <Link key={item.id} href={`/propertyDetail/${item.id}`} className={styles.cardLink}>
                  <article className={styles.card}>
                    <img src={optimizeImage(item.images[0], IMAGE_WIDTH.card)} alt={item.title} className={styles.cardImage} loading="lazy" decoding="async" />
                    <div className={styles.cardBody}>
                      <p className={styles.cardTitle}>{item.title}</p>
                      <p className={styles.cardLocation}>{item.lokasi}</p>
                      <p className={styles.cardPrice}>{formatPrice(item.price)}</p>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className={styles.contentArea}>Memuat pencarian...</main>}>
      <SearchPageContent />
    </Suspense>
  );
}