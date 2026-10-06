'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import type { PickedLocation } from '@/components/MapPicker';

const MapPicker = lazy(() => import('@/components/MapPicker'));

type ListingType = 'JUAL' | 'SEWA' | '';
type PropertyCategory = 'RUMAH' | 'APARTEMEN' | 'KOSAN' | '';

type FormData = {
  title: string;
  address: string;
  locationLat: number | null;
  locationLng: number | null;
  locationCity: string;
  locationDistrict: string;
  locationNeighbourhood: string;
  price: string;
  description: string;
  listingType: ListingType;
  category: PropertyCategory;
  facilities: string[];
};

type FormErrors = Partial<Record<keyof FormData, string>>;

type FacilityOption = {
  code: string;
  name: string;
};

const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'JUAL', label: 'Dijual' },
  { value: 'SEWA', label: 'Disewa' },
];

const CATEGORY_OPTIONS: { value: PropertyCategory; label: string }[] = [
  { value: 'RUMAH', label: 'Rumah' },
  { value: 'APARTEMEN', label: 'Apartemen' },
  { value: 'KOSAN', label: 'Kosan' },
];

export default function AddPropertyPage() {
  const router = useRouter();
  const [form, setForm] = useState<FormData>({
    title: '',
    address: '',
    locationLat: null,
    locationLng: null,
    locationCity: '',
    locationDistrict: '',
    locationNeighbourhood: '',
    price: '',
    description: '',
    listingType: '',
    category: '',
    facilities: [],
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [facilityLoadError, setFacilityLoadError] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [customFacility, setCustomFacility] = useState('');
  const [customFacilities, setCustomFacilities] = useState<string[]>([]);

  const uploadPhotosToCloudinary = async (files: File[]) => {
    const uploadedUrls: string[] = [];

    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/uploads/property', {
        method: 'POST',
        body: formData,
      });

      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(uploadJson.message ?? 'Gagal upload foto properti.');
      }

      const url = typeof uploadJson?.data?.url === 'string' ? uploadJson.data.url : '';
      if (!url) {
        throw new Error('URL foto dari Cloudinary tidak valid.');
      }

      uploadedUrls.push(url);
    }

    return uploadedUrls;
  };

  useEffect(() => {
    let cancelled = false;

    const loadFacilities = async () => {
      setIsLoadingFacilities(true);
      setFacilityLoadError(null);

      try {
        const res = await fetch('/api/facilities');
        const json = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(json.message ?? 'Gagal memuat daftar fasilitas.');
        }

        const data = Array.isArray(json.data) ? (json.data as FacilityOption[]) : [];
        if (!cancelled) {
          setFacilityOptions(data);
        }
      } catch (err) {
        if (!cancelled) {
          setFacilityLoadError(err instanceof Error ? err.message : 'Gagal memuat daftar fasilitas.');
        }
      } finally {
        if (!cancelled) {
          setIsLoadingFacilities(false);
        }
      }
    };

    loadFacilities();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const toggleFacility = (code: string) => {
    setForm((prev) => {
      const selected = prev.facilities.includes(code);
      return {
        ...prev,
        facilities: selected
          ? prev.facilities.filter((item) => item !== code)
          : [...prev.facilities, code],
      };
    });
  };

  const handleLocationPicked = (loc: PickedLocation) => {
    const parts = [loc.neighbourhood, loc.district, loc.city].filter(Boolean);
    const shortName = parts.join(', ') || loc.displayName;

    setForm((prev) => ({
      ...prev,
      address: shortName,
      locationLat: loc.lat,
      locationLng: loc.lng,
      locationCity: loc.city,
      locationDistrict: loc.district,
      locationNeighbourhood: loc.neighbourhood,
    }));

    setErrors((prev) => ({ ...prev, address: undefined }));
  };

  const appendPhotoFiles = (files: File[]) => {
    if (!files.length) return;
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (!validFiles.length) return;
    const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
    setPhotos((prev) => [...prev, ...validFiles]);
    setPhotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    appendPhotoFiles(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    appendPhotoFiles(files);
  };

  const handleRemovePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.title.trim()) newErrors.title = 'Nama properti wajib diisi.';
    if (!form.address.trim() || form.locationLat == null || form.locationLng == null) {
      newErrors.address = 'Lokasi wajib dipilih lewat peta.';
    }
    if (!form.price.trim()) newErrors.price = 'Harga wajib diisi.';
    else if (isNaN(Number(form.price.replace(/[^0-9]/g, '')))) newErrors.price = 'Harga harus berupa angka.';
    if (!form.description.trim()) newErrors.description = 'Deskripsi wajib diisi.';
    if (!form.listingType) newErrors.listingType = 'Tipe listing wajib dipilih.';
    if (!form.category) newErrors.category = 'Kategori properti wajib dipilih.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const priceNum = Number(form.price.replace(/[^0-9]/g, ''));
      const uploadedPhotoUrls = photos.length > 0 ? await uploadPhotosToCloudinary(photos) : [];

      // NOTE: Buat API route POST /api/owner/properties
      const res = await fetch('/api/owner/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          price: priceNum,
          listingType: form.listingType,
          category: form.category,
          address: form.address,
          location: {
            lat: form.locationLat,
            lng: form.locationLng,
            city: form.locationCity,
            district: form.locationDistrict,
            neighbourhood: form.locationNeighbourhood,
          },
          imageUrls: uploadedPhotoUrls,
          facilities: form.facilities,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message ?? 'Gagal menambahkan properti.');
      }

      router.push('/owner/dashboard');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPrice = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    if (!num) return '';
    return Number(num).toLocaleString('id-ID');
  };

  return (
    <div className={styles.contentArea}>
        <div className={styles.header}>
          <h1 className={styles.pageTitle}>Tambah Properti</h1>
        </div>

        <div className={styles.formCard}>
          {/* ── Kiri: Form Fields ── */}
          <div className={styles.formLeft}>
            {/* Nama Properti */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Nama Properti</label>
              <input
                className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                placeholder="Masukkan nama properti"
                value={form.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
              {errors.title && <p className={styles.errorText}>{errors.title}</p>}
            </div>

            {/* Alamat */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Lokasi Properti</label>
              <div
                className={`${styles.locationInput} ${errors.address ? styles.inputError : ''}`}
                onClick={() => setShowMap(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowMap(true);
                  }
                }}
              >
                {form.address ? (
                  <>
                    <span className={styles.locationIcon}>📍</span>
                    <span className={styles.locationValue}>{form.address}</span>
                    <button
                      type="button"
                      className={styles.changeLocationBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMap(true);
                      }}
                    >
                      Ganti
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.locationPlaceholder}>Pilih lokasi di peta...</span>
                    <span className={styles.locationArrow}>→</span>
                  </>
                )}
              </div>
              {errors.address && <p className={styles.errorText}>{errors.address}</p>}
            </div>

            {/* Kategori Properti */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Kategori Properti</label>
              <div className={styles.listingTypeGroup}>
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('category', opt.value)}
                    className={`${styles.listingTypeBtn} ${form.category === opt.value ? styles.listingTypeBtnActive : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.category && <p className={styles.errorText}>{errors.category}</p>}
            </div>

            {/* Tipe Listing */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Tipe Listing</label>
              <div className={styles.listingTypeGroup}>
                {LISTING_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleChange('listingType', opt.value)}
                    className={`${styles.listingTypeBtn} ${form.listingType === opt.value ? styles.listingTypeBtnActive : ''}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {errors.listingType && <p className={styles.errorText}>{errors.listingType}</p>}
            </div>

            {/* Harga */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Harga</label>
              <div className={styles.priceWrapper}>
                <span className={styles.pricePrefix}>Rp</span>
                <input
                  className={`${styles.input} ${styles.priceInput} ${errors.price ? styles.inputError : ''}`}
                  placeholder="0"
                  value={formatPrice(form.price)}
                  onChange={(e) => handleChange('price', e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
              {errors.price && <p className={styles.errorText}>{errors.price}</p>}
            </div>

            {/* Deskripsi */}
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Deskripsi</label>
              <textarea
                className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
                placeholder="Masukkan deskripsi properti"
                rows={4}
                value={form.description}
                onChange={(e) => handleChange('description', e.target.value)}
              />
              {errors.description && <p className={styles.errorText}>{errors.description}</p>}
            </div>

            {/* Fasilitas */}
            <div className={styles.fieldGroup}>
            <label className={styles.label}>Fasilitas</label>
            {isLoadingFacilities ? (
              <p className={styles.facilityHint}>Memuat daftar fasilitas...</p>
            ) : facilityLoadError ? (
              <p className={styles.errorText}>{facilityLoadError}</p>
            ) : (
              <div className={styles.facilityOptionGrid}>
                {/* Preset facilities */}
                {facilityOptions.map((facility) => {
                  const selected = form.facilities.includes(facility.code);
                  return (
                    <button
                      key={facility.code}
                      type="button"
                      onClick={() => toggleFacility(facility.code)}
                      className={`${styles.facilityOptionBtn} ${selected ? styles.facilityOptionBtnActive : ''}`}
                    >
                      {facility.name}
                    </button>
                  );
                })}

                {/* Custom facilities — tampil di grid yang sama */}
                {customFacilities.map((name) => {
                  const selected = form.facilities.includes(name);
                  return (
                    <div
                      key={name}
                      className={`${styles.facilityOptionBtn} ${selected ? styles.facilityOptionBtnActive : ''}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit' }}
                        onClick={() => toggleFacility(name)}
                      >
                        {name}
                      </button>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit', fontSize: 12 }}
                        onClick={() => {
                          setCustomFacilities((prev) => prev.filter((f) => f !== name));
                          setForm((prev) => ({
                            ...prev,
                            facilities: prev.facilities.filter((f) => f !== name),
                          }));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Input tambah custom */}
            <div className={styles.customFacilityRow}>
              <input
                className={styles.input}
                placeholder="Tambah fasilitas lainnya..."
                value={customFacility}
                onChange={(e) => setCustomFacility(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = customFacility.trim();
                    if (val && !customFacilities.includes(val) && !facilityOptions.some(o => o.name === val)) {
                      setCustomFacilities((prev) => [...prev, val]);
                      setForm((prev) => ({ ...prev, facilities: [...prev.facilities, val] }));
                    }
                    setCustomFacility('');
                  }
                }}
              />
              <button
                type="button"
                className={styles.listingTypeBtn}
                onClick={() => {
                  const val = customFacility.trim();
                  if (val && !customFacilities.includes(val) && !facilityOptions.some(o => o.name === val)) {
                    setCustomFacilities((prev) => [...prev, val]);
                    setForm((prev) => ({ ...prev, facilities: [...prev.facilities, val] }));
                  }
                  setCustomFacility('');
                }}
              >
                + Tambah
              </button>
            </div>
          </div>
          </div>

          {/* ── Kanan: Upload Foto ── */}
          <div className={styles.formRight}>
            <label className={styles.label}>Upload Foto-foto Properti</label>
            <label
              className={`${styles.uploadArea} ${isDragOver ? styles.uploadAreaDragOver : ''}`}
              htmlFor="photo-upload"
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {photoPreviews.length === 0 ? (
                <div className={styles.uploadPlaceholder}>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <p className={styles.uploadText}>Upload Foto Properti</p>
                  <p className={styles.uploadHint}>Klik atau drag & drop</p>
                </div>
              ) : (
                <div className={styles.photoGrid}>
                  {photoPreviews.map((src, i) => (
                    <div key={i} className={styles.photoThumb}>
                      <img src={src} alt={`foto-${i}`} className={styles.thumbImg} />
                      <button
                        type="button"
                        className={styles.removePhotoBtn}
                        onClick={(e) => { e.preventDefault(); handleRemovePhoto(i); }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <div className={styles.addMorePhoto}>
                    <span>+ Tambah</span>
                  </div>
                </div>
              )}
            </label>
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              className={styles.hiddenInput}
              onChange={handlePhotoChange}
            />
            <p className={styles.uploadCount}>
              {photos.length > 0 ? `${photos.length} foto dipilih` : 'Belum ada foto'}
            </p>
          </div>
        </div>

        {/* Error Banner */}
        {submitError && (
          <div className={styles.submitErrorBanner}>
            ⚠️ {submitError}
          </div>
        )}

        {/* Submit */}
        <button
          className={styles.submitBtn}
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className={styles.submittingState}>
              <span className={styles.btnSpinner} />
              Menyimpan...
            </span>
          ) : (
            'Tambah Properti'
          )}
        </button>

        {showMap && (
          <Suspense
            fallback={
              <div className={styles.mapLoadingOverlay}>
                <div className={styles.mapLoadingSpinner} />
                <p>Memuat peta...</p>
              </div>
            }
          >
            <MapPicker
              onLocationPicked={handleLocationPicked}
              onClose={() => setShowMap(false)}
            />
          </Suspense>
        )}
    </div>
  );
}