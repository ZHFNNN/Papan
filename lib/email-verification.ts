import { randomBytes } from "crypto";

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** Jeda minimal antar permintaan kirim ulang untuk email yang sama. */
export const RESEND_COOLDOWN_MS = 60 * 1000;

export function createVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export function buildVerifyUrl(baseUrl: string, email: string, token: string): string {
  const verifyUrl = new URL("/api/auth/verify-email", baseUrl);
  verifyUrl.searchParams.set("email", email);
  verifyUrl.searchParams.set("token", token);
  return verifyUrl.toString();
}

/**
 * Tabel VerificationToken tidak punya createdAt, jadi waktu pembuatan token
 * dihitung mundur dari `expires` (selalu dibuat dengan masa berlaku 24 jam).
 */
export function isResendThrottled(latestTokenExpires: Date | null | undefined, now: Date = new Date()): boolean {
  if (!latestTokenExpires) return false;
  const issuedAt = latestTokenExpires.getTime() - VERIFICATION_TOKEN_TTL_MS;
  return now.getTime() - issuedAt < RESEND_COOLDOWN_MS;
}
