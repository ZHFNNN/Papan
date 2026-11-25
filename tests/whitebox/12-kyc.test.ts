import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateKycForm } from "@/lib/frontend/form-validation";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAsOwner } from "../helpers/session";
import { makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 12: KYC owner
 * Unit: POST /api/kyc/submit dan validateKycForm() (lib/frontend/form-validation.ts)
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const { POST } = await import("@/app/api/kyc/submit/route");

const UUID = "123e4567-e89b-12d3-a456-426614174000";
const form = {
  nik: "3273010101010001",
  fullName: "Pak Owner",
  phoneNumber: "081234567890",
  province: "Jawa Barat",
  cityOrRegency: "Bandung",
  district: "Coblong",
  rt: "001",
  rw: "002",
  postalCode: "40132",
  ktpImageUrl: `papan/ktp/owner-1/${UUID}`,
  selfieImageUrl: `papan/selfie/owner-1/${UUID}`,
};
const submit = (body: unknown) => POST(makeRequest("/api/kyc/submit", { method: "POST", body }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAsOwner();
});

describe("TC-WB-KYC — Verifikasi KYC owner", () => {
  it("TC-WB-KYC-01: data lengkap & foto milik sendiri → pengajuan PENDING", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "owner-1", kycStatus: "NONE", kycSubmission: null });
    expect((await submit(form)).status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: "owner-1" }, data: { kycStatus: "PENDING" } });
  });

  it("TC-WB-KYC-02: pengajuan masih ditinjau (PENDING) → 400, tidak bisa kirim ulang", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "owner-1", kycStatus: "PENDING" });
    expect((await readJson(await submit(form))).body.message).toBe("Pengajuan sedang ditinjau.");
  });

  it("TC-WB-KYC-03: foto KTP milik user lain → 400", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: "owner-1", kycStatus: "NONE", kycSubmission: null });
    expect((await submit({ ...form, ktpImageUrl: `papan/ktp/owner-2/${UUID}` })).status).toBe(400);
  });

  it("TC-WB-KYC-04: validasi form — NIK bukan 16 digit & kode pos bukan 5 digit ditolak", () => {
    const errors = validateKycForm({ ...form, nik: "12345", postalCode: "401" });
    expect(errors).toEqual({ nik: "NIK harus tepat 16 digit.", postalCode: "Kode pos harus 5 digit." });
  });
});
