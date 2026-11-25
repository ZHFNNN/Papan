import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePriorities } from "@/lib/dss/priorities";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 4: Personalisasi & prioritas DSS
 * Unit: parsePriorities() (lib/dss/priorities.ts) dan POST /api/personalisasi
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const { POST } = await import("@/app/api/personalisasi/route");

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
});

describe("TC-WB-PER — Personalisasi & prioritas", () => {
  it("TC-WB-PER-01: prioritas lengkap bernilai 1–3 → valid", () => {
    expect(parsePriorities({ budget: 3, location: 2, facilities: 1 })).toEqual({
      ok: true,
      value: { budget: 3, location: 2, facilities: 1 },
    });
  });

  it("TC-WB-PER-02: prioritas di luar 1–3 → ditolak dengan pesan per kriteria", () => {
    expect(parsePriorities({ budget: 4, location: 2, facilities: 1 })).toEqual({
      ok: false,
      error: "priorities.budget harus 1, 2, atau 3.",
    });
  });

  it("TC-WB-PER-03: prioritas tidak dikirim → null (bobot lama tidak diubah)", () => {
    expect(parsePriorities(undefined)).toEqual({ ok: true, value: null });
  });

  it("TC-WB-PER-04: simpan personalisasi → rentang budget dipetakan & 3 bobot kriteria disimpan", async () => {
    loginAs({ id: "u1" });
    prismaMock.userPersonalization.upsert.mockResolvedValue({ id: "p1" });
    prismaMock.facility.findMany.mockResolvedValue([]);
    prismaMock.userCriteriaWeight.findMany.mockResolvedValue([]);
    const res = await POST(
      makeRequest("/api/personalisasi", {
        method: "POST",
        body: {
          location: "Dago",
          occupation: "Mahasiswa",
          budget: "2 - 4 juta",
          priorities: { budget: 1, location: 3, facilities: 2 },
        },
      }),
    );
    expect((await readJson(res)).status).toBe(200);
    expect(prismaMock.userPersonalization.upsert.mock.calls[0][0].create).toMatchObject({
      budgetMin: 2_000_000,
      budgetMax: 4_000_000,
    });
    expect(prismaMock.userCriteriaWeight.upsert).toHaveBeenCalledTimes(3);
  });
});
