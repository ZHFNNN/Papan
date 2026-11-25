import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 1: Registrasi & verifikasi email
 * Unit: POST /api/auth/register (app/api/auth/register/route.ts)
 */

const { sendVerificationEmail } = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("@/lib/mailer", () => ({ sendVerificationEmail }));
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed") }));

const { POST } = await import("@/app/api/auth/register/route");

const body = {
  name: "Budi",
  username: "budi01",
  email: "budi@test.local",
  phoneNumber: "081234567890",
  password: "rahasia123",
  confirmPassword: "rahasia123",
};
const register = (b: unknown) => POST(makeRequest("/api/auth/register", { method: "POST", body: b }));

beforeEach(() => {
  resetPrismaMock();
  sendVerificationEmail.mockReset();
});

describe("TC-WB-REG — Registrasi akun", () => {
  it("TC-WB-REG-01: data valid → 201, akun & token verifikasi dibuat, email verifikasi dikirim", async () => {
    const { status } = await readJson(await register(body));
    expect(status).toBe(201);
    expect(prismaMock.user.create).toHaveBeenCalled();
    expect(prismaMock.verificationToken.create).toHaveBeenCalled();
    expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  });

  it("TC-WB-REG-02: email sudah terdaftar → 409, akun tidak dibuat", async () => {
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.email ? { passwordHash: "x", emailVerified: new Date() } : null,
    );
    const { status, body: res } = await readJson(await register(body));
    expect([status, res.message]).toEqual([409, "Email sudah terdaftar"]);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it("TC-WB-REG-03: konfirmasi password tidak sama → 400 (validasi skema)", async () => {
    const { status } = await readJson(await register({ ...body, confirmPassword: "berbeda123" }));
    expect(status).toBe(400);
  });

  it("TC-WB-REG-04: email verifikasi gagal dikirim → akun & token dihapus lagi (rollback), 500", async () => {
    sendVerificationEmail.mockRejectedValue(new Error("SMTP mati"));
    const { status } = await readJson(await register(body));
    expect(status).toBe(500);
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled();
    expect(prismaMock.user.delete).toHaveBeenCalledWith({ where: { email: "budi@test.local" } });
  });
});
