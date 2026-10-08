'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import styles from './ownerSidebar.module.css';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useSidebarDrawer } from '@/components/useSidebarDrawer';
import { signOut } from 'next-auth/react';

const MENU_ITEMS = [
  { href: '/owner/dashboard', label: 'Dashboard' },
  { href: '/owner/profile', label: 'Profile' },
  { href: '/owner/addProperty', label: 'Tambah Properti' },
  { href: '/owner/booster', label: 'Booster' },
  { href: '/owner/verifyPage', label: 'Verifikasi' },
] as const;

interface OwnerSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function OwnerSidebar({ collapsed, onToggle }: OwnerSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [highlightStyle, setHighlightStyle] = useState({ top: '0px', height: '0px', opacity: 0 });
  const [logoutOpen, setLogoutOpen] = useState(false);
  // Di layar kecil sidebar jadi drawer yang menutupi konten
  const { drawerOpen, closeDrawer, handleToggle } = useSidebarDrawer(onToggle);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const activeHref = pathname === '/owner' ? '/owner/dashboard' : pathname;

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
            <h2 className={styles.sidebarTitle}>Pemilik Properti</h2>
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
              onClick={() => router.push('/profile')}
              className={styles.switchModeButton}
            >
              Kembali ke Mode Pencari
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