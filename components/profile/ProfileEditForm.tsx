'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from './ProfileEditForm.module.css';
import { optimizeImage } from '@/lib/image';

const DEFAULT_AVATAR = '/images/ppdefault.png';

type EditForm = {
  name: string;
  username: string;
  phoneNumber: string;
};

type FormErrors = Partial<EditForm>;

type ProfileEditFormProps = {
  /** Halaman profil yang dituju setelah simpan / batal. */
  backHref: string;
  /**
   * true kalau halaman tidak punya layout sendiri (/profile/edit), jadi form ini
   * yang merender Navbar & Footer. /owner/profile/edit sudah dapat dari layout owner.
   */
  standalone?: boolean;
};

export default function ProfileEditForm({ backHref, standalone = false }: ProfileEditFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditForm>({
    name: '',
    username: '',
    phoneNumber: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [avatarPreview, setAvatarPreview] = useState<string>(DEFAULT_AVATAR);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch current profile data untuk prefill form
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (!res.ok) {
          if (res.status === 401) {
            router.push('/login');
            return;
          }
          throw new Error('Gagal memuat profil.');
        }
        const data = await res.json();
        setForm({
          name: data.name ?? '',
          username: data.username ?? '',
          phoneNumber: data.phoneNumber ?? '',
        });
        const imageValue = typeof data.image === 'string' ? data.image : '';
        setAvatarUrl(imageValue);
        setAvatarPreview(imageValue || DEFAULT_AVATAR);
      } catch (err) {
        setServerError('Tidak dapat memuat data profil.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Nama tidak boleh kosong.';
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Nama minimal 2 karakter.';
    }

    if (!form.username.trim()) {
      newErrors.username = 'Username tidak boleh kosong.';
    } else if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      newErrors.username = 'Username hanya boleh huruf, angka, dan underscore.';
    } else if (form.username.length < 3) {
      newErrors.username = 'Username minimal 3 karakter.';
    }

    if (!form.phoneNumber.trim()) {
      newErrors.phoneNumber = 'Nomor handphone tidak boleh kosong.';
    } else if (!/^(\+62|62|0)[0-9]{8,13}$/.test(form.phoneNumber.replace(/\s/g, ''))) {
      newErrors.phoneNumber = 'Format nomor handphone tidak valid.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error saat user mulai mengetik
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    setServerError(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setServerError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, image: avatarUrl }),
      });

      const data = await res.json();

      if (!res.ok) {
        setServerError(data.message || 'Gagal menyimpan perubahan.');
        return;
      }

      setSuccessMsg('Profil berhasil diperbarui!');
      setTimeout(() => {
        router.push(backHref);
      }, 1200);
    } catch (err) {
      setServerError('Terjadi kesalahan jaringan. Coba lagi nanti.');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const fields: { key: keyof EditForm; label: string; placeholder: string; type?: string }[] = [
    { key: 'name', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
    { key: 'username', label: 'Username', placeholder: 'Masukkan username (huruf, angka, _)' },
    { key: 'phoneNumber', label: 'Nomor Handphone', placeholder: '08xx xxxx xxxx', type: 'tel' },
  ];

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setUploadError('Hanya file gambar yang diperbolehkan.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setServerError(null);
    setSuccessMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/uploads/profile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.message || 'Gagal upload foto profil.');
        return;
      }

      const url = data?.data?.url as string | undefined;
      if (!url) {
        setUploadError('Gagal mendapatkan URL foto profil.');
        return;
      }

      setAvatarUrl(url);
      setAvatarPreview(url);
    } catch (err) {
      setUploadError('Terjadi kesalahan saat upload. Coba lagi nanti.');
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={styles.page}>
      {standalone && <Navbar />}

      <div className={styles.contentArea}>
        <div className={styles.container}>
          <button
            className={styles.backBtn}
            onClick={() => router.push(backHref)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
            Kembali ke Profil
          </button>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h1 className={styles.title}>Edit Profil</h1>
              <p className={styles.subtitle}>
                Perbarui informasi akun kamu di sini
              </p>
            </div>

            {isLoading ? (
              <div className={styles.loadingState}>
                <div className={styles.spinner} />
                <p>Memuat data...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className={styles.form} noValidate>
  <div className={styles.formMainLayout}>
    
    {/* BAGIAN KIRI: Khusus Foto */}
    <div className={styles.sideProfile}>
      <div className={styles.avatarBlock}>
        <p className={styles.labelCentered}>Foto Profil</p>
        <button
          type="button"
          className={styles.avatarButtonBig}
          onClick={() => fileInputRef.current?.click()}
        >
          <img
            src={optimizeImage(avatarPreview, 480)}
            alt="Foto profil"
            className={styles.avatarImage}
            onError={() => setAvatarPreview(DEFAULT_AVATAR)}
          />
          <span className={styles.avatarOverlay}>Ubah Foto</span>
        </button>
        <div className={styles.avatarInfoCentered}>
          <p className={styles.avatarNote}>Format JPG/PNG, maks 5MB.</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className={styles.hiddenInput}
          onChange={handleAvatarChange}
          disabled={isUploading}
        />
        {isUploading && <p className={styles.uploadingText}>Mengunggah...</p>}
        {uploadError && <p className={styles.errorMsg}>{uploadError}</p>}
      </div>
    </div>

    {/* BAGIAN KANAN: Input Tulisan */}
    <div className={styles.formFields}>
      {fields.map(({ key, label, placeholder, type }) => (
        <div key={key} className={styles.fieldGroup}>
          <label htmlFor={key} className={styles.label}>{label}</label>
          <input
            id={key}
            name={key}
            type={type ?? 'text'}
            value={form[key]}
            onChange={handleChange}
            placeholder={placeholder}
            className={`${styles.input} ${errors[key] ? styles.inputError : ''}`}
            disabled={isSaving}
          />
          {errors[key] && <p className={styles.errorMsg}>{errors[key]}</p>}
        </div>
      ))}

      {/* Email Readonly */}
      <div className={styles.fieldGroup}>
        <label className={styles.label}>Email</label>
        <div className={styles.readonlyWrapper}>
          <input
            type="email"
            className={`${styles.input} ${styles.inputReadonly}`}
            disabled
            placeholder="Email tidak dapat diubah"
          />
          <span className={styles.readonlyBadge}>Terkunci</span>
        </div>
      </div>
      
      {/* Feedback & Actions pindah ke bawah sini agar sejajar kolom kanan */}
      {serverError && <div className={styles.alertError}>{serverError}</div>}
      {successMsg && <div className={styles.alertSuccess}>{successMsg}</div>}

      <div className={styles.actions}>
        <button type="button" onClick={() => router.push(backHref)} className={styles.cancelBtn}>
          Batal
        </button>
        <button type="submit" className={styles.saveBtn} disabled={isSaving}>
          {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>
    </div>

  </div>
</form>
            )}
          </div>

        </div>
      </div>

      {standalone && <Footer />}
    </div>
  );
}