'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './page.module.css';

// MapPicker di-import secara lazy supaya Leaflet tidak di-load pas SSR
const MapPicker = lazy(() => import('@/components/MapPicker'));

// ── Tipe data ──────────────────────────────────────────────────────────────
interface FormData {
  location: string;
  locationLat: number | null;
  locationLng: number | null;
  occupation: string;
  budget: string;
  gender: string;
  preferences: string[];
}

interface FormErrors {
  location?: string;
  occupation?: string;
  budget?: string;
  gender?: string;
  priorities?: string;
}

// Prioritas DSS: 3 kriteria disusun ke 3 tingkat (masing-masing tingkat diisi 1 kriteria)
type CriteriaKey  = 'budget' | 'location' | 'facilities';
type PriorityTier = 'high' | 'medium' | 'low';
type PriorityRanking = Record<PriorityTier, CriteriaKey | null>;

// ── Opsi pilihan ───────────────────────────────────────────────────────────
const OCCUPATIONS = ['Mahasiswa', 'Karyawan', 'Wiraswasta', 'Freelancer', 'Lainnya'];
const BUDGETS     = ['0 - 2 juta', '2 - 4 juta', '4 - 6 juta', '6 - 8 juta', '8 juta+'];
const GENDERS     = ['Laki-laki', 'Perempuan'];
const PREFERENCES = [
  'Furnished',
  'Unfurnished',
  'Pet-friendly',
  'Parkir Mobil',
  'AC',
  'Water Heater',
  'Dekat transportasi umum',
];

const CRITERIA: { key: CriteriaKey; label: string; icon: string }[] = [
  { key: 'budget',     label: 'Budget',    icon: '💰' },
  { key: 'location',   label: 'Lokasi',    icon: '📍' },
  { key: 'facilities', label: 'Fasilitas', icon: '🛋️' },
];

// level dikirim ke API: 3 = paling penting, 2 = penting, 1 = biasa saja
const PRIORITY_TIERS: { tier: PriorityTier; label: string; hint: string; level: number; dots: string }[] = [
  { tier: 'high',   label: 'Paling penting', hint: 'Jadi pertimbangan utama',   level: 3, dots: '●●●' },
  { tier: 'medium', label: 'Penting',        hint: 'Cukup dipertimbangkan',     level: 2, dots: '●●○' },
  { tier: 'low',    label: 'Biasa saja',     hint: 'Tidak terlalu berpengaruh', level: 1, dots: '●○○' },
];

const criteriaLabel = (key: CriteriaKey) => CRITERIA.find((c) => c.key === key)?.label ?? key;

