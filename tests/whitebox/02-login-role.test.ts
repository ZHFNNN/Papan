import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";

/**
 * White box — Fitur 2: Login & role
 * Unit: authorize() di lib/auth.ts (login email/password)
 * Guard role (requireAdmin) diuji di 17-admin.test.ts lewat route admin.
 */

const { compareMock } = vi.hoisted(() => ({ compareMock: vi.fn() }));

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("bcryptjs", () => ({ compare: compareMock }));
vi.mock("@next-auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));

const { authOptions } = await import("@/lib/auth");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const credentials = authOptions.providers.find((p: any) => p.id === "credentials") as any;
const authorize = credentials.options.authorize as (c: Record<string, string>) => Promise<unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const session = authOptions.callbacks!.session as (args: any) => Promise<any>;

const user = {
  id: "u1",
  email: "budi@test.local",
  name: "Budi",
  role: "USER",
  kycStatus: "NONE",
  passwordHash: "h",
  emailVerified: new Date(),
};

beforeEach(() => {
  resetPrismaMock();
  compareMock.mockReset();
});

describe("TC-WB-AUTH — Login & role", () => {
  it("TC-WB-AUTH-01: email & password benar → data user (id, role, kycStatus)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    compareMock.mockResolvedValue(true);
    expect(await authorize({ email: "budi@test.local", password: "rahasia123" })).toMatchObject({ id: "u1", role: "USER" });
  });

  it("TC-WB-AUTH-02: password salah → null (login ditolak)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(user);
    compareMock.mockResolvedValue(false);
    expect(await authorize({ email: "budi@test.local", password: "salah1234" })).toBeNull();
  });

  it("TC-WB-AUTH-03: email belum diverifikasi → null tanpa cek password", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, emailVerified: null });
    expect(await authorize({ email: "budi@test.local", password: "rahasia123" })).toBeNull();
    expect(compareMock).not.toHaveBeenCalled();
  });

  it("TC-WB-AUTH-04: akun Google (tanpa password) login dengan password → null", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...user, passwordHash: null });
    expect(await authorize({ email: "budi@test.local", password: "rahasia123" })).toBeNull();
  });

  it("TC-WB-AUTH-05: sesi tanpa role/kyc di token → default USER & NONE", async () => {
    const result = await session({ session: { user: {} }, token: { sub: "u1" } });
    expect(result.user).toMatchObject({ id: "u1", role: "USER", kycStatus: "NONE" });
  });
});
