'use client';

import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '@/app/owner/addProperty/page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
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

type PropertyResponse = {
  message?: string;
  title?: string;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  neighbourhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: string | number;
  description?: string | null;
  listingType?: string;
  category?: string;
  imageUrls?: string[];
  facilities?: Array<{ facility?: { code?: string; name?: string } }>;
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

function normalizeCategory(value: unknown): PropertyCategory {
  if (typeof value !== 'string') return '';
  switch (value.trim().toUpperCase()) {
    case 'RUMAH':     return 'RUMAH';
    case 'APARTEMEN': return 'APARTEMEN';
    case 'KOSAN':     return 'KOSAN';
    default:          return '';
  }
}

function normalizeListingType(value: unknown): ListingType {
  if (typeof value !== 'string') return '';
  switch (value.trim().toUpperCase()) {
    case 'JUAL':
    case 'SELL': return 'JUAL';
    case 'SEWA':
    case 'RENT': return 'SEWA';
    default:     return '';
  }
}

function listingTypeToApi(value: ListingType): string {
  switch (value) {
    case 'JUAL': return 'SELL';
    case 'SEWA': return 'RENT';
    default:     return '';
  }
}

function inferCategory(data: PropertyResponse): PropertyCategory {
  const cat = normalizeCategory(data.category);
  if (cat !== '') return cat;
  const lt = typeof data.listingType === 'string' ? data.listingType.trim().toUpperCase() : '';
  if (lt === 'KOSAN') return 'KOSAN';
  return '';
}

export default function EditPropertyPage() {
  const router     = useRouter();
  const params     = useParams<{ id: string }>();
  const propertyId = useMemo(() => String(params?.id ?? ''), [params]);

  const [form, setForm] = useState<FormData>({
    title: '', address: '', locationLat: null, locationLng: null,
    locationCity: '', locationDistrict: '', locationNeighbourhood: '',
    price: '', description: '', listingType: '', category: '', facilities: [],
  });

  const [errors, setErrors]                           = useState<FormErrors>({});
  const [isLoading, setIsLoading]                     = useState(true);
  const [isSubmitting, setIsSubmitting]               = useState(false);
  const [loadError, setLoadError]                     = useState<string | null>(null);
  const [submitError, setSubmitError]                 = useState<string | null>(null);
  const [facilityOptions, setFacilityOptions]         = useState<FacilityOption[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [facilityLoadError, setFacilityLoadError]     = useState<string | null>(null);
  const [showMap, setShowMap]                         = useState(false);
  const [existingImageUrls, setExistingImageUrls]     = useState<string[]>([]);
  const [newPhotos, setNewPhotos]                     = useState<File[]>([]);
  const [newPhotoPreviews, setNewPhotoPreviews]       = useState<string[]>([]);
  const [isDragOver, setIsDragOver]                   = useState(false);
  const [customFacility, setCustomFacility]           = useState('');
  const [customFacilities, setCustomFacilities]       = useState<string[]>([]);

  const uploadPhotosToCloudinary = async (files: File[]) => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fd  = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/uploads/property', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message ?? 'Gagal upload foto properti.');
      const url = typeof json?.data?.url === 'string' ? json.data.url : '';
      if (!url) throw new Error('URL foto dari Cloudinary tidak valid.');
      uploadedUrls.push(url);
    }
    return uploadedUrls;
  };

  // Load fasilitas preset
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoadingFacilities(true);
      setFacilityLoadError(null);
      try {
        const res  = await fetch('/api/facilities');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.message ?? 'Gagal memuat daftar fasilitas.');
        if (!cancelled) setFacilityOptions(Array.isArray(json.data) ? json.data : []);
      } catch (err) {
        if (!cancelled) setFacilityLoadError(err instanceof Error ? err.message : 'Gagal memuat fasilitas.');
      } finally {
        if (!cancelled) setIsLoadingFacilities(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Load data properti
  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const res  = await fetch(`/api/owner/properties/${propertyId}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as PropertyResponse;
        if (!res.ok) throw new Error(data.message ?? 'Gagal memuat properti.');
        if (cancelled) return;

        const addressFromParts = [data.neighbourhood, data.district, data.city]
          .filter((v) => Boolean(v?.trim()))
          .join(', ');

        // Pisahkan facilities: mana yang code preset, mana yang custom (code-nya prefix custom_)
        const allFacilityCodes: string[] = Array.isArray(data.facilities)
          ? data.facilities
              .map((item) => item?.facility?.code)
              .filter((code): code is string => typeof code === 'string' && code.length > 0)
          : [];

        // Fetch semua facility preset untuk mengetahui code-nya
        const res2    = await fetch('/api/facilities');
        const json2   = await res2.json().catch(() => ({}));
        const presets: FacilityOption[] = Array.isArray(json2.data) ? json2.data : [];
        const presetCodes = new Set(presets.map((p) => p.code));

        // Custom = code yang tidak ada di preset
        const loadedCustomCodes = allFacilityCodes.filter((c) => !presetCodes.has(c));
        // Nama custom diambil dari data facilities
        const loadedCustomNames: string[] = [];
        if (Array.isArray(data.facilities)) {
          for (const item of data.facilities) {
            const code = item?.facility?.code ?? '';
            const name = item?.facility?.name ?? '';
            if (code && !presetCodes.has(code) && name) {
              loadedCustomNames.push(name);
            }
          }
        }

        setCustomFacilities(loadedCustomNames);
        setForm({
          title:                 data.title ?? '',
          address:               data.address ?? addressFromParts,
          locationLat:           typeof data.latitude  === 'number' ? data.latitude  : null,
          locationLng:           typeof data.longitude === 'number' ? data.longitude : null,
          locationCity:          data.city          ?? '',
          locationDistrict:      data.district      ?? '',
          locationNeighbourhood: data.neighbourhood ?? '',
          price:                 String(data.price ?? ''),
          description:           data.description ?? '',
          listingType:           normalizeListingType(data.listingType),
          category:              inferCategory(data),
          // Preset codes + custom names (karena backend handle keduanya)
          facilities: [
            ...allFacilityCodes.filter((c) => presetCodes.has(c)),
            ...loadedCustomNames,
          ],
        });
        setExistingImageUrls(Array.isArray(data.imageUrls) ? data.imageUrls : []);
      } catch (err: any) {
        if (!cancelled) setLoadError(err.message ?? 'Gagal memuat properti.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [propertyId]);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleCategoryChange = (value: PropertyCategory) => {
    setForm((prev) => ({ ...prev, category: value }));
    setErrors((prev) => ({ ...prev, category: undefined }));
  };

  const handleListingTypeChange = (value: ListingType) => {
    setForm((prev) => ({ ...prev, listingType: value }));
    setErrors((prev) => ({ ...prev, listingType: undefined }));
  };

  const toggleFacility = (codeOrName: string) => {
    setForm((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(codeOrName)
        ? prev.facilities.filter((c) => c !== codeOrName)
        : [...prev.facilities, codeOrName],
    }));
  };

  const addCustomFacility = () => {
    const val = customFacility.trim();
    if (!val) return;
    if (customFacilities.includes(val)) { setCustomFacility(''); return; }
    if (facilityOptions.some((o) => o.name === val)) { setCustomFacility(''); return; }
    setCustomFacilities((prev) => [...prev, val]);
    setForm((prev) => ({ ...prev, facilities: [...prev.facilities, val] }));
    setCustomFacility('');
  };

  const removeCustomFacility = (name: string) => {
    setCustomFacilities((prev) => prev.filter((f) => f !== name));
    setForm((prev) => ({ ...prev, facilities: prev.facilities.filter((f) => f !== name) }));
  };

  const handleLocationPicked = (loc: PickedLocation) => {
    const parts     = [loc.neighbourhood, loc.district, loc.city].filter(Boolean);
    const shortName = parts.join(', ') || loc.displayName;
    setForm((prev) => ({
      ...prev,
      address:               shortName,
      locationLat:           loc.lat,
      locationLng:           loc.lng,
      locationCity:          loc.city,
      locationDistrict:      loc.district,
      locationNeighbourhood: loc.neighbourhood,
    }));
    setErrors((prev) => ({ ...prev, address: undefined }));
  };

  const appendPhotoFiles = (files: File[]) => {
    const valid = files.filter((f) => f.type.startsWith('image/'));
    if (!valid.length) return;
    setNewPhotos((prev)        => [...prev, ...valid]);
    setNewPhotoPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))]);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => appendPhotoFiles(Array.from(e.target.files ?? []));
  const handleDragOver    = (e: React.DragEvent<HTMLLabelElement>)   => { e.preventDefault(); setIsDragOver(true);  };
  const handleDragLeave   = (e: React.DragEvent<HTMLLabelElement>)   => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop        = (e: React.DragEvent<HTMLLabelElement>)   => { e.preventDefault(); setIsDragOver(false); appendPhotoFiles(Array.from(e.dataTransfer.files ?? [])); };

  const removeExistingImage = (i: number) => setExistingImageUrls((prev) => prev.filter((_, j) => j !== i));
  const removeNewPhoto      = (i: number) => {
    URL.revokeObjectURL(newPhotoPreviews[i]);
    setNewPhotos((prev)        => prev.filter((_, j) => j !== i));
    setNewPhotoPreviews((prev) => prev.filter((_, j) => j !== i));
  };

  useEffect(() => () => { newPhotoPreviews.forEach((u) => URL.revokeObjectURL(u)); }, [newPhotoPreviews]);

  const validate = () => {
    const next: FormErrors = {};
    if (!form.title.trim())      next.title       = 'Nama properti wajib diisi.';
    if (!form.address.trim() || form.locationLat == null || form.locationLng == null)
                                  next.address     = 'Lokasi wajib dipilih lewat peta.';
    if (!form.price.trim())       next.price       = 'Harga wajib diisi.';
    else if (Number.isNaN(Number(form.price.replace(/[^0-9]/g, ''))))
                                  next.price       = 'Harga harus berupa angka.';
    if (!form.description.trim()) next.description = 'Deskripsi wajib diisi.';
    if (!form.listingType)        next.listingType = 'Tipe listing wajib dipilih.';
    if (!form.category)           next.category    = 'Kategori properti wajib dipilih.';
    if (existingImageUrls.length + newPhotos.length === 0)
                                  next.facilities  = 'Minimal harus ada 1 foto properti.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const formatPrice = (val: string) => {
    const num = val.replace(/[^0-9]/g, '');
    return num ? Number(num).toLocaleString('id-ID') : '';
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const uploadedUrls = newPhotos.length > 0 ? await uploadPhotosToCloudinary(newPhotos) : [];
      const allImageUrls = [...existingImageUrls, ...uploadedUrls];

      const res = await fetch(`/api/owner/properties/${propertyId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       form.title,
          description: form.description,
          price:       Number(form.price.replace(/[^0-9]/g, '')),
          listingType: listingTypeToApi(form.listingType),
          category:    form.category,
          address:     form.address,
          location: {
            lat:           form.locationLat,
            lng:           form.locationLng,
            city:          form.locationCity,
            district:      form.locationDistrict,
            neighbourhood: form.locationNeighbourhood,
          },
          imageUrls:  allImageUrls,
          facilities: form.facilities,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? 'Gagal menyimpan perubahan.');
      router.push('/owner/dashboard');
    } catch (err: any) {
      setSubmitError(err.message ?? 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className={styles.contentArea}><p className={styles.facilityHint}>Memuat data properti...</p></div>;
  }

  if (loadError) {
    return <div className={styles.contentArea}><div className={styles.submitErrorBanner}>⚠️ {loadError}</div></div>;
  }

  return (
    <div className={styles.contentArea}>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Edit Properti</h1>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formLeft}>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nama Properti</label>
            <input
              className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Masukkan nama properti"
            />
            {errors.title && <p className={styles.errorText}>{errors.title}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Lokasi Properti</label>
            <div
              className={`${styles.locationInput} ${errors.address ? styles.inputError : ''}`}
              onClick={() => setShowMap(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowMap(true); } }}
            >
              {form.address ? (
                <>
                  <span className={styles.locationIcon}>📍</span>
                  <span className={styles.locationValue}>{form.address}</span>
                  <button type="button" className={styles.changeLocationBtn} onClick={(e) => { e.stopPropagation(); setShowMap(true); }}>Ganti</button>
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

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Kategori Properti</label>
            <div className={styles.listingTypeGroup}>
              {CATEGORY_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => handleCategoryChange(opt.value)}
                  className={`${styles.listingTypeBtn} ${form.category === opt.value ? styles.listingTypeBtnActive : ''}`}
                >{opt.label}</button>
              ))}
            </div>
            {errors.category && <p className={styles.errorText}>{errors.category}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Tipe Listing</label>
            <div className={styles.listingTypeGroup}>
              {LISTING_TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  onClick={() => handleListingTypeChange(opt.value)}
                  className={`${styles.listingTypeBtn} ${form.listingType === opt.value ? styles.listingTypeBtnActive : ''}`}
                >{opt.label}</button>
              ))}
            </div>
            {errors.listingType && <p className={styles.errorText}>{errors.listingType}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Harga</label>
            <div className={styles.priceWrapper}>
              <span className={styles.pricePrefix}>Rp</span>
              <input
                className={`${styles.input} ${styles.priceInput} ${errors.price ? styles.inputError : ''}`}
                value={formatPrice(form.price)}
                onChange={(e) => handleChange('price', e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
              />
            </div>
            {errors.price && <p className={styles.errorText}>{errors.price}</p>}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Deskripsi</label>
            <textarea
              className={`${styles.textarea} ${errors.description ? styles.inputError : ''}`}
              rows={4}
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Masukkan deskripsi properti"
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
                {/* Preset */}
                {facilityOptions.map((facility) => {
                  const selected = form.facilities.includes(facility.code);
                  return (
                    <button key={facility.code} type="button"
                      onClick={() => toggleFacility(facility.code)}
                      className={`${styles.facilityOptionBtn} ${selected ? styles.facilityOptionBtnActive : ''}`}
                    >{facility.name}</button>
                  );
                })}
                {/* Custom — tampil di grid yang sama */}
                {customFacilities.map((name) => {
                  const selected = form.facilities.includes(name);
                  return (
                    <div key={name}
                      className={`${styles.facilityOptionBtn} ${selected ? styles.facilityOptionBtnActive : ''}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                      <button type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', font: 'inherit' }}
                        onClick={() => toggleFacility(name)}
                      >{name}</button>
                      <button type="button"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1, color: 'inherit', fontSize: 12 }}
                        onClick={() => removeCustomFacility(name)}
                      >✕</button>
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
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFacility(); } }}
              />
              <button type="button" className={styles.listingTypeBtn} onClick={addCustomFacility}>
                + Tambah
              </button>
            </div>
            {errors.facilities && <p className={styles.errorText}>{errors.facilities}</p>}
          </div>
        </div>

        {/* Upload Foto */}
        <div className={styles.formRight}>
          <label className={styles.label}>Upload Foto-foto Properti</label>
          <label
            className={`${styles.uploadArea} ${isDragOver ? styles.uploadAreaDragOver : ''}`}
            htmlFor="photo-upload-edit"
            onDragOver={handleDragOver} onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            {existingImageUrls.length + newPhotoPreviews.length === 0 ? (
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
                {existingImageUrls.map((src, i) => (
                  <div key={`existing-${i}`} className={styles.photoThumb}>
                    <img src={optimizeImage(src, IMAGE_WIDTH.thumb * 2)} alt={`existing-${i}`} className={styles.thumbImg} loading="lazy" decoding="async" />
                    <button type="button" className={styles.removePhotoBtn} onClick={(e) => { e.preventDefault(); removeExistingImage(i); }}>×</button>
                  </div>
                ))}
                {newPhotoPreviews.map((src, i) => (
                  <div key={`new-${i}`} className={styles.photoThumb}>
                    <img src={src} alt={`new-${i}`} className={styles.thumbImg} />
                    <button type="button" className={styles.removePhotoBtn} onClick={(e) => { e.preventDefault(); removeNewPhoto(i); }}>×</button>
                  </div>
                ))}
                <div className={styles.addMorePhoto}><span>+ Tambah</span></div>
              </div>
            )}
          </label>
          <input id="photo-upload-edit" type="file" accept="image/*" multiple className={styles.hiddenInput} onChange={handlePhotoChange} />
          <p className={styles.uploadCount}>
            {existingImageUrls.length + newPhotos.length > 0
              ? `${existingImageUrls.length + newPhotos.length} foto dipilih`
              : 'Belum ada foto'}
          </p>
        </div>
      </div>

      {submitError && <div className={styles.submitErrorBanner}>⚠️ {submitError}</div>}

      <button className={styles.submitBtn} onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <span className={styles.submittingState}>
            <span className={styles.btnSpinner} />
            Menyimpan...
          </span>
        ) : 'Simpan Perubahan'}
      </button>

      {showMap && (
        <Suspense fallback={<div className={styles.mapLoadingOverlay}><div className={styles.mapLoadingSpinner} /><p>Memuat peta...</p></div>}>
          <MapPicker onLocationPicked={handleLocationPicked} onClose={() => setShowMap(false)} />
        </Suspense>
      )}
    </div>
  );
}