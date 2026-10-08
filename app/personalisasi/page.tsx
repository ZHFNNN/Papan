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
}

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

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.location.trim()) newErrors.location   = 'Pilih lokasi lewat peta.';
    if (!formData.occupation)      newErrors.occupation = 'Pilih pekerjaan kamu.';
    if (!formData.budget)          newErrors.budget     = 'Pilih range budget kamu.';
    if (!formData.gender)          newErrors.gender     = 'Pilih gender kamu.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/personalisasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
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
                  <div className={`${styles.summaryRow} ${styles.summaryRowLast}`}>
                    <span className={styles.summaryKey}>Fasilitas</span>
                    <span className={styles.summaryVal}>
                      {formData.preferences.length > 0
                        ? `${formData.preferences.length} dipilih`
                        : <span className={styles.summaryValEmpty}>Belum dipilih</span>}
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