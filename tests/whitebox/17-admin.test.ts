import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, invalidateRoleCacheMock, loginAs, loginAsAdmin, logout } from "../helpers/session";
import { ctx, makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 17: Admin
 * Unit: PATCH /api/admin/kyc/[id]/approve|reject, DELETE /api/admin/reviews/[reviewId]
 *       (guard requireAdmin ikut teruji di setiap route)
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const approve = await import("@/app/api/admin/kyc/[id]/approve/route");
const reject = await import("@/app/api/admin/kyc/[id]/reject/route");
const adminReview = await import("@/app/api/admin/reviews/[reviewId]/route");

const doApprove = () => approve.PATCH(makeRequest("/api/admin/kyc/k1/approve", { method: "PATCH" }), ctx({ id: "k1" }));
const doReject = (body: unknown) =>
  reject.PATCH(makeRequest("/api/admin/kyc/k1/reject", { method: "PATCH", body }), ctx({ id: "k1" }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  invalidateRoleCacheMock.mockReset();
});

describe("TC-WB-ADM — Admin", () => {
  it("TC-WB-ADM-01: endpoint admin diakses tanpa login → 401; oleh user biasa → 403", async () => {
    logout();
    expect((await doApprove()).status).toBe(401);
    loginAs({ role: "USER" });
    expect((await doApprove()).status).toBe(403);
  });

  it("TC-WB-ADM-02: admin menyetujui KYC → pengajuan & status user APPROVED, cache role diperbarui", async () => {
    loginAsAdmin();
    prismaMock.kycSubmission.findUnique.mockResolvedValue({ id: "k1", userId: "owner-1" });
    prismaMock.kycSubmission.update.mockResolvedValue({ id: "k1" });
    expect((await doApprove()).status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "owner-1" }, data: { kycStatus: "APPROVED" } });
    expect(invalidateRoleCacheMock).toHaveBeenCalledWith("owner-1");
  });

  it("TC-WB-ADM-03: tolak KYC tanpa alasan yang cukup (< 3 karakter) → 400; dengan alasan → REJECTED", async () => {
    loginAsAdmin();
    expect((await doReject({ reason: "no" })).status).toBe(400);
    prismaMock.kycSubmission.findUnique.mockResolvedValue({ id: "k1", userId: "owner-1" });
    prismaMock.kycSubmission.update.mockResolvedValue({ id: "k1" });
    expect((await doReject({ reason: "Foto KTP buram" })).status).toBe(200);
    expect(prismaMock.kycSubmission.update.mock.calls[0][0].data).toMatchObject({ status: "REJECTED", adminNotes: "Foto KTP buram" });
  });

  it("TC-WB-ADM-04: admin menghapus review → review dihapus & penulis menerima notifikasi berisi alasan", async () => {
    loginAsAdmin();
    prismaMock.review.findUnique.mockResolvedValue({ id: "r1", userId: "u1", property: { title: "Kos Melati" } });
    const res = await adminReview.DELETE(
      makeRequest("/api/admin/reviews/r1", { method: "DELETE", body: { reason: "Kata kasar" } }),
      ctx({ reviewId: "r1" }),
    );
    expect((await readJson(res)).status).toBe(200);
    expect(prismaMock.review.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    const notification = prismaMock.notification.create.mock.calls[0][0].data;
    expect(notification.ownerId).toBe("u1");
    expect(notification.message).toContain("Kata kasar");
  });
});
