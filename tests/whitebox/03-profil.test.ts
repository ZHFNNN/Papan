import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 3: Profil
 * Unit: PATCH /api/profile
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const { PATCH } = await import("@/app/api/profile/route");
const valid = { name: "Budi", username: "budi01", phoneNumber: "081234567890", image: "https://img/a.jpg" };
const patch = (b: unknown) => PATCH(makeRequest("/api/profile", { method: "PATCH", body: b }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAs({ email: "budi@test.local" });
});

describe("TC-WB-PRF — Edit profil", () => {
  it("TC-WB-PRF-01: data valid & unik → 200, data diperbarui", async () => {
    prismaMock.user.update.mockResolvedValue({ id: "u1", ...valid });
    const { status } = await readJson(await patch(valid));
    expect(status).toBe(200);
    expect(prismaMock.user.update.mock.calls[0][0].data).toMatchObject({ username: "budi01", image: "https://img/a.jpg" });
  });

  it("TC-WB-PRF-02: username dipakai user lain → 409, data tidak diubah", async () => {
    prismaMock.user.findFirst.mockResolvedValueOnce({ id: "u2" });
    const { status, body } = await readJson(await patch(valid));
    expect([status, body.message]).toEqual([409, "Username sudah digunakan."]);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it("TC-WB-PRF-03: field wajib kosong → 400", async () => {
    expect((await patch({ ...valid, name: "" })).status).toBe(400);
  });
});
