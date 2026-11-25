import { vi } from "vitest";

/**
 * Mock sesi NextAuth untuk route handler.
 * `lib/require-user.ts` dan route yang memanggil `getServerSession` langsung
 * sama-sama lewat fungsi ini, jadi satu mock mencakup keduanya.
 *
 * Pakai di file test:
 *   vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
 *   vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);
 */
export const getServerSessionMock = vi.fn();

export const invalidateRoleCacheMock = vi.fn();

export const authModuleMock = {
  authOptions: {},
  invalidateRoleCache: invalidateRoleCacheMock,
};

type SessionUser = {
  id?: string;
  role?: "USER" | "OWNER" | "ADMIN";
  email?: string;
  name?: string;
  kycStatus?: string;
};

export function loginAs(user: SessionUser = {}) {
  const sessionUser = {
    id: "user-1",
    role: "USER",
    email: "user@test.local",
    name: "User Test",
    ...user,
  };
  getServerSessionMock.mockResolvedValue({ user: sessionUser, expires: "2099-01-01" });
  return sessionUser;
}

export const loginAsOwner = (user: SessionUser = {}) =>
  loginAs({ id: "owner-1", role: "OWNER", email: "owner@test.local", ...user });

export const loginAsAdmin = (user: SessionUser = {}) =>
  loginAs({ id: "admin-1", role: "ADMIN", email: "admin@test.local", ...user });

export function logout() {
  getServerSessionMock.mockResolvedValue(null);
}
