"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import styles from "./KycVerificationForm.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type KycStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED";

interface Submission {
  nik: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  cityOrRegency: string;
  district: string;
  rt: string;
  rw: string;
  postalCode: string;
  ktpImageUrl: string;
  selfieImageUrl: string;
  adminNotes?: string | null;
  createdAt: string;
}

interface KycStatusResponse {
  kycStatus: KycStatus;
  submission: Submission | null;
}

interface FormState {
  nik: string;
  fullName: string;
  phoneNumber: string;
  province: string;
  cityOrRegency: string;
  district: string;
  rt: string;
  rw: string;
  postalCode: string;
  ktpImageUrl: string;
  selfieImageUrl: string;
}

const EMPTY_FORM: FormState = {
  nik: "", fullName: "", phoneNumber: "",
  province: "", cityOrRegency: "", district: "",
  rt: "", rw: "", postalCode: "",
  ktpImageUrl: "", selfieImageUrl: "",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function KtpIcon() {
  return (
    <svg className={styles.uploadSvg} width="64" height="48" viewBox="0 0 64 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="62" height="46" rx="7" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <circle cx="20" cy="22" r="8" stroke="white" strokeWidth="1.8" strokeOpacity="0.7"/>
      <line x1="33" y1="17" x2="55" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="33" y1="24" x2="55" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
      <line x1="33" y1="31" x2="48" y2="31" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
    </svg>
  );
}

function SelfieIcon() {
  return (
    <svg className={styles.uploadSvg} width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="28" cy="20" r="10" stroke="white" strokeWidth="2" strokeOpacity="0.7"/>
      <path d="M8 48c0-11 9-18 20-18s20 7 20 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
      <rect x="36" y="34" width="16" height="12" rx="3" stroke="white" strokeWidth="1.5" strokeOpacity="0.7"/>
      <line x1="39" y1="37" x2="49" y2="37" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
      <line x1="39" y1="40" x2="49" y2="40" stroke="white" strokeWidth="1.2" strokeOpacity="0.7"/>
    </svg>
  );
}

// ─── Upload Area Component ────────────────────────────────────────────────────

interface UploadAreaProps {
  label: string;
  icon: "ktp" | "selfie";
  subtext: string;
  url: string;
  uploading: boolean;
  readOnly?: boolean;
  error?: string;
  onTrigger: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function UploadArea({ label, icon, subtext, url, uploading, readOnly, error, onTrigger, onDrop, inputRef, onChange }: UploadAreaProps) {
  return (
    <div className={styles.uploadBox}>
      <span className={styles.uploadLabel}>{label}</span>
      <div
        className={`${styles.uploadArea}${readOnly ? ` ${styles.uploadAreaReadOnly}` : ""}${error ? ` ${styles.uploadAreaError}` : ""}`}
        onClick={readOnly ? undefined : onTrigger}
        onDragOver={(e) => e.preventDefault()}
        onDrop={readOnly ? undefined : onDrop}
      >
        {url ? (
          <>
            <img src={url} alt={label} className={styles.uploadPreview} />
            {!readOnly && (
              <button className={styles.changeBtn} onClick={(e) => { e.stopPropagation(); onTrigger(); }}>
                Ganti
              </button>
            )}
          </>
        ) : (
          <div className={styles.uploadPlaceholder}>
            {icon === "ktp" ? <KtpIcon /> : <SelfieIcon />}
            <span className={styles.uploadText}>{subtext}</span>
          </div>
        )}
        {uploading && (
          <div className={styles.uploadingOverlay}>
            <div className={styles.spinner} />
            <span className={styles.uploadingText}>Mengunggah…</span>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onChange} disabled={readOnly} />
      {error && <p className={styles.errorMsg}>{error}</p>}
    </div>
  );
}

// ─── Upload Hook ──────────────────────────────────────────────────────────────

// `ref` = referensi foto yang dikirim saat submit, `previewUrl` = gambar yang ditampilkan.
// Foto KYC bersifat privat, jadi preview memakai file lokal atau /api/kyc/image/*.
function useImageUpload(endpoint: string) {
  const [ref, setRef] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const trigger = () => inputRef.current?.click();

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar."); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error("Ukuran file maksimal 5 MB."); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json() as { message?: string; data?: { ref: string } };
      if (!res.ok) throw new Error(data.message ?? "Upload gagal");
      setRef(data.data?.ref ?? "");
      setPreviewUrl((prev) => {
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return URL.createObjectURL(file);
      });
      toast.success("Foto berhasil diunggah!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setUploading(false);
    }
  }, [endpoint]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = "";
  };

  return { ref, setRef, previewUrl, setPreviewUrl, uploading, trigger, handleFile, onChange, inputRef };
}

// ─── Form ─────────────────────────────────────────────────────────────────────

/**
 * Form verifikasi KYC owner.
 * - /owner/verify       : bisa diisi dan dikirim.
 * - /owner/verifyPage   : `readOnly`, hanya menampilkan data yang sudah dikirim
 *                         (dibuka dari sidebar owner).
 */
export default function KycVerificationForm({ readOnly = false }: { readOnly?: boolean }) {
  const router = useRouter();
  const rootClass = `${styles.root}${readOnly ? ` ${styles.rootReadOnly}` : ""}`;

  const [pageLoading,        setPageLoading]        = useState(true);
  const [kycStatus,          setKycStatus]           = useState<KycStatus>("NONE");
  const [existingSubmission, setExistingSubmission]  = useState<Submission | null>(null);
  const [submitting,         setSubmitting]          = useState(false);
  const [form,               setForm]                = useState<FormState>(EMPTY_FORM);
  const [errors,             setErrors]              = useState<Partial<Record<keyof FormState, string>>>({});

  const ktp    = useImageUpload("/api/uploads/ktp");
  const selfie = useImageUpload("/api/uploads/selfie");

  // Fetch KYC status
  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch("/api/kyc/my-status");
        if (res.status === 401) { router.push("/login"); return; }
        const data = await res.json() as KycStatusResponse;
        setKycStatus(data.kycStatus);
        if (data.submission) {
          setExistingSubmission(data.submission);
          const s = data.submission;
          setForm({ nik: s.nik, fullName: s.fullName, phoneNumber: s.phoneNumber,
            province: s.province, cityOrRegency: s.cityOrRegency, district: s.district,
            rt: s.rt, rw: s.rw, postalCode: s.postalCode,
            ktpImageUrl: s.ktpImageUrl, selfieImageUrl: s.selfieImageUrl });
          ktp.setRef(s.ktpImageUrl);
          selfie.setRef(s.selfieImageUrl);
          ktp.setPreviewUrl("/api/kyc/image/ktp");
          selfie.setPreviewUrl("/api/kyc/image/selfie");
        }
      } catch { toast.error("Gagal memuat status verifikasi."); }
      finally  { setPageLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setForm((p) => ({ ...p, ktpImageUrl:    ktp.ref    })); }, [ktp.ref]);
  useEffect(() => { setForm((p) => ({ ...p, selfieImageUrl: selfie.ref })); }, [selfie.ref]);

  const setField = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: undefined }));
  };

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {};
    if (!/^\d{16}$/.test(form.nik))           errs.nik           = "NIK harus tepat 16 digit.";
    if (form.fullName.trim().length < 3)       errs.fullName      = "Nama minimal 3 karakter.";
    if (form.phoneNumber.trim().length < 8)    errs.phoneNumber   = "Nomor HP minimal 8 karakter.";
    if (form.province.trim().length < 2)       errs.province      = "Provinsi wajib diisi.";
    if (form.cityOrRegency.trim().length < 2)  errs.cityOrRegency = "Kota/Kabupaten wajib diisi.";
    if (form.district.trim().length < 2)       errs.district      = "Kecamatan wajib diisi.";
    if (!/^\d{1,3}$/.test(form.rt))            errs.rt            = "RT tidak valid.";
    if (!/^\d{1,3}$/.test(form.rw))            errs.rw            = "RW tidak valid.";
    if (!/^\d{5}$/.test(form.postalCode))      errs.postalCode    = "Kode pos harus 5 digit.";
    if (!form.ktpImageUrl)                     errs.ktpImageUrl    = "Foto KTP wajib diunggah.";
    if (!form.selfieImageUrl)                  errs.selfieImageUrl = "Selfie wajib diunggah.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { toast.error("Lengkapi semua data terlebih dahulu."); return; }
    setSubmitting(true);
    try {
      const res  = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json() as { message?: string };
      if (!res.ok) throw new Error(data.message ?? "Gagal mengirim data.");
      setKycStatus("PENDING");
      toast.success("Data KYC berhasil dikirim.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Terjadi kesalahan server.");
    } finally {
      setSubmitting(false);
    }
  };

  const makeDrop = (handler: (f: File) => Promise<void>) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void handler(file);
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (pageLoading) {
    return (
      <div className={rootClass}>
        <div className={styles.loadingWrapper}>
          <div className={styles.skeleton} style={{ height: 48 }} />
          <div className={styles.skeleton} style={{ height: 420 }} />
          <div className={styles.skeleton} style={{ height: 56 }} />
        </div>
      </div>
    );
  }

  // ── FORM (ALL STATUS) ─────────────────────────────────────────────────────
  return (
    <div className={rootClass}>
      <div className={styles.inner}>

        {!readOnly && (
          <button className={styles.backBtn} onClick={() => router.back()}>← Kembali</button>
        )}
        <h1 className={styles.pageTitle}>Verifikasi Data Pemilik Properti</h1>

        {kycStatus === "PENDING" && (
          <div className={`${styles.statusBanner} ${styles.pending}`}>
            <div className={styles.statusIcon}>⏳</div>
            <div>
              <p className={styles.statusTitle}>Sedang Ditinjau</p>
              <p className={styles.statusDesc}>
                Pengajuan diterima pada{" "}
                {existingSubmission ? formatDate(existingSubmission.createdAt) : "—"}.
                Proses peninjauan 1×24 jam kerja.
              </p>
            </div>
          </div>
        )}

        {kycStatus === "APPROVED" && (
          <div className={`${styles.statusBanner} ${styles.approved}`}>
            <div className={styles.statusIcon}>✅</div>
            <div>
              <p className={styles.statusTitle}>Akun Sudah Terverifikasi</p>
              <p className={styles.statusDesc}>
                Data terakhirmu tetap ditampilkan di form ini.
              </p>
            </div>
          </div>
        )}

        {readOnly && !existingSubmission && (
          <div className={`${styles.statusBanner} ${styles.pending}`}>
            <div className={styles.statusIcon}>ℹ️</div>
            <div>
              <p className={styles.statusTitle}>Belum Ada Data Verifikasi</p>
              <p className={styles.statusDesc}>Halaman ini hanya menampilkan data yang sudah pernah kamu kirim.</p>
              <button className={styles.gotoVerifyBtn} onClick={() => router.push('/owner/verify')}>
                Isi Verifikasi Sekarang
              </button>
            </div>
          </div>
        )}

        {/* Rejected banner */}
        {kycStatus === "REJECTED" && existingSubmission && (
          <div className={`${styles.statusBanner} ${styles.rejected}`}>
            <div className={styles.statusIcon}>❌</div>
            <div>
              <p className={styles.statusTitle}>Pengajuan Ditolak</p>
              <p className={styles.statusDesc}>Silakan perbaiki data dan coba lagi.</p>
              {existingSubmission.adminNotes && (
                <p className={styles.adminNotes}>
                  <strong>Catatan Admin:</strong> {existingSubmission.adminNotes}
                </p>
              )}
            </div>
          </div>
        )}

        <div className={styles.card}>

          {/* Upload Row */}
          <div className={styles.uploadRow}>
            <UploadArea
              label="Upload KTP" icon="ktp" subtext="Upload Foto KTP"
              url={ktp.previewUrl} uploading={ktp.uploading} error={errors.ktpImageUrl}
              readOnly={readOnly}
              onTrigger={ktp.trigger} onDrop={makeDrop(ktp.handleFile)}
              inputRef={ktp.inputRef} onChange={ktp.onChange}
            />
            <UploadArea
              label="Upload Foto Diri" icon="selfie" subtext={"Upload Foto Diri\nDengan KTP"}
              url={selfie.previewUrl} uploading={selfie.uploading} error={errors.selfieImageUrl}
              readOnly={readOnly}
              onTrigger={selfie.trigger} onDrop={makeDrop(selfie.handleFile)}
              inputRef={selfie.inputRef} onChange={selfie.onChange}
            />
          </div>

          {/* NIK */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="nik">NIK</label>
            <input id="nik" className={`${styles.input}${errors.nik ? ` ${styles.inputError}` : ""}`}
              placeholder="Masukkan NIK sesuai KTP" value={form.nik}
              onChange={setField("nik")} maxLength={16} readOnly={readOnly} />
            {errors.nik && <p className={styles.errorMsg}>{errors.nik}</p>}
          </div>

          {/* Nama Lengkap */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="fullName">Nama Lengkap</label>
            <input id="fullName" className={`${styles.input}${errors.fullName ? ` ${styles.inputError}` : ""}`}
              placeholder="Masukkan nama lengkap sesuai KTP" value={form.fullName}
              onChange={setField("fullName")} readOnly={readOnly} />
            {errors.fullName && <p className={styles.errorMsg}>{errors.fullName}</p>}
          </div>

          {/* Nomor HP — tidak ada di mockup tapi diperlukan API */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="phoneNumber">Nomor HP</label>
            <input id="phoneNumber" className={`${styles.input}${errors.phoneNumber ? ` ${styles.inputError}` : ""}`}
              placeholder="Masukkan nomor HP" value={form.phoneNumber}
              onChange={setField("phoneNumber")} maxLength={20} readOnly={readOnly} />
            {errors.phoneNumber && <p className={styles.errorMsg}>{errors.phoneNumber}</p>}
          </div>

          {/* Alamat Domisili */}
          <div className={styles.fieldGroup}>
            <span className={styles.addressLabel}>Alamat Domisili</span>
            <div className={styles.addressGrid}>
              <div>
                <input className={`${styles.input}${errors.province ? ` ${styles.inputError}` : ""}`}
                  placeholder="Pilih Provinsi" value={form.province} onChange={setField("province")} readOnly={readOnly} />
                {errors.province && <p className={styles.errorMsg}>{errors.province}</p>}
              </div>
              <div>
                <input className={`${styles.input}${errors.cityOrRegency ? ` ${styles.inputError}` : ""}`}
                  placeholder="Pilih Kota/Kabupaten" value={form.cityOrRegency} onChange={setField("cityOrRegency")} readOnly={readOnly} />
                {errors.cityOrRegency && <p className={styles.errorMsg}>{errors.cityOrRegency}</p>}
              </div>
              <div>
                <input className={`${styles.input}${errors.district ? ` ${styles.inputError}` : ""}`}
                  placeholder="Pilih Kecamatan" value={form.district} onChange={setField("district")} readOnly={readOnly} />
                {errors.district && <p className={styles.errorMsg}>{errors.district}</p>}
              </div>
              <div className={styles.rowThree}>
                <div>
                  <input className={`${styles.input}${errors.rt ? ` ${styles.inputError}` : ""}`}
                    placeholder="Masukkan RT" value={form.rt} onChange={setField("rt")} maxLength={3} readOnly={readOnly} />
                  {errors.rt && <p className={styles.errorMsg}>{errors.rt}</p>}
                </div>
                <div>
                  <input className={`${styles.input}${errors.rw ? ` ${styles.inputError}` : ""}`}
                    placeholder="Masukkan RW" value={form.rw} onChange={setField("rw")} maxLength={3} readOnly={readOnly} />
                  {errors.rw && <p className={styles.errorMsg}>{errors.rw}</p>}
                </div>
                <div>
                  <input className={`${styles.input}${errors.postalCode ? ` ${styles.inputError}` : ""}`}
                    placeholder="Masukkan Kode Pos" value={form.postalCode} onChange={setField("postalCode")} maxLength={5} readOnly={readOnly} />
                  {errors.postalCode && <p className={styles.errorMsg}>{errors.postalCode}</p>}
                </div>
              </div>
            </div>
          </div>

        </div>{/* end card */}

        {!readOnly && (
          <button
            className={styles.submitBtn}
            onClick={() => void handleSubmit()}
            disabled={submitting || ktp.uploading || selfie.uploading}
          >
            {submitting ? "Mengirim…" : "Submit Data"}
          </button>
        )}

      </div>
    </div>
  );
}