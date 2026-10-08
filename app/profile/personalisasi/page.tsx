'use client';

import { useState, lazy, Suspense, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Sidebar from '@/components/Sidebar';
import styles from './page.module.css';

// MapPicker di-import secara lazy supaya Leaflet tidak di-load pas SSR
// (Leaflet butuh window/document yang tidak ada di server)
const MapPicker = lazy(() => import('@/components/MapPicker'));

// ── Tipe data ──────────────────────────────────────────────────────────────
interface FormData {
  location: string;        // nama lokasi yang ditampilkan di form
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

const BUDGET_LABEL_MAP: Record<string, string> = {
  '0-2000000': '0 - 2 juta',
  '2000000-4000000': '2 - 4 juta',
  '4000000-6000000': '4 - 6 juta',
  '6000000-8000000': '6 - 8 juta',
};

export default function PersonalisasiPage() {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>({
    location:    '',
    locationLat: null,
    locationLng: null,
    occupation:  'Mahasiswa',
    budget:      '0 - 2 juta',
    gender:      'Laki-laki',
    preferences: [],
  });

  const [errors, setErrors]             = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [submitError, setSubmitError]      = useState<string | null>(null);
  const [showMap, setShowMap]           = useState(false);  // kontrol buka/tutup modal map
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isOccupationOpen, setIsOccupationOpen] = useState(false);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const occupationDropdownRef = useRef<HTMLDivElement | null>(null);
  const budgetDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        occupationDropdownRef.current &&
        !occupationDropdownRef.current.contains(event.target as Node)
      ) {
        setIsOccupationOpen(false);
      }

      if (
        budgetDropdownRef.current &&
        !budgetDropdownRef.current.contains(event.target as Node)
      ) {
        setIsBudgetOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    const loadSavedPersonalization = async () => {
      try {
        const res = await fetch('/api/personalisasi');
        if (!res.ok) return;

        const data = await res.json();
        if (!data) return;

        const budgetKey = `${data.budgetMin ?? ''}-${data.budgetMax ?? ''}`;
        const budgetLabel =
          BUDGET_LABEL_MAP[budgetKey] ??
          ((data.budgetMin ?? 0) >= 8_000_000 ? '8 juta+' : '0 - 2 juta');

        const prefs: string[] = [];
        if (data.prefFurnished) prefs.push('Furnished');
        if (data.prefUnfurnished) prefs.push('Unfurnished');
        if (data.prefPetFriendly) prefs.push('Pet-friendly');
        if (data.prefParkirMobil) prefs.push('Parkir Mobil');
        if (data.prefAc) prefs.push('AC');
        if (data.prefWaterHeater) prefs.push('Water Heater');
        if (data.prefDekatTransportasi) prefs.push('Dekat transportasi umum');

        setFormData((prev) => ({
          ...prev,
          location: data.location ?? prev.location,
          occupation: data.occupation ?? prev.occupation,
          budget: budgetLabel,
          gender: data.gender ?? prev.gender,
          preferences: prefs,
        }));
      } catch {
        // biarkan default form jika gagal fetch
      }
    };

    loadSavedPersonalization();
  }, []);

  // ── Handler: lokasi dipilih dari map ────────────────────────────────────
  // Dipanggil oleh MapPicker lewat prop onLocationPicked
  const handleLocationPicked = (loc: {
    displayName: string;
    city: string;
    district: string;
    neighbourhood: string;
    lat: number;
    lng: number;
  }) => {
    // Format nama lokasi yang ditampilkan di input
    const parts = [loc.neighbourhood, loc.district, loc.city].filter(Boolean);
    const shortName = parts.join(', ') || loc.displayName;

    setFormData((prev) => ({
      ...prev,
      location:    shortName,
      locationLat: loc.lat,
      locationLng: loc.lng,
    }));

    // Hapus error lokasi kalau sudah dipilih
    setErrors((prev) => ({ ...prev, location: undefined }));
  };

  // ── Handler: toggle preferensi ───────────────────────────────────────────
  const handleTogglePreference = (pref: string) => {
    setFormData((prev) => ({
      ...prev,
      preferences: prev.preferences.includes(pref)
        ? prev.preferences.filter((p) => p !== pref)
        : [...prev.preferences, pref],
    }));
  };

  // ── Validasi ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.location.trim()) newErrors.location   = 'Pilih lokasi lewat peta.';
    if (!formData.occupation)      newErrors.occupation = 'Pilih pekerjaan kamu.';
    if (!formData.budget)          newErrors.budget     = 'Pilih range budget kamu.';
    if (!formData.gender)          newErrors.gender     = 'Pilih gender kamu.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Handler: submit form ─────────────────────────────────────────────────
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

  return (
    <div className={styles.page}>
      <Navbar />

      <div className={styles.contentArea}>
        <div className={styles.container}>
          <div className={styles.sidebarArea}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
            />
          </div>

          <div className={styles.mainContent}>
            <div className={styles.wrapper}>

        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <h1 className={styles.title}>Edit personalisasi</h1>
        </div>

        {/* ── Main Card ── */}
        <div className={styles.card}>
          <div className={styles.cardInner}>

            {/* ── Kolom Kiri: Form ── */}
            <div className={styles.formCol}>

              {/* Lokasi — sekarang pakai map picker */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Lokasi yang ingin dipilih:</label>

                {/* Input lokasi — readonly, diisi dari map */}
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
                      <span className={styles.locationPlaceholder}>Pilih lokasi di peta...</span>
                      <span className={styles.mapArrow}>→</span>
                    </>
                  )}
                </div>

                {errors.location && <p className={styles.errorText}>{errors.location}</p>}
              </div>

              {/* Pekerjaan */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Pekerjaan</label>
                <div
                  ref={occupationDropdownRef}
                  className={styles.occupationDropdown}
                >
                  <button
                    type="button"
                    className={`${styles.occupationTrigger} ${errors.occupation ? styles.inputError : ''}`}
                    onClick={() => setIsOccupationOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isOccupationOpen}
                  >
                    <span>{formData.occupation}</span>
                    <span
                      className={`${styles.occupationChevron} ${
                        isOccupationOpen ? styles.occupationChevronOpen : ''
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {isOccupationOpen && (
                    <ul className={styles.occupationMenu} role="listbox">
                      {OCCUPATIONS.map((occ) => (
                        <li key={occ}>
                          <button
                            type="button"
                            className={`${styles.occupationOption} ${
                              formData.occupation === occ ? styles.occupationOptionActive : ''
                            }`}
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
                <label className={styles.label}>Budget</label>
                <div
                  ref={budgetDropdownRef}
                  className={styles.budgetDropdown}
                >
                  <button
                    type="button"
                    className={`${styles.budgetTrigger} ${errors.budget ? styles.inputError : ''}`}
                    onClick={() => setIsBudgetOpen((prev) => !prev)}
                    aria-haspopup="listbox"
                    aria-expanded={isBudgetOpen}
                  >
                    <span>{formData.budget}</span>
                    <span
                      className={`${styles.budgetChevron} ${
                        isBudgetOpen ? styles.budgetChevronOpen : ''
                      }`}
                    >
                      ▾
                    </span>
                  </button>

                  {isBudgetOpen && (
                    <ul className={styles.budgetMenu} role="listbox">
                      {BUDGETS.map((b) => (
                        <li key={b}>
                          <button
                            type="button"
                            className={`${styles.budgetOption} ${
                              formData.budget === b ? styles.budgetOptionActive : ''
                            }`}
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

              {/* Gender */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Gender</label>
                <div className={styles.genderGroup}>
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: g })}
                      className={`${styles.genderBtn} ${
                        formData.gender === g ? styles.genderBtnActive : styles.genderBtnInactive
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                {errors.gender && <p className={styles.errorText}>{errors.gender}</p>}
              </div>

              {/* Preferensi */}
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Preferensi</label>
                <div className={styles.prefGrid}>
                  {PREFERENCES.map((pref) => (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => handleTogglePreference(pref)}
                      className={`${styles.prefBtn} ${
                        formData.preferences.includes(pref)
                          ? styles.prefBtnActive
                          : styles.prefBtnInactive
                      }`}
                    >
                      {formData.preferences.includes(pref)}
                      {pref}
                    </button>
                  ))}
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
            onClick={handleSubmit}
            className={styles.submitBtn}
          >
            {isSubmitting ? (
              <span className={styles.submittingInner}>
                <span className={styles.btnSpinner} />
                Menyimpan...
              </span>
            ) : 'Update Personalisasi'}
          </button>
        </div>
    </div>
    </div>
</div>
</div>

      {/* ── Map Picker Modal ── */}
      {/* Hanya di-render waktu showMap = true, dan lazy supaya Leaflet
          tidak di-load saat SSR */}
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

      <Footer />
    </div>
  );
}