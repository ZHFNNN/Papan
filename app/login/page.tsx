"use client";

import React, { Suspense, useEffect, useState } from "react";
import styles from "./page.module.css";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast"; // Import Toast
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackPath = searchParams.get("callbackUrl");

  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      toast.success("Akun berhasil dibuat. Cek email untuk verifikasi.");
    }
    if (searchParams.get("verification") === "success") {
      toast.success("Email berhasil diverifikasi. Silakan login.");
    }
    if (searchParams.get("verification") === "invalid") {
      toast.error("Tautan verifikasi tidak valid atau sudah kedaluwarsa.");
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    await signIn("google", { callbackUrl: callbackPath || "/auth/post-login" });
  };

  const handleLogin = async () => {
    // 1. Validasi frontend
    if (!email || !password) {
      toast.error("Harap isi email dan password.");
      return;
    }

    // 2. Mulai loading
    setIsLoading(true);

    try {
      // 3. Panggil endpoint NextAuth langsung dari sisi klien
      const response = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: callbackPath
          ? new URL(callbackPath, window.location.origin).toString()
          : undefined,
      });

      // 4. Handle Response
      if (response && response.ok && !response.error) {
        let redirectPath = "/auth/post-login";

        if (!callbackPath) {
          try {
            const meResponse = await fetch("/api/auth/me", { method: "GET" });
            if (meResponse.ok) {
              const meData = (await meResponse.json()) as {
                user?: { role?: string };
              };
              if (meData.user?.role === "ADMIN") {
                redirectPath = "/admin/kyc";
              }
            }
          } catch (meError) {
            console.warn("Gagal mengambil data role setelah login:", meError);
          }
        }

        toast.success("Login berhasil! Mengalihkan...");

        // Jeda singkat agar notifikasi terlihat sebelum pindah halaman
        setTimeout(() => {
          router.push(redirectPath);
        }, 500);
      } else {
        toast.error("Login gagal, periksa kembali email dan password Anda.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan jaringan. Coba lagi nanti.");
      console.error("Error during login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgOverlay} />

      <div className={styles.card}>
        <h1 className={styles.title}>Welcome back!</h1>
        <p className={styles.subtitle}>Masuk ke akun Anda untuk melanjutkan</p>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="Masukkan email Anda"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Masukkan kata sandi"
              style={{ width: "100%", paddingRight: "44px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              style={{
                position: "absolute",
                right: "12px",
                top: "55%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#666",
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
            </button>
          </div>
        </div>

        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? "Memproses..." : "Login"}
        </button>

        <button className={styles.googleBtn} onClick={handleGoogleLogin}>
          <GoogleIcon />
          <span>Google</span>
        </button>

        <p className={styles.footerText}>
          Belum punya akun?{" "}
          <span
            className={styles.footerLink}
            onClick={() => router.push("/register")}
            style={{ cursor: "pointer" }}
          >
            Sign up
          </span>
        </p>
      </div>
    </div>
  );
}

function EyeOpenIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m3 3 18 18" />
      <path d="M10.58 10.58a2 2 0 1 0 2.83 2.83" />
      <path d="M16.68 16.67A8.7 8.7 0 0 1 12 18c-5 0-9.27-3.11-11-6 1.02-1.71 2.52-3.16 4.38-4.24" />
      <path d="M9.88 5.09A9.12 9.12 0 0 1 12 5c5 0 9.27 3.11 11 6a10.48 10.48 0 0 1-1.63 2.26" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" style={{ marginRight: 8 }}>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
