import { useCallback, useEffect, useState } from 'react';
import { type ApiProperty, type PropertyCardData, mapApiPropertyToCard } from '@/types/property';
import { PROMO_POPUP_SEEN_KEY } from './constants';

const HOME_PROPERTY_URL = '/api/properties?take=18';
const PROMO_PROPERTY_URL = '/api/properties?promo=1&take=20';

export type PropertyListState = {
  items: PropertyCardData[];
  isLoading: boolean;
  error: string | null;
};

/**
 * Ambil daftar properti dari `url`. Request baru dikirim saat `enabled` true,
 * dan hasilnya tetap disimpan walau `enabled` kembali false.
 */
function usePropertyList(url: string, errorMessage: string, enabled = true): PropertyListState {
  const [state, setState] = useState<PropertyListState>({ items: [], isLoading: true, error: null });
  const [hasStarted, setHasStarted] = useState(enabled);

  if (enabled && !hasStarted) setHasStarted(true);

  useEffect(() => {
    if (!hasStarted) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
        if (!cancelled) setState({ items: data.map(mapApiPropertyToCard), isLoading: false, error: null });
      } catch {
        if (!cancelled) setState({ items: [], isLoading: false, error: errorMessage });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url, errorMessage, hasStarted]);

  return state;
}

/** Daftar properti untuk section Best Seller. */
export function useHomeProperties(): PropertyListState {
  return usePropertyList(HOME_PROPERTY_URL, 'Gagal memuat properti.');
}

/** Properti yang sedang diskon. Baru di-fetch saat popup promo pertama kali dibuka. */
export function usePromoProperties(enabled: boolean): PropertyListState {
  return usePropertyList(PROMO_PROPERTY_URL, 'Gagal memuat promo.', enabled);
}

/** Popup promo terbuka otomatis sekali per sesi browser, lalu bisa dibuka ulang manual. */
export function usePromoPopup() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(PROMO_POPUP_SEEN_KEY)) return;
      sessionStorage.setItem(PROMO_POPUP_SEEN_KEY, '1');
    } catch {
      // storage tidak tersedia: tetap tampilkan popup
    }
    setIsOpen(true);
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}
