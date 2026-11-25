import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canTransitionPaymentStatus, getMidtransSignatureKey } from "@/lib/midtrans";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAsOwner } from "../helpers/session";
import { makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 14: Booster & pembayaran Midtrans
 * Unit: POST /api/owner/boosts/checkout, POST /api/owner/boosts/webhook, canTransitionPaymentStatus()
 */

const { createSnap } = vi.hoisted(() => ({ createSnap: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);
vi.mock("@/lib/property-list-cache", () => ({ invalidatePropertyListCache: vi.fn() }));
vi.mock("@/lib/midtrans", async (orig) => ({
  ...(await orig<typeof import("@/lib/midtrans")>()),
  createMidtransSnapTransaction: createSnap,
}));

const checkout = await import("@/app/api/owner/boosts/checkout/route");
const webhook = await import("@/app/api/owner/boosts/webhook/route");

const original = { ...process.env };
beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  createSnap.mockReset();
  process.env.MIDTRANS_SERVER_KEY = "SB-test-key";
});
afterEach(() => {
  process.env = { ...original };
});

const postCheckout = () =>
  checkout.POST(
    makeRequest("/api/owner/boosts/checkout", {
      method: "POST",
      body: { items: [{ propertyId: "p1", packageId: "mingguan" }], paymentMethod: "MIDTRANS" },
    }),
  );

const notif = (extra: Record<string, string> = {}) => {
  const base = { order_id: "BOOST-1", status_code: "200", gross_amount: "101000.00", transaction_status: "settlement" };
  return {
    ...base,
    signature_key: getMidtransSignatureKey({ orderId: base.order_id, statusCode: base.status_code, grossAmount: base.gross_amount }),
    ...extra,
  };
};
const payment = {
  id: "pay-1",
  orderId: "BOOST-1",
  ownerId: "owner-1",
  status: "PENDING",
  grossAmount: 101_000,
  items: [{ propertyId: "p1", packageId: "mingguan", packageTitle: "Paket Mingguan", days: 7, price: 100_000 }],
};
const postWebhook = (body: unknown) => webhook.POST(makeRequest("/api/owner/boosts/webhook", { method: "POST", body }));

describe("TC-WB-BST — Booster & pembayaran", () => {
  it("TC-WB-BST-01: checkout paket valid → transaksi PENDING (harga dari server + biaya admin) & Snap dibuat", async () => {
    loginAsOwner();
    prismaMock.property.findMany.mockResolvedValue([{ id: "p1", title: "Kos A", boosts: [] }]);
    prismaMock.boostPayment.create.mockResolvedValue({ id: "pay-1" });
    createSnap.mockResolvedValue({ token: "tok", redirect_url: "https://snap" });
    expect((await readJson(await postCheckout())).status).toBe(200);
    expect(prismaMock.boostPayment.create.mock.calls[0][0].data).toMatchObject({ status: "PENDING", subtotal: 100_000, grossAmount: 101_000 });
  });

  it("TC-WB-BST-02: properti masih punya booster aktif → 409", async () => {
    loginAsOwner();
    prismaMock.property.findMany.mockResolvedValue([{ id: "p1", title: "Kos A", boosts: [{ id: "b" }] }]);
    expect((await postCheckout()).status).toBe(409);
  });

  it("TC-WB-BST-03: notifikasi Midtrans dengan signature palsu → 401, database tidak disentuh", async () => {
    expect((await postWebhook(notif({ signature_key: "palsu" }))).status).toBe(401);
    expect(prismaMock.boostPayment.findUnique).not.toHaveBeenCalled();
  });

  it("TC-WB-BST-04: notifikasi settlement → pembayaran PAID & boost 7 hari dibuat", async () => {
    prismaMock.boostPayment.findUnique.mockResolvedValue(payment);
    prismaMock.boostPayment.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.property.findMany.mockResolvedValue([{ id: "p1", boosts: [] }]);
    expect((await postWebhook(notif())).status).toBe(200);
    expect(prismaMock.propertyBoost.create.mock.calls[0][0].data).toMatchObject({ propertyId: "p1", days: 7 });
  });

  it("TC-WB-BST-05: notifikasi PAID terkirim dua kali → boost tidak dibuat ganda", async () => {
    prismaMock.boostPayment.findUnique.mockResolvedValue({ ...payment, status: "PROCESSING" });
    prismaMock.boostPayment.updateMany.mockResolvedValue({ count: 0 });
    await postWebhook(notif());
    expect(prismaMock.propertyBoost.create).not.toHaveBeenCalled();
  });

  it("TC-WB-BST-06: status PAID bersifat final; transaksi gagal masih bisa berubah jadi PAID", () => {
    expect(canTransitionPaymentStatus("PAID", "EXPIRED")).toBe(false);
    expect(canTransitionPaymentStatus("FAILED", "PAID")).toBe(true);
    expect(canTransitionPaymentStatus("EXPIRED", "PENDING")).toBe(false);
  });
});
