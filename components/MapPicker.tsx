'use client';

// ── Catatan instalasi ──────────────────────────────────────────────────────
// npm install leaflet react-leaflet @types/leaflet
// ──────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { Circle, LeafletMouseEvent, Map as LeafletMap, Marker } from 'leaflet';
import styles from './MapPicker.module.css';

// Leaflet di-import dinamis (butuh `window`), jadi tipenya diambil dari modulnya
type LeafletModule = typeof import('leaflet');

export type PickedLocation = {
  displayName: string;
  city: string;
  district: string;
  neighbourhood: string;
  lat: number;
  lng: number;
};

interface MapPickerProps {
  onLocationPicked: (loc: PickedLocation) => void;
  onClose: () => void;
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  village?: string;
  suburb?: string;
  city_district?: string;
  county?: string;
  city?: string;
  town?: string;
  municipality?: string;
  state?: string;
  postcode?: string;
}

interface NominatimResult {
  display_name: string;
  address: NominatimAddress;
  lat: string;
  lon: string;
}

function parseNominatim(result: NominatimResult, lat: number, lng: number): PickedLocation {
  const a = result.address;
  return {
    displayName:   result.display_name,
    city:          a.city ?? a.town ?? a.county ?? a.municipality ?? '',
    district:      a.city_district ?? a.county ?? '',
    neighbourhood: a.neighbourhood ?? a.village ?? a.suburb ?? '',
    lat,
    lng,
  };
}

// Status deteksi lokasi user
type UserLocStatus = 'requesting' | 'active' | 'denied' | 'unavailable';

export default function MapPicker({ onLocationPicked, onClose }: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef          = useRef<LeafletMap | null>(null);
  const leafletRef      = useRef<LeafletModule | null>(null);
  const isInitializingMapRef = useRef(false);

  // Dua layer yang berbeda:
  // selectionMarker = pin merah tempat user memilih daerah
  // blueDot + accuracyCircle = menandai posisi fisik user sekarang
  const selectionMarkerRef = useRef<Marker | null>(null);
  const blueDotRef         = useRef<Marker | null>(null);
  const accuracyCircleRef  = useRef<Circle | null>(null);
  const watchIdRef         = useRef<number | null>(null);

  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [isGeocoding, setIsGeocoding]       = useState(false);
  const [geocodeError, setGeocodeError]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]       = useState('');
  const [isSearching, setIsSearching]       = useState(false);
  const [searchError, setSearchError]       = useState<string | null>(null);
  const [userLocStatus, setUserLocStatus]   = useState<UserLocStatus>('requesting');

  // ── Init map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || isInitializingMapRef.current) return;

    let isCancelled = false;
    const containerEl = mapContainerRef.current;
    isInitializingMapRef.current = true;

    const init = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      leafletRef.current = L;

      if (isCancelled || !containerEl || mapRef.current) {
        isInitializingMapRef.current = false;
        return;
      }

      // Fix broken icons di Next.js / webpack
      delete (L.Icon.Default.prototype as { _getIconUrl?: unknown })._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      // Mulai di tengah Indonesia — nanti fly ke GPS user
      const map = L.map(containerEl, {
        center: [-2.5, 118],
        zoom: 5,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Klik di peta → selection marker
      map.on('click', async (e: LeafletMouseEvent) => {
        await placeSelectionMarker(e.latlng.lat, e.latlng.lng, L, map);
      });

      mapRef.current = map;
      isInitializingMapRef.current = false;

      // Langsung minta GPS begitu map siap
      startUserLocationWatch(L, map);
    };

    init();

    return () => {
      isCancelled = true;
      isInitializingMapRef.current = false;

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      selectionMarkerRef.current = null;
      blueDotRef.current = null;
      accuracyCircleRef.current = null;
    };
  }, []);

  // ── Watch posisi user & render blue dot ──────────────────────────────────
  //
  // Pakai watchPosition (bukan getCurrentPosition) supaya:
  // 1. Blue dot update real-time kalau user bergerak
  // 2. Accuracy circle menyempit seiring GPS lock makin akurat
  //
  // Blue dot dibuat dari divIcon (HTML/CSS murni) bukan image PNG,
  // supaya kita bisa kontrol penuh tampilannya termasuk animasi pulse.
  const startUserLocationWatch = (L: LeafletModule, map: LeafletMap) => {
    if (!navigator.geolocation) {
      setUserLocStatus('unavailable');
      map.setView([-7.5, 110], 8); // fallback: tampilkan Jawa
      return;
    }

    // Icon blue dot — titik biru dengan ring pulse
    // Kita inject style via <style> tag supaya animasi keyframe bisa jalan
    if (!document.getElementById('blue-dot-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'blue-dot-style';
      styleEl.textContent = `
        @keyframes blueDotPulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          70%  { transform: scale(2.5); opacity: 0; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        .blue-dot-inner {
          width: 14px;
          height: 14px;
          background: #2196F3;
          border: 2.5px solid white;
          border-radius: 50%;
          box-shadow: 0 1px 8px rgba(33,150,243,0.7);
          position: relative;
          z-index: 2;
        }
        .blue-dot-pulse {
          position: absolute;
          width: 14px;
          height: 14px;
          top: 0; left: 0;
          background: rgba(33,150,243,0.4);
          border-radius: 50%;
          animation: blueDotPulse 2.5s ease-out infinite;
          z-index: 1;
        }
      `;
      document.head.appendChild(styleEl);
    }

    const blueDotIcon = L.divIcon({
      className: '',
      html: `<div style="position:relative;width:14px;height:14px">
               <div class="blue-dot-pulse"></div>
               <div class="blue-dot-inner"></div>
             </div>`,
      iconSize:   [14, 14],
      iconAnchor: [7, 7],
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const isFirst = !blueDotRef.current;

        setUserLocStatus('active');

        // Fly ke posisi user hanya saat pertama kali dapat fix
        if (isFirst) {
          map.flyTo([lat, lng], 15, { duration: 1.5 });
        }

        // Update atau buat blue dot
        if (blueDotRef.current) {
          blueDotRef.current.setLatLng([lat, lng]);
        } else {
          blueDotRef.current = L.marker([lat, lng], {
            icon:           blueDotIcon,
            zIndexOffset:   1000,  // selalu di atas selection marker
            interactive:    false, // tidak bisa diklik user
            keyboard:       false,
          }).addTo(map);
        }

        // Update atau buat accuracy circle
        // Semakin kecil radius = GPS makin presisi
        if (accuracyCircleRef.current) {
          accuracyCircleRef.current.setLatLng([lat, lng]);
          accuracyCircleRef.current.setRadius(accuracy);
        } else {
          accuracyCircleRef.current = L.circle([lat, lng], {
            radius:      accuracy,
            color:       '#2196F3',
            weight:      1.5,
            opacity:     0.4,
            fillColor:   '#2196F3',
            fillOpacity: 0.1,
            interactive: false,
          }).addTo(map);
        }
      },

      (err) => {
        setUserLocStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
        // Fallback view: Jawa
        if (!mapRef.current) return;
        mapRef.current.setView([-7.5, 110], 8);
      },

      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 5_000 }
    );
  };

  // ── Pasang selection marker + reverse geocode ─────────────────────────────
  const placeSelectionMarker = async (lat: number, lng: number, L: LeafletModule, map: LeafletMap) => {
    let marker = selectionMarkerRef.current;
    if (marker) {
      marker.setLatLng([lat, lng]);
    } else {
      marker = L.marker([lat, lng]).addTo(map);
      selectionMarkerRef.current = marker;
    }

    setIsGeocoding(true);
    setGeocodeError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { 'User-Agent': 'PAPAN-PropertyApp/1.0 (contact@papan.id)' } }
      );
      if (!res.ok) throw new Error();

      const data: NominatimResult = await res.json();
      const loc = parseNominatim(data, lat, lng);
      setPickedLocation(loc);

      marker
        .bindPopup(`<b>${loc.neighbourhood || loc.district || loc.city}</b><br/>${loc.city}`)
        .openPopup();
    } catch {
      setGeocodeError('Gagal mengambil nama lokasi. Coba klik titik lain.');
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Re-center ke posisi user ──────────────────────────────────────────────
  const handleRecenter = () => {
    if (!blueDotRef.current || !mapRef.current) return;
    mapRef.current.flyTo(blueDotRef.current.getLatLng(), 16, { duration: 0.8 });
  };

  // ── Search teks ──────────────────────────────────────────────────────────
  const handleSearch = async () => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!searchQuery.trim() || !map || !L) return;
    setIsSearching(true);
    setSearchError(null);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&addressdetails=1&limit=1&countrycodes=id`,
        { headers: { 'User-Agent': 'PAPAN-PropertyApp/1.0 (contact@papan.id)' } }
      );
      if (!res.ok) throw new Error();

      const results: NominatimResult[] = await res.json();
      if (!results.length) { setSearchError('Lokasi tidak ditemukan. Coba kata kunci lain.'); return; }

      const lat = parseFloat(results[0].lat);
      const lng = parseFloat(results[0].lon);
      map.flyTo([lat, lng], 15, { duration: 1 });

      await placeSelectionMarker(lat, lng, L, map);
    } catch {
      setSearchError('Gagal mencari lokasi. Coba lagi.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConfirm = () => {
    if (!pickedLocation) return;
    onLocationPicked(pickedLocation);
    onClose();
  };

  // Teks + warna status GPS di subtitle header
  const statusLabel: Record<UserLocStatus, { text: string; cls: string }> = {
    requesting:  { text: 'Mendeteksi lokasimu...', cls: styles.statusRequesting },
    active:      { text: '⟜Lokasimu terdeteksi', cls: styles.statusActive },
    denied:      { text: '⚠ Izin lokasi ditolak — kamu masih bisa pilih manual', cls: styles.statusError },
    unavailable: { text: '⚠ GPS tidak tersedia — pilih lokasi manual', cls: styles.statusError },
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div>
            <h2 className={styles.modalTitle}>Pilih Lokasi</h2>
            <p className={`${styles.modalSubtitle} ${statusLabel[userLocStatus].cls}`}>
              {statusLabel[userLocStatus].text}
            </p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {/* Search */}
        <div className={styles.searchRow}>
          <div className={styles.searchBar}>
            <input
              className={styles.searchInput}
              placeholder="Cari lokasi yang masuk dalam preferensi kamu disini"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
            />
            <button className={styles.searchBtn} onClick={handleSearch} disabled={isSearching}>
              {isSearching
                ? <span className={styles.searchSpinner} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              }
            </button>
          </div>

          {/* Tombol re-center — hanya tampil kalau GPS aktif */}
          {userLocStatus === 'active' && (
            <button className={styles.recenterBtn} onClick={handleRecenter} title="Kembali ke posisiku">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
                <circle cx="12" cy="12" r="9" strokeDasharray="3 3" strokeWidth="1.5"/>
              </svg>
              <span>Lokasiku sekarang</span>
            </button>
          )}
        </div>

        {searchError && <p className={styles.searchError}>{searchError}</p>}

        {/* Map */}
        <div className={styles.mapWrapper}>
          <div ref={mapContainerRef} className={styles.mapContainer} />

          {/* Loading geocoding */}
          {isGeocoding && (
            <div className={styles.geocodingOverlay}>
              <div className={styles.geocodingSpinner} />
              <p>Mengambil nama lokasi...</p>
            </div>
          )}

          {/* Overlay saat pertama kali request GPS */}
          {userLocStatus === 'requesting' && (
            <div className={styles.locatingOverlay}>
              <div className={styles.locatingRing} />
              <p>Mendeteksi lokasimu...</p>
            </div>
          )}

        </div>

        {/* Info lokasi dipilih */}
        <div className={styles.locationInfo}>
          {geocodeError ? (
            <p className={styles.geocodeError}>⚠️ {geocodeError}</p>
          ) : pickedLocation ? (
            <div className={styles.locationResult}>
              <div className={styles.locationDetails}>
                <p className={styles.locationMain}>
                  {[pickedLocation.neighbourhood, pickedLocation.district, pickedLocation.city]
                    .filter(Boolean).join(', ')}
                </p>
                <p className={styles.locationSub}>{pickedLocation.displayName}</p>
              </div>
            </div>
          ) : (
            <p className={styles.locationPlaceholder}>
              Klik di peta untuk memilih daerah yang kamu inginkan
            </p>
          )}
        </div>

        {/* Actions */}
        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onClose}>Batal</button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={!pickedLocation || isGeocoding}
          >
            Gunakan Lokasi Ini
          </button>
        </div>

      </div>
    </div>
  );
}