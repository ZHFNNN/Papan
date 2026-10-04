"use client";

import React, { useState } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast"; // Import Toast
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  // Semua state yang dibutuhkan sesuai schema Prisma
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async () => {
    // 1. Validasi frontend (Mencegah request sia-sia ke server)
    if (!name || !username || !email || !phoneNumber || !password) {
      toast.error("Harap isi semua field yang wajib!");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Password dan konfirmasi password tidak cocok!");
      return;
    }

    // 2. Mulai proses loading
    setIsLoading(true);

    try {
      // 3. Panggil endpoint API
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          email,
          phoneNumber,
          password,
          confirmPassword,
        }),
      });

      const data = await response.json();

      // 4. Handle Response
      if (response.ok) {
        // Login otomatis lewat NextAuth supaya SessionProvider (Navbar) ikut ter-update
        const loginResult = await signIn("credentials", {
          email,
          password,
          redirect: false,
        });

        if (loginResult?.ok) {
          toast.success("Registrasi berhasil! Lanjut personalisasi...");
          setTimeout(() => {
            router.push("/personalisasi");
          }, 500);
        } else {
          toast.success("Registrasi berhasil! Silakan login dulu.");
          setTimeout(() => {
            router.push("/login");
          }, 700);
        }
      } else {
        toast.error(data.message || "Registrasi gagal, silakan coba lagi.");
      }
    } catch (error) {
      toast.error("Terjadi kesalahan jaringan. Coba lagi nanti.");
      console.error("Error during registration:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgOverlay} />

      <div className={styles.card}>
        <h1 className={styles.title}>Selamat Datang!</h1>
        <p className={styles.subtitle}>Daftar akun Anda untuk melanjutkan</p>

        <div className={styles.field}>
          <label className={styles.label}>Nama Lengkap</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.input}
            placeholder="Masukkan nama lengkap"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
            placeholder="Masukkan username"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="Contoh: email123@gmail.com"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Nomor Telepon</label>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className={styles.input}
            placeholder="Masukkan nomor telepon"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            placeholder="Masukkan kata sandi"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={styles.input}
            placeholder="Konfirmasi kata sandi"
          />
        </div>

        <button
          className={styles.signUpBtn}
          onClick={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? "Memproses..." : "Sign Up"}
        </button>

        <button className={styles.googleBtn}>
          <GoogleIcon />
          <span>Google</span>
        </button>

        <p className={styles.footerText}>
          Sudah punya akun?{" "}
          <span
            className={styles.footerLink}
            onClick={() => router.push("/login")}
          >
            Log in
          </span>
        </p>
      </div>
    </div>
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
