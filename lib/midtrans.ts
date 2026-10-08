import crypto from "node:crypto";
import type { BoostPaymentStatus } from "@prisma/client";

export type MidtransPaymentMethod = "MIDTRANS" | "QRIS" | "BCA" | "BRI" | "MANDIRI";

export type MidtransItemDetail = {
  id: string;
  price: number;
  quantity: number;
  name: string;
};

export type MidtransCustomer = {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

type MidtransTransactionInput = {
  orderId: string;
  grossAmount: number;
  items: MidtransItemDetail[];
  paymentMethod: MidtransPaymentMethod;
  customer?: MidtransCustomer;
  expiryDurationMinutes?: number;
};

type MidtransTransactionResponse = {
  token: string;
  redirect_url: string;
};

function getMidtransServerKey() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) {
    throw new Error("MIDTRANS_SERVER_KEY belum dikonfigurasi.");
  }

  return serverKey;
}

function getMidtransBaseUrl() {
  return process.env.MIDTRANS_IS_PRODUCTION === "true"
    ? "https://app.midtrans.com"
    : "https://app.sandbox.midtrans.com";
}

function getAuthorizationHeader() {
  const serverKey = getMidtransServerKey();
  return `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`;
}

export function getMidtransSignatureKey({
  orderId,
  statusCode,
  grossAmount,
}: {
  orderId: string;
  statusCode: string;
  grossAmount: string | number;
}) {
  const serverKey = getMidtransServerKey();
  return crypto
    .createHash("sha512")
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest("hex");
}

/** Status pembayaran internal berdasarkan notifikasi Midtrans. */
export function mapMidtransStatus(
  transactionStatus?: string,
  fraudStatus?: string,
): BoostPaymentStatus {
  switch (transactionStatus) {
    case "settlement":
      return "PAID";
    case "capture":
      // Kartu kredit: hanya "accept" (atau tanpa fraud_status) yang berarti lunas
      if (fraudStatus === "deny") return "FAILED";
      if (fraudStatus === "challenge") return "PROCESSING";
      return "PAID";
    case "pending":
      return "PENDING";
    case "expire":
      return "EXPIRED";
    case "cancel":
      return "CANCELLED";
    case "deny":
    case "failure":
      return "FAILED";
    default:
      return "PROCESSING";
  }
}

const FINAL_FAILURE_STATUSES = new Set<BoostPaymentStatus>(["EXPIRED", "CANCELLED", "FAILED"]);

/**
 * Notifikasi Midtrans bisa datang terlambat, berulang, atau tidak berurutan.
 * Status hanya boleh maju:
 * - PAID bersifat final (tidak bisa kembali ke PENDING/EXPIRED/dst).
 * - EXPIRED/CANCELLED/FAILED hanya bisa berubah menjadi PAID (uang ternyata masuk).
 * - PROCESSING tidak boleh mundur ke PENDING.
 */
export function canTransitionPaymentStatus(
  current: BoostPaymentStatus,
  next: BoostPaymentStatus,
): boolean {
  if (current === "PAID") return false;
  if (next === "PAID") return true;
  if (FINAL_FAILURE_STATUSES.has(current)) return false;
  if (current === "PROCESSING" && next === "PENDING") return false;
  return true;
}

const MIDTRANS_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/**
 * Midtrans mengirim waktu dalam WIB tanpa zona waktu ("2026-10-08 13:00:00").
 * `new Date()` biasa akan membacanya sebagai waktu lokal server (UTC di Vercel),
 * sehingga meleset 7 jam.
 */
export function parseMidtransTime(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const date = MIDTRANS_TIME_PATTERN.test(trimmed)
    ? new Date(`${trimmed.replace(" ", "T")}+07:00`)
    : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createMidtransSnapTransaction(
  input: MidtransTransactionInput,
): Promise<MidtransTransactionResponse> {
  const response = await fetch(`${getMidtransBaseUrl()}/snap/v1/transactions`, {
    method: "POST",
    headers: {
      Authorization: getAuthorizationHeader(),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      transaction_details: {
        order_id: input.orderId,
        gross_amount: input.grossAmount,
      },
      item_details: input.items,
      customer_details: input.customer,
      expiry: {
        unit: "minutes",
        duration: input.expiryDurationMinutes ?? 60,
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | (MidtransTransactionResponse & { error_messages?: string[] })
    | null;

  if (!response.ok || !payload?.token || !payload?.redirect_url) {
    const message =
      payload?.error_messages?.join(", ") ||
      `Midtrans request failed with status ${response.status}`;
    throw new Error(message);
  }

  return {
    token: payload.token,
    redirect_url: payload.redirect_url,
  };
}
