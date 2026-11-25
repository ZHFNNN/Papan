import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAsAdmin, loginAsOwner } from "../helpers/session";
import { ctx, makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 16: Notifikasi
 * Unit: PATCH /api/admin/notifications/[id]/read, POST /api/admin/notifications/send
 */

const { sendNotificationEmail } = vi.hoisted(() => ({ sendNotificationEmail: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);
vi.mock("@/lib/mailer", () => ({ sendNotificationEmail }));

const markRead = await import("@/app/api/admin/notifications/[id]/read/route");
const send = await import("@/app/api/admin/notifications/send/route");

const read = () => markRead.PATCH(makeRequest("/api/admin/notifications/n1/read", { method: "PATCH" }), ctx({ id: "n1" }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  sendNotificationEmail.mockReset();
});

describe("TC-WB-NTF — Notifikasi", () => {
  it("TC-WB-NTF-01: tandai notifikasi milik sendiri sebagai dibaca → isRead true", async () => {
    loginAsOwner();
    prismaMock.notification.findUnique.mockResolvedValue({ id: "n1", ownerId: "owner-1" });
    expect((await read()).status).toBe(200);
    expect(prismaMock.notification.update).toHaveBeenCalledWith({ where: { id: "n1" }, data: { isRead: true } });
  });

  it("TC-WB-NTF-02: tandai notifikasi milik orang lain → 404, tidak diubah", async () => {
    loginAsOwner();
    prismaMock.notification.findUnique.mockResolvedValue({ id: "n1", ownerId: "owner-2" });
    expect((await read()).status).toBe(404);
    expect(prismaMock.notification.update).not.toHaveBeenCalled();
  });

  it("TC-WB-NTF-03: broadcast admin → notifikasi dibuat untuk setiap owner terverifikasi & email dikirim", async () => {
    loginAsAdmin();
    prismaMock.user.findMany
      .mockResolvedValueOnce([{ id: "o1" }, { id: "o2" }])
      .mockResolvedValueOnce([{ id: "o1", email: "o1@test" }, { id: "o2", email: "o2@test" }]);
    const res = await send.POST(
      makeRequest("/api/admin/notifications/send", { method: "POST", body: { title: "Promo", message: "Diskon", imageUrl: null, category: null, city: null } }),
    );
    expect((await readJson(res)).body).toMatchObject({ count: 2, emailSent: 2 });
    expect(prismaMock.notification.createMany.mock.calls[0][0].data).toHaveLength(2);
  });
});
