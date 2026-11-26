// lib/whatsapp.ts
// Helper nomor WhatsApp untuk link wa.me (tombol "Chat via WhatsApp" di detail properti)

/**
 * Ubah nomor HP pemilik ke format yang diterima wa.me: hanya digit, diawali kode negara 62.
 * Contoh: "0812...", "+62 812-...", "62812...", "812...", "+62 0812..." -> "62812..."
 */
export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("620")) return "62" + digits.slice(3);
  if (digits.startsWith("62")) return digits;
  if (digits.startsWith("0")) return "62" + digits.slice(1);
  if (digits.startsWith("8")) return "62" + digits;
  return digits;
}