export default function PersonalisasiPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push(`/login?callbackUrl=${encodeURIComponent('/personalisasi')}`);
    }
  }, [status, router]);

  const [formData, setFormData] = useState<FormData>({
    location:    '',
    locationLat: null,
    locationLng: null,
    occupation:  'Mahasiswa',
    budget:      '0 - 2 juta',
    gender:      'Laki-laki',
    preferences: [],
  });

  const mapEmbedSrc = `https://maps.google.com/maps?q=${formData.locationLat ?? -2.5},${formData.locationLng ?? 118}&z=${formData.locationLat && formData.locationLng ? 15 : 5}&output=embed`;

  const [ranking, setRanking]                 = useState<PriorityRanking>({ high: null, medium: null, low: null });
  const [selectedCriteria, setSelectedCriteria] = useState<CriteriaKey | null>(null);
  const [dragOverZone, setDragOverZone]         = useState<PriorityTier | 'pool' | null>(null);
  const [errors, setErrors]                     = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const [isSkipping, setIsSkipping]             = useState(false);
  const [submitError, setSubmitError]           = useState<string | null>(null);
  const [showMap, setShowMap]                   = useState(false);
  const [isOccupationOpen, setIsOccupationOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen]         = useState(false);
  const occupationDropdownRef = useRef<HTMLDivElement | null>(null);
  const budgetDropdownRef     = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (occupationDropdownRef.current && !occupationDropdownRef.current.contains(event.target as Node)) {
        setIsOccupationOpen(false);
      }
      if (budgetDropdownRef.current && !budgetDropdownRef.current.contains(event.target as Node)) {
        setIsBudgetOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLocationPicked = (loc: {
    displayName: string;
    city: string;
    district: string;
    neighbourhood: string;
    lat: number;
    lng: number;
  }) => {
    const parts = [loc.neighbourhood, loc.district, loc.city].filter(Boolean);
    const shortName = parts.join(', ') || loc.displayName;
    setFormData((prev) => ({ ...prev, location: shortName, locationLat: loc.lat, locationLng: loc.lng }));
    setErrors((prev) => ({ ...prev, location: undefined }));
  };

  const handleTogglePreference = (pref: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref],
    }));
  };

  // ── Prioritas DSS ────────────────────────────────────────────────────────
  const tierOf = (key: CriteriaKey): PriorityTier | null =>
    (Object.keys(ranking) as PriorityTier[]).find((t) => ranking[t] === key) ?? null;

  const unassignedCriteria = CRITERIA.filter((c) => tierOf(c.key) === null);

  const placeCriteria = (key: CriteriaKey, target: PriorityTier) => {
    setRanking((prev) => {
      const next = { ...prev };
      const from = (Object.keys(prev) as PriorityTier[]).find((t) => prev[t] === key) ?? null;
      const displaced = prev[target];
      if (from) next[from] = displaced; // tukar posisi kalau tingkat tujuan sudah terisi
      next[target] = key;
      return next;
    });
    setSelectedCriteria(null);
    setErrors((prev) => ({ ...prev, priorities: undefined }));
  };

  const unplaceCriteria = (key: CriteriaKey) => {
    setRanking((prev) => {
      const next = { ...prev };
      (Object.keys(next) as PriorityTier[]).forEach((t) => {
        if (next[t] === key) next[t] = null;
      });
      return next;
    });
    setSelectedCriteria(null);
  };

  const handleChipClick = (key: CriteriaKey) => {
    const tier = tierOf(key);
    // kalau ada kriteria lain yang sedang dipilih dan chip ini ada di slot → tukar
    if (selectedCriteria && selectedCriteria !== key && tier) {
      placeCriteria(selectedCriteria, tier);
      return;
    }
    setSelectedCriteria((prev) => (prev === key ? null : key));
  };

  const handleDragStart = (e: React.DragEvent<HTMLButtonElement>, key: CriteriaKey) => {
    e.dataTransfer.setData('text/plain', key);
    e.dataTransfer.effectAllowed = 'move';
    setSelectedCriteria(null);
  };

  const readDraggedKey = (e: React.DragEvent): CriteriaKey | null => {
    const raw = e.dataTransfer.getData('text/plain');
    return CRITERIA.some((c) => c.key === raw) ? (raw as CriteriaKey) : null;
  };

  const handleDropOnTier = (e: React.DragEvent, tier: PriorityTier) => {
    e.preventDefault();
    setDragOverZone(null);
    const key = readDraggedKey(e);
    if (key) placeCriteria(key, tier);
  };

  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverZone(null);
    const key = readDraggedKey(e);
    if (key) unplaceCriteria(key);
  };

  const renderChip = (key: CriteriaKey, inSlot: boolean) => {
    const c = CRITERIA.find((item) => item.key === key)!;
    return (
      <button
        type="button"
        draggable
        onDragStart={(e) => handleDragStart(e, key)}
        onClick={() => handleChipClick(key)}
        aria-pressed={selectedCriteria === key}
        className={`${styles.priorityChip} ${inSlot ? styles.priorityChipInSlot : ''} ${selectedCriteria === key ? styles.priorityChipSelected : ''}`}
      >
        <span aria-hidden="true">{c.icon}</span>
        {c.label}
      </button>
    );
  };

  const prioritySummary = PRIORITY_TIERS
    .map((t) => ranking[t.tier])
    .filter((k): k is CriteriaKey => k !== null)
    .map(criteriaLabel)
    .join(' › ');

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.location.trim()) newErrors.location   = 'Pilih lokasi lewat peta.';
    if (!formData.occupation)      newErrors.occupation = 'Pilih pekerjaan kamu.';
    if (!formData.budget)          newErrors.budget     = 'Pilih range budget kamu.';
    if (!formData.gender)          newErrors.gender     = 'Pilih gender kamu.';
    if (!ranking.high || !ranking.medium || !ranking.low) {
      newErrors.priorities = 'Susun ketiga kriteria ke tingkat Paling penting, Penting, dan Biasa saja.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    // ubah susunan tingkat → { budget, location, facilities } berisi level 1-3
    const priorities = {} as Record<CriteriaKey, number>;
    PRIORITY_TIERS.forEach(({ tier, level }) => {
      const key = ranking[tier];
      if (key) priorities[key] = level;
    });

    try {
      const res = await fetch('/api/personalisasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, priorities }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Gagal menyimpan data.');
      }
      router.push('/');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    setIsSkipping(true);
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgAnim} aria-hidden="true">
        <span className={`${styles.dropCircle} ${styles.dropOne}`} />
        <span className={`${styles.dropCircle} ${styles.dropTwo}`} />
        <span className={`${styles.dropCircle} ${styles.dropThree}`} />
        <span className={`${styles.dropCircle} ${styles.dropFour}`} />
        <span className={`${styles.dropCircle} ${styles.dropFive}`} />
        <span className={`${styles.dropCircle} ${styles.dropSix}`} />
        <span className={`${styles.dropCircle} ${styles.dropSeven}`} />
        <span className={`${styles.dropCircle} ${styles.dropEight}`} />
        <span className={`${styles.dropCircle} ${styles.dropNine}`} />
      </div>

      <div className={styles.wrapper}>

        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Yuk lengkapin data di bawah ini!</h1>
          <p className={styles.subtitle}>
            Properti yang ditampilkan nanti akan menyesuaikan preferensi yang kamu isi disini
          </p>

        </div>

        {/* ── Main Content ── */}
        <div className={styles.cardInner}>

            {/* ── Kolom Kiri: Form ── */}
            <div className={styles.formCol}>

              {/* Section: Profil */}
              <p className={styles.sectionLabel}>Profil kamu</p>

              {/* Pekerjaan + Budget dalam satu baris */}
              <div className={styles.profileRow}>
                {/* Pekerjaan */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Pekerjaan</label>
                  <div ref={occupationDropdownRef} className={styles.occupationDropdown}>
                    <button
                      type="button"
                      className={`${styles.occupationTrigger} ${errors.occupation ? styles.inputError : ''}`}
                      onClick={() => setIsOccupationOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={isOccupationOpen}
                    >
                      <span>{formData.occupation}</span>
                      <span className={`${styles.occupationChevron} ${isOccupationOpen ? styles.occupationChevronOpen : ''}`}>▾</span>
                    </button>
                    {isOccupationOpen && (
                      <ul className={styles.occupationMenu} role="listbox">
                        {OCCUPATIONS.map((occ) => (
                          <li key={occ}>
                            <button
                              type="button"
                              className={`${styles.occupationOption} ${formData.occupation === occ ? styles.occupationOptionActive : ''}`}
                              onClick={() => {
                                setFormData({ ...formData, occupation: occ });
                                setErrors((prev) => ({ ...prev, occupation: undefined }));
                                setIsOccupationOpen(false);
                              }}
                            >
                              {occ}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.occupation && <p className={styles.errorText}>{errors.occupation}</p>}
                </div>

                {/* Budget */}
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Budget / bulan</label>
                  <div ref={budgetDropdownRef} className={styles.budgetDropdown}>
                    <button
                      type="button"
                      className={`${styles.budgetTrigger} ${errors.budget ? styles.inputError : ''}`}
                      onClick={() => setIsBudgetOpen((prev) => !prev)}
                      aria-haspopup="listbox"
                      aria-expanded={isBudgetOpen}
                    >
                      <span>{formData.budget}</span>
                      <span className={`${styles.budgetChevron} ${isBudgetOpen ? styles.budgetChevronOpen : ''}`}>▾</span>
                    </button>
                    {isBudgetOpen && (
                      <ul className={styles.budgetMenu} role="listbox">
                        {BUDGETS.map((b) => (
                          <li key={b}>
                            <button
                              type="button"
                              className={`${styles.budgetOption} ${formData.budget === b ? styles.budgetOptionActive : ''}`}
                              onClick={() => {
                                setFormData({ ...formData, budget: b });
                                setErrors((prev) => ({ ...prev, budget: undefined }));
                                setIsBudgetOpen(false);
                              }}
                            >
                              {b}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {errors.budget && <p className={styles.errorText}>{errors.budget}</p>}
                </div>
              </div>

              {/* Gender */}
              <p className={styles.sectionLabel}>Gender</p>
              <div className={styles.fieldGroup}>
                <div className={styles.genderGroup}>
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: g })}
                      className={`${styles.genderBtn} ${formData.gender === g ? styles.genderBtnActive : styles.genderBtnInactive}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className={styles.errorText}>{errors.gender}</p>}
              </div>

              {/* Preferensi */}
              <p className={styles.sectionLabel}>Preferensi fasilitas</p>
              <div className={styles.fieldGroup}>
                <div className={styles.prefGrid}>
                  {PREFERENCES.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => handleTogglePreference(pref)}
                      className={`${styles.prefBtn} ${formData.preferences.includes(pref) ? styles.prefBtnActive : styles.prefBtnInactive}`}
                    >
                      {formData.preferences.includes(pref) && <span className={styles.prefCheck}>✓</span>}
                      {pref}
                    </button>
                  ))}
                </div>
              </div>

              {/* Prioritas */}
              <p className={styles.sectionLabel}>Prioritas pencarian</p>
              <div className={styles.fieldGroup}>
                <p className={styles.priorityHint}>
                  {selectedCriteria
                    ? `Sekarang klik tingkat prioritas untuk "${criteriaLabel(selectedCriteria)}".`
                    : 'Klik kriteria lalu klik tingkatnya, atau seret langsung ke kotak prioritas.'}
                </p>

                {/* Kriteria yang belum diprioritaskan */}
                <div
                  className={`${styles.priorityPool} ${dragOverZone === 'pool' ? styles.priorityPoolOver : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOverZone('pool'); }}
                  onDragLeave={() => setDragOverZone(null)}
                  onDrop={handleDropOnPool}
                >
                  {unassignedCriteria.length > 0
                    ? unassignedCriteria.map((c) => <span key={c.key}>{renderChip(c.key, false)}</span>)
                    : <span className={styles.priorityPoolEmpty}>Semua kriteria sudah diprioritaskan ✓</span>}
                </div>

                {/* 3 tingkat prioritas */}
                <div className={styles.priorityTiers}>
                  {PRIORITY_TIERS.map(({ tier, label, hint, dots }) => {
                    const occupant = ranking[tier];
                    return (
                      <div key={tier} className={styles.priorityTier}>
                        <div className={styles.priorityTierInfo}>
                          <span className={styles.priorityTierLabel}>
                            <span className={styles.priorityDots} aria-hidden="true">{dots}</span> {label}
                          </span>
                          <span className={styles.priorityTierHint}>{hint}</span>
                        </div>
                        <div
                          className={[
                            styles.prioritySlot,
                            occupant ? styles.prioritySlotFilled : '',
                            dragOverZone === tier ? styles.prioritySlotOver : '',
                            errors.priorities && !occupant ? styles.prioritySlotError : '',
                          ].join(' ')}
                          onDragOver={(e) => { e.preventDefault(); setDragOverZone(tier); }}
                          onDragLeave={() => setDragOverZone(null)}
                          onDrop={(e) => handleDropOnTier(e, tier)}
                        >
                          {occupant ? (
                            <>
                              {renderChip(occupant, true)}
                              <button
                                type="button"
                                className={styles.priorityRemoveBtn}
                                onClick={() => unplaceCriteria(occupant)}
                                aria-label={`Lepas ${criteriaLabel(occupant)} dari ${label}`}
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className={`${styles.prioritySlotPlaceholder} ${selectedCriteria ? styles.prioritySlotPlaceholderReady : ''}`}
                              onClick={() => { if (selectedCriteria) placeCriteria(selectedCriteria, tier); }}
                            >
                              {selectedCriteria ? `Taruh ${criteriaLabel(selectedCriteria)} di sini` : 'Kosong — pilih atau seret kriteria ke sini'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {errors.priorities && <p className={styles.errorText}>{errors.priorities}</p>}
              </div>
            </div>

            {/* ── Kolom Kanan: Map + Summary ── */}
            <div className={styles.illustrationCol}>
              <div className={styles.illustrationWrapper}>

                {/* Lokasi */}
                <p className={styles.sectionLabelRight}>Lokasi yang ingin dipilih</p>
                <div className={styles.fieldGroup}>
                  <div
                    className={`${styles.locationInput} ${errors.location ? styles.locationInputError : ''}`}
                    onClick={() => setShowMap(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') setShowMap(true); }}
                  >
                    {formData.location ? (
                      <>
                        <span className={styles.locationIconSmall}>📍</span>
                        <span className={styles.locationValue}>{formData.location}</span>
                        <button
                          className={styles.changeLocationBtn}
                          onClick={(e) => { e.stopPropagation(); setShowMap(true); }}
                        >
                          Ganti
                        </button>
                      </>
                    ) : (
                      <>
                        <div className={styles.locationIconCircle}>📍</div>
                        <div className={styles.locationInputText}>
                          <span className={styles.locationPlaceholder}>Pilih titik lokasi di peta</span>
                          <span className={styles.locationSubPlaceholder}>Klik untuk membuka peta interaktif</span>
                        </div>
                        <span className={styles.mapArrow}>→</span>
                      </>
                    )}
                  </div>
                  {errors.location && <p className={styles.errorText}>{errors.location}</p>}
                </div>

                {/* Map preview */}
                <iframe
                  title="Map preview lokasi preferensi"
                  src={mapEmbedSrc}
                  className={styles.mapPreviewFrame}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />

                {/* Summary card */}
                <div className={styles.summaryCard}>
                  <p className={styles.summaryTitle}>Ringkasan pilihanmu</p>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryKey}>Pekerjaan</span>
                    <span className={styles.summaryVal}>{formData.occupation || '—'}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryKey}>Budget</span>
                    <span className={styles.summaryVal}>{formData.budget || '—'}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryKey}>Gender</span>
                    <span className={styles.summaryVal}>{formData.gender || '—'}</span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryKey}>Lokasi</span>
                    <span className={`${styles.summaryVal} ${!formData.location ? styles.summaryValEmpty : ''}`}>
                      {formData.location || 'Belum dipilih'}
                    </span>
                  </div>
                  <div className={styles.summaryRow}>
                    <span className={styles.summaryKey}>Fasilitas</span>
                    <span className={styles.summaryVal}>
                      {formData.preferences.length > 0
                        ? `${formData.preferences.length} dipilih`
                        : <span className={styles.summaryValEmpty}>Belum dipilih</span>}
                    </span>
                  </div>
                  <div className={`${styles.summaryRow} ${styles.summaryRowLast}`}>
                    <span className={styles.summaryKey}>Prioritas</span>
                    <span className={`${styles.summaryVal} ${!prioritySummary ? styles.summaryValEmpty : ''}`}>
                      {prioritySummary || 'Belum diatur'}
                    </span>
                  </div>
                </div>

              </div>
            </div>

        </div>

        {/* ── Error Banner ── */}
        {submitError && (
          <div className={styles.errorBanner}>⚠️ {submitError}</div>
        )}

        {/* ── Action Buttons ── */}
        <div className={styles.actions}>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSkipping || isSubmitting}
            className={styles.skipBtn}
          >
            {isSkipping ? 'Mengalihkan...' : 'Skip'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isSkipping}
            className={styles.submitBtn}
          >
            {isSubmitting ? (
              <span className={styles.submittingInner}>
                <span className={styles.btnSpinner} />
                Menyimpan...
              </span>
            ) : 'Selesai'}
          </button>
        </div>

        <p className={styles.footerNote}>
          😆 Tenang aja, kamu bisa ubah preferensi ini di halaman Profil! 😆
        </p>

      </div>

      {/* ── Map Picker Modal ── */}
      {showMap && (
        <Suspense fallback={
          <div className={styles.mapLoadingOverlay}>
            <div className={styles.mapLoadingSpinner} />
            <p>Memuat peta...</p>
          </div>
        }>
          <MapPicker
            onLocationPicked={handleLocationPicked}
            onClose={() => setShowMap(false)}
          />
        </Suspense>
      )}
    </div>
  );
}