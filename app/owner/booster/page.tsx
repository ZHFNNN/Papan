'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { IMAGE_WIDTH, optimizeImage } from '@/lib/image';
import { BOOST_PACKAGES, type BoosterPackage } from '@/lib/booster';

// ─── Types ────────────────────────────────────────────────────────────────────

type Property = {
  id: string;
  title: string;
  address: string | null;
  city: string | null;
  price: string;
  imageUrls: string[];
  views: number;
  isBoosted: boolean;
};

type CartItem = {
  propertyId: string;
  propertyTitle: string;
  packageId: string;
  packageTitle: string;
  days: number;
  price: number;
};

type PaymentMethod = 'QRIS' | 'BCA' | 'BRI' | 'MANDIRI';

type Toast = {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
};

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { id: PaymentMethod; label: string; type: 'qris' | 'va' }[] = [
  { id: 'QRIS', label: 'QRIS', type: 'qris' },
  { id: 'BCA', label: 'BCA', type: 'va' },
  { id: 'BRI', label: 'BRIVA', type: 'va' },
  { id: 'MANDIRI', label: 'Mandiri', type: 'va' },
];

const ADMIN_FEE = 1000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRupiah(num: number) {
  return `Rp${num.toLocaleString('id-ID')}`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast} ${styles[`toast_${t.type}`]}`}
          onClick={() => onRemove(t.id)}
        >
          <span className={styles.toastIcon}>
            {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
          </span>
          <span className={styles.toastMsg}>{t.message}</span>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

// ─── Cart Drawer ──────────────────────────────────────────────────────────────

function CartDrawer({
  isOpen, onClose, cart, onRemove, onChangePackage, onChangeProperty,
  onCheckout, isProcessing, properties, toast,
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemove: (idx: number) => void;
  onChangePackage: (idx: number, pkg: BoosterPackage) => void;
  onChangeProperty: (idx: number, prop: Property) => void;
  onCheckout: (method: PaymentMethod) => void;
  isProcessing: boolean;
  properties: Property[];
  toast: (msg: string, type?: Toast['type']) => void;
}) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('QRIS');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editMode, setEditMode] = useState<'package' | 'property' | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.price, 0);
  const total = subtotal + ADMIN_FEE;

  const cancelEdit = () => { setEditingIdx(null); setEditMode(null); };

  return (
    <>
      <div
        className={`${styles.drawerBackdrop} ${isOpen ? styles.drawerBackdropOpen : ''}`}
        onClick={onClose}
      />
      <div className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerHeader}>
          <h2 className={styles.drawerTitle}>
            Keranjang {cart.length > 0 && <span className={styles.drawerCount}>{cart.length}</span>}
          </h2>
          <button className={styles.drawerClose} onClick={onClose}>✕</button>
        </div>

        {cart.length === 0 ? (
          <div className={styles.drawerEmpty}>
            <div className={styles.drawerEmptyIcon}>🛒</div>
            <p className={styles.drawerEmptyText}>Keranjang kamu masih kosong.</p>
            <button className={styles.drawerEmptyBtn} onClick={onClose}>+ Tambah Booster</button>
          </div>
        ) : (
          <div className={styles.drawerBody}>
            <div className={styles.drawerItems}>
              {cart.map((item, idx) => (
                <div key={idx} className={styles.drawerItem}>
                  {/* Inline edit: ganti paket */}
                  {editingIdx === idx && editMode === 'package' && (
                    <div className={styles.inlineEdit}>
                      <p className={styles.inlineEditLabel}>Pilih paket baru:</p>
                      <div className={styles.inlineEditOptions}>
                        {BOOST_PACKAGES.map(pkg => (
                          <button
                            key={pkg.id}
                            className={`${styles.inlineEditOption} ${item.packageId === pkg.id ? styles.inlineEditOptionActive : ''}`}
                            onClick={() => {
                              onChangePackage(idx, pkg);
                              cancelEdit();
                              toast(`Paket diubah ke ${pkg.title}`, 'success');
                            }}
                          >
                            <span className={styles.inlineOptName}>{pkg.label}</span>
                            <span className={styles.inlineOptPrice}>{formatRupiah(pkg.price)}</span>
                          </button>
                        ))}
                      </div>
                      <button className={styles.inlineEditCancel} onClick={cancelEdit}>Batal</button>
                    </div>
                  )}

                  {/* Inline edit: ganti properti */}
                  {editingIdx === idx && editMode === 'property' && (
                    <div className={styles.inlineEdit}>
                      <p className={styles.inlineEditLabel}>Pilih properti lain:</p>
                      <div className={styles.inlinePropList}>
                        {properties.length === 0 ? (
                          <p className={styles.inlineEmpty}>Tidak ada properti tersedia.</p>
                        ) : properties.map(prop => (
                          <button
                            key={prop.id}
                            className={`${styles.inlinePropOption} ${item.propertyId === prop.id ? styles.inlineEditOptionActive : ''}`}
                            onClick={() => {
                              const dup = cart.some((c, i) => i !== idx && c.propertyId === prop.id && c.packageId === item.packageId);
                              if (dup) { toast('Properti ini sudah ada di keranjang dengan paket yang sama.', 'error'); return; }
                              onChangeProperty(idx, prop);
                              cancelEdit();
                              toast('Properti berhasil diubah', 'success');
                            }}
                          >
                            <span className={styles.inlinePropName}>{prop.title}</span>
                            <span className={styles.inlinePropCity}>{prop.city ?? '-'}</span>
                          </button>
                        ))}
                      </div>
                      <button className={styles.inlineEditCancel} onClick={cancelEdit}>Batal</button>
                    </div>
                  )}

                  {/* Normal view */}
                  {editingIdx !== idx && (
                    <>
                      <div className={styles.drawerItemTop}>
                        <div className={styles.drawerItemInfo}>
                          <p className={styles.drawerItemPkg}>{item.packageTitle}</p>
                          <p className={styles.drawerItemProp}>{item.propertyTitle}</p>
                        </div>
                        <div className={styles.drawerItemRight}>
                          <span className={styles.drawerItemPrice}>{formatRupiah(item.price)}</span>
                          <button
                            className={styles.drawerRemoveBtn}
                            onClick={() => { onRemove(idx); toast('Item dihapus dari keranjang', 'info'); }}
                          >✕</button>
                        </div>
                      </div>
                      <div className={styles.drawerItemActions}>
                        <button className={styles.drawerEditBtn} onClick={() => { setEditingIdx(idx); setEditMode('package'); }}>
                          ✏ Ganti Paket
                        </button>
                        <button className={styles.drawerEditBtn} onClick={() => { setEditingIdx(idx); setEditMode('property'); }}>
                          🏠 Ganti Properti
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Summary + Payment */}
            <div className={styles.drawerSummary}>
              <div className={styles.drawerSummaryRow}>
                <span>Subtotal</span><span>{formatRupiah(subtotal)}</span>
              </div>
              <div className={styles.drawerSummaryRow}>
                <span>Biaya Admin</span><span>{formatRupiah(ADMIN_FEE)}</span>
              </div>
              <div className={styles.drawerSummaryDivider} />
              <div className={`${styles.drawerSummaryRow} ${styles.drawerSummaryTotal}`}>
                <span>Total</span><span>{formatRupiah(total)}</span>
              </div>

              <p className={styles.drawerPayLabel}>Metode Pembayaran</p>
              <div className={styles.drawerPayGroup}>
                {PAYMENT_METHODS.filter(m => m.type === 'qris').map(m => (
                  <label key={m.id} className={`${styles.drawerPayOption} ${selectedMethod === m.id ? styles.drawerPaySelected : ''}`}>
                    <input type="radio" name="dpay" checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} className={styles.hiddenRadio} />
                    <span className={styles.radioCircle} />
                    <span className={styles.radioLabel}>{m.label}</span>
                  </label>
                ))}
              </div>
              <p className={styles.drawerPayGroupLabel}>Virtual Account</p>
              <div className={styles.drawerPayGroup}>
                {PAYMENT_METHODS.filter(m => m.type === 'va').map(m => (
                  <label key={m.id} className={`${styles.drawerPayOption} ${selectedMethod === m.id ? styles.drawerPaySelected : ''}`}>
                    <input type="radio" name="dpay" checked={selectedMethod === m.id} onChange={() => setSelectedMethod(m.id)} className={styles.hiddenRadio} />
                    <span className={styles.radioCircle} />
                    <span className={styles.radioLabel}>{m.label}</span>
                  </label>
                ))}
              </div>

              <button
                className={styles.drawerPayBtn}
                onClick={() => onCheckout(selectedMethod)}
                disabled={isProcessing}
              >
                {isProcessing ? 'Memproses...' : `Bayar ${formatRupiah(total)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function CartBtn({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button className={styles.cartBtn} onClick={onClick}>
      <div className={styles.cartIconWrap}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
        {count > 0 && <span className={styles.cartBadge}>{count}</span>}
      </div>
      <span className={styles.cartLabel}>Keranjang{count > 0 ? ` (${count})` : ''}</span>
    </button>
  );
}

// ─── Step 1: Pilih Paket ──────────────────────────────────────────────────────

function StepPackage({ selectedPkg, onSelect, cartCount, onCartClick }: {
  selectedPkg: BoosterPackage | null;
  onSelect: (pkg: BoosterPackage) => void;
  cartCount: number;
  onCartClick: () => void;
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Booster Ads</h1>
          <p className={styles.pageSubtitle}>Tingkatkan visibilitas properti Anda dengan Booster Ads dan dapatkan lebih banyak calon pembeli</p>
        </div>
        <CartBtn count={cartCount} onClick={onCartClick} />
      </div>
      <div className={styles.packageGrid}>
        {BOOST_PACKAGES.map((pkg) => {
          const isSelected = selectedPkg?.id === pkg.id;
          return (
            <div
              key={pkg.id}
              className={`${styles.packageCard} ${pkg.highlighted ? styles.packageHighlighted : ''} ${isSelected ? styles.packageSelected : ''}`}
              onClick={() => onSelect(pkg)}
            >
              <div className={styles.pkgLabel}>Paket</div>
              <div className={styles.pkgName}>{pkg.label}</div>
              <div className={styles.pkgPrice}>{formatRupiah(pkg.price)}</div>
              <ul className={styles.pkgFeatures}>
                {pkg.features.map((f) => (
                  <li key={f} className={styles.pkgFeatureItem}>
                    <span className={styles.pkgCheckIcon}><CheckIcon /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className={`${styles.selectIndicator} ${isSelected ? styles.selectIndicatorActive : ''}`}>
                {isSelected ? '✓ Dipilih' : 'Pilih Paket'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 2: Pilih Properti ───────────────────────────────────────────────────

function StepProperty({ properties, selectedPkg, isLoading, onAddToCart, cartCount, onCartClick, cart }: {
  properties: Property[];
  selectedPkg: BoosterPackage;
  isLoading: boolean;
  onAddToCart: (property: Property) => void;
  cartCount: number;
  onCartClick: () => void;
  cart: CartItem[];
}) {
  return (
    <div className={styles.stepContent}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Pilih Properti</h1>
          <p className={styles.pageSubtitle}>
            Pilih properti yang ingin di-boost dengan <strong>{selectedPkg.title}</strong> — {formatRupiah(selectedPkg.price)}
          </p>
        </div>
        <CartBtn count={cartCount} onClick={onCartClick} />
      </div>

      {isLoading ? (
        <div className={styles.loadingState}><div className={styles.spinner} /><p>Memuat properti...</p></div>
      ) : properties.length === 0 ? (
        <div className={styles.emptyState}><p>Kamu belum punya properti.</p></div>
      ) : (
        <div className={styles.propertyList}>
          {properties.map((prop) => {
            const inCart = cart.some(c => c.propertyId === prop.id && c.packageId === selectedPkg.id);
            return (
              <div key={prop.id} className={`${styles.propertyCard} ${inCart ? styles.propertyCardInCart : ''}`}>
                <div className={styles.propThumb}>
                  {prop.imageUrls?.length > 0
                    ? <img src={optimizeImage(prop.imageUrls[0], IMAGE_WIDTH.thumb * 2)} alt={prop.title} className={styles.propImg} loading="lazy" decoding="async" />
                    : <div className={styles.propImgPlaceholder}>🏠</div>}
                </div>
                <div className={styles.propInfo}>
                  <h3 className={styles.propTitle}>{prop.title}</h3>
                  {prop.city && <p className={styles.propAddress}>📍 {prop.address ? `${prop.address}, ` : ''}{prop.city}</p>}
                  <p className={styles.propPrice}>{formatRupiah(Number(prop.price))}</p>
                  <p className={styles.propViews}>{prop.views ?? 0} views</p>
                  {prop.isBoosted && <span className={styles.boostedTag}>🚀 Sedang Diboost</span>}
                </div>
                <button
                  className={`${styles.addCartBtn} ${inCart ? styles.addCartBtnInCart : ''}`}
                  onClick={() => onAddToCart(prop)}
                  disabled={inCart}
                >
                  {inCart ? '✓ Di Keranjang' : '+ Keranjang'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Step = 'package' | 'property';

export default function OwnerBoosterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('package');
  const [selectedPkg, setSelectedPkg] = useState<BoosterPackage | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const steps = [
    { key: 'package' as Step, label: 'Pilih Paket' },
    { key: 'property' as Step, label: 'Pilih Properti' },
  ];
  const stepIndex = steps.findIndex(s => s.key === step);

  useEffect(() => {
    if (step === 'property' && properties.length === 0) {
      setPropertiesLoading(true);
      fetch('/api/owner/dashboard')
        .then(r => r.json())
        .then(data => setProperties(data.properties ?? []))
        .catch(() => addToast('Gagal memuat properti.', 'error'))
        .finally(() => setPropertiesLoading(false));
    }
  }, [step]);

  const handleSelectPackage = (pkg: BoosterPackage) => {
    setSelectedPkg(pkg);
    setStep('property');
  };

  const handleAddToCart = (property: Property) => {
    if (!selectedPkg) return;
    const exists = cart.some(item => item.propertyId === property.id && item.packageId === selectedPkg.id);
    if (exists) { addToast('Properti ini sudah ada di keranjang dengan paket yang sama.', 'error'); return; }
    setCart(prev => [...prev, {
      propertyId: property.id,
      propertyTitle: property.title,
      packageId: selectedPkg.id,
      packageTitle: selectedPkg.title,
      days: selectedPkg.days,
      price: selectedPkg.price,
    }]);
    addToast(`"${property.title}" ditambahkan ke keranjang!`, 'success');
  };

  const handleRemoveFromCart = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const handleChangePackage = (idx: number, pkg: BoosterPackage) => {
    setCart(prev => prev.map((item, i) =>
      i === idx ? { ...item, packageId: pkg.id, packageTitle: pkg.title, days: pkg.days, price: pkg.price } : item
    ));
  };

  const handleChangeProperty = (idx: number, prop: Property) => {
    setCart(prev => prev.map((item, i) =>
      i === idx ? { ...item, propertyId: prop.id, propertyTitle: prop.title } : item
    ));
  };

  const handleCheckout = async (method: PaymentMethod) => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/owner/boosts/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart, paymentMethod: method }),
      });
      if (!res.ok) throw new Error();
      setCart([]);
      setCartOpen(false);
      addToast('Booster berhasil diaktifkan! 🚀', 'success');
      setTimeout(() => router.push('/owner/dashboard?boost=success'), 1500);
    } catch {
      addToast('Gagal memproses pembayaran. Coba lagi.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.pageWrap}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onRemove={handleRemoveFromCart}
        onChangePackage={handleChangePackage}
        onChangeProperty={handleChangeProperty}
        onCheckout={handleCheckout}
        isProcessing={isProcessing}
        properties={properties}
        toast={addToast}
      />

      {/* Step indicator */}
      <div className={styles.stepIndicator}>
        {steps.map((s, i) => (
          <div key={s.key} className={styles.stepItem}>
            <div className={`${styles.stepDot} ${i <= stepIndex ? styles.stepDotActive : ''}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`${styles.stepItemLabel} ${i <= stepIndex ? styles.stepItemLabelActive : ''}`}>{s.label}</span>
            {i < steps.length - 1 && <div className={`${styles.stepLine} ${i < stepIndex ? styles.stepLineActive : ''}`} />}
          </div>
        ))}
      </div>

      {step === 'package' && (
        <StepPackage selectedPkg={selectedPkg} onSelect={handleSelectPackage} cartCount={cart.length} onCartClick={() => setCartOpen(true)} />
      )}

      {step === 'property' && selectedPkg && (
        <>
          <StepProperty
            properties={properties}
            selectedPkg={selectedPkg}
            isLoading={propertiesLoading}
            onAddToCart={handleAddToCart}
            cartCount={cart.length}
            onCartClick={() => setCartOpen(true)}
            cart={cart}
          />
          <div className={styles.stepNav}>
            <button className={styles.navBackBtn} onClick={() => setStep('package')}>← Ganti Paket</button>
            {cart.length > 0 && (
              <button className={styles.navNextBtn} onClick={() => setCartOpen(true)}>
                Lihat Keranjang ({cart.length} item) →
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}