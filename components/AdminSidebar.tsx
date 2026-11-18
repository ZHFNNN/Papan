'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';
import Icon, { type IconName } from '@/components/Icon';
import { useSidebarDrawer } from '@/components/useSidebarDrawer';
import styles from './AdminSidebar.module.css';

/** Harus sama dengan breakpoint mobile di AdminSidebar.module.css */
const ADMIN_MOBILE_QUERY = '(max-width: 768px)';

const MENU: { key: AdminMenuKey; href: string; label: string; icon: IconName }[] = [
  { key: 'kyc',           href: '/admin/kyc',           label: 'Verifikasi KYC',   icon: 'clipboardCheck' },
  { key: 'notifications', href: '/admin/notifications', label: 'Kirim Notifikasi', icon: 'bell' },
  { key: 'chat',          href: '/admin/chat',          label: 'Monitoring Chat',  icon: 'message' },
  { key: 'reviews',       href: '/admin/reviews',       label: 'Moderasi Review',  icon: 'star' },
];

export type AdminMenuKey = 'kyc' | 'notifications' | 'chat' | 'reviews';

const noop = () => {};

/**
 * Sidebar halaman admin. Desktop: menempel di kiri.
 * Mobile: tersembunyi, dibuka lewat tombol "Menu" di bar atas (drawer seperti sidebar profil).
 */
export default function AdminSidebar({ active }: { active: AdminMenuKey }) {
  const { drawerOpen, closeDrawer, handleToggle } = useSidebarDrawer(noop, ADMIN_MOBILE_QUERY);

  return (
    <>
      {/* Bar atas khusus mobile */}
      <div className={styles.mobileBar}>
        <button
          type="button"
          className={styles.menuButton}
          onClick={handleToggle}
          aria-expanded={drawerOpen}
          aria-controls="admin-sidebar"
        >
          <span className={styles.menuLines} aria-hidden="true" />
          Menu
        </button>
        <span className={styles.mobileBrand}>PAPAN Admin</span>
      </div>

      {drawerOpen && <div className={styles.backdrop} onClick={closeDrawer} aria-hidden="true" />}

      <aside id="admin-sidebar" className={`${styles.sidebar} ${drawerOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><Icon name="home" /></span>
          <span className={styles.brandName}>PAPAN Admin</span>
          <button type="button" className={styles.drawerClose} onClick={closeDrawer} aria-label="Tutup menu">
            ✕
          </button>
        </div>

        <nav className={styles.nav}>
          {MENU.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.navItem} ${item.key === active ? styles.navItemActive : ''}`}
              aria-current={item.key === active ? 'page' : undefined}
              onClick={closeDrawer}
            >
              <Icon name={item.icon} /> {item.label}
            </Link>
          ))}
        </nav>

        <button type="button" className={styles.logout} onClick={() => signOut({ callbackUrl: '/login' })}>
          Log Out
        </button>
      </aside>
    </>
  );
}
