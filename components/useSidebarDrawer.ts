'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

/** Harus sama dengan breakpoint mobile di ownerSidebar.module.css */
const MOBILE_QUERY = '(max-width: 980px)';

/**
 * Perilaku sidebar di layar kecil: sidebar jadi drawer yang menutupi konten,
 * tertutup otomatis setelah pindah halaman, dan bisa ditutup pakai Esc.
 * Di desktop, tombol toggle tetap menjalankan `onToggle` (collapse biasa).
 */
export function useSidebarDrawer(onToggle: () => void) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Tutup drawer setiap kali halaman berganti
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  const handleToggle = useCallback(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) {
      setDrawerOpen(true);
    } else {
      onToggle();
    }
  }, [onToggle]);

  // Esc untuk menutup + kunci scroll halaman selama drawer terbuka
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [drawerOpen]);

  // Kalau layar dibesarkan saat drawer terbuka, tutup drawer-nya
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => {
      if (!mql.matches) setDrawerOpen(false);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  return { drawerOpen, closeDrawer, handleToggle };
}
