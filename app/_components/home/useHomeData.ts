import { useCallback, useEffect, useState } from 'react';
import { type ApiProperty, type PropertyCardData, mapApiPropertyToCard } from '@/types/property';
import { PROMO_POPUP_SEEN_KEY } from './constants';

const HOME_PROPERTY_LIMIT = 18;

type PropertiesState = {
  items: PropertyCardData[];
  isLoading: boolean;
  error: string | null;
};

/** Daftar properti untuk Best Seller & popup promo (satu request dipakai bersama). */
export function useHomeProperties(): PropertiesState {
  const [state, setState] = useState<PropertiesState>({ items: [], isLoading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/properties?take=${HOME_PROPERTY_LIMIT}`);
        const json = await res.json().catch(() => ({}));
        const data = Array.isArray(json.data) ? (json.data as ApiProperty[]) : [];
        if (!cancelled) setState({ items: data.map(mapApiPropertyToCard), isLoading: false, error: null });
      } catch {
        if (!cancelled) setState({ items: [], isLoading: false, error: 'Gagal memuat properti.' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
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
