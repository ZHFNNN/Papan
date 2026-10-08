'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from './ownerSidebar.module.css';
import { signOut } from 'next-auth/react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useSidebarDrawer } from '@/components/useSidebarDrawer';

const MENU_ITEMS = [
  { href: '/profile', label: 'Profile' },
  { href: '/profile/personalisasi', label: 'Personalisasi' },
  { href: '/settings', label: 'Settings' },
  { href: '/contact', label: 'Contact Us' },
  { href: '/help', label: 'Help Center' },
] as const;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onSwitchMode?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onSwitchMode }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [highlightStyle, setHighlightStyle] = useState({ top: '0px', height: '0px', opacity: 0 });
  const [isSwitching, setIsSwitching] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Di layar kecil sidebar jadi drawer yang menutupi konten
  const { drawerOpen, closeDrawer, handleToggle } = useSidebarDrawer(onToggle);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const activeHref = pathname;

  useEffect(() => {
    const activeItem = MENU_ITEMS.find((item) => item.href === activeHref);
    if (!activeItem) {
      setHighlightStyle((prev) => ({ ...prev, opacity: 0 }));
      return;
    }
    const activeEl = linkRefs.current[activeItem.href];
    if (!activeEl) return;
    setHighlightStyle({
      top: `${activeEl.offsetTop}px`,
      height: `${activeEl.offsetHeight}px`,
      opacity: 1,
    });
  }, [activeHref]);

  const handleSwitchMode = async () => {
    if (onSwitchMode) {
      onSwitchMode();
      return;
    }

    if (isSwitching) return;
    setIsSwitching(true);

    try {
      const res = await fetch('/api/profile');
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        router.push('/owner/verify');
        return;
      }

      const target = data.kycStatus === 'APPROVED' ? '/owner/dashboard' : '/owner/verify';
      router.push(target);
    } catch {
      router.push('/owner/verify');
    } finally {
      setIsSwitching(false);
    }
  };

  const openLogoutModal = () => {
    setLogoutOpen(true);
  };

  const closeLogoutModal = () => {
    if (logoutLoading) return;
    setLogoutOpen(false);
  };

  const confirmLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      {/* Sidebar panel */}
      {drawerOpen && <div className={styles.drawerBackdrop} onClick={closeDrawer} aria-hidden />}

      <div
        className={`${styles.sidebarWrapper} ${collapsed ? styles.collapsed : ''} ${drawerOpen ? styles.drawerOpen : ''}`}
      >
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Pencari Properti</h2>
            <button
              type="button"
              className={styles.drawerClose}
              onClick={closeDrawer}
              aria-label="Tutup menu"
            >
              ✕
            </button>
          </div>

          <div className={styles.menuList}>
            <div
              className={styles.activeHighlight}
              style={{
                top: highlightStyle.top,
                height: highlightStyle.height,
                opacity: highlightStyle.opacity,
              }}
            />
            {MENU_ITEMS.map((item) => {
              const isActive = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(el) => { linkRefs.current[item.href] = el; }}
                  className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ''}`}
                  onClick={closeDrawer}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className={styles.sidebarActions}>
            <button
              onClick={handleSwitchMode}
              className={styles.switchModeButton}
              disabled={isSwitching}
            >
              {isSwitching ? 'Memproses...' : 'Aktifkan Mode Pemilik'}
            </button>
            <button
              onClick={() => {
                closeDrawer();
                openLogoutModal();
              }}
              className={styles.logoutButton}
            >
              <span className={styles.logoutText}>Log Out</span>
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        title="Keluar dari akun?"
        description="Kamu akan logout dari akun ini."
        confirmText="Log Out"
        cancelText="Batal"
        loading={logoutLoading}
        onCancel={closeLogoutModal}
        onConfirm={confirmLogout}
      />

      {/* Toggle: desktop = collapse sidebar, mobile = buka drawer menu */}
      <button
        className={`${styles.toggleButton} ${collapsed ? styles.rotated : ''}`}
        onClick={handleToggle}
        title={collapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
        aria-label={collapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
        aria-expanded={drawerOpen}
      >
        <span className={styles.toggleMenuLabel} aria-hidden>
          ☰ Menu
        </span>
        <svg className={styles.toggleChevron} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M9 2L4 7L9 12"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}