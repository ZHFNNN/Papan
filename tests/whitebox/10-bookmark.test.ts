import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { ctx, makeRequest } from "../helpers/request";

/**
 * White box — Fitur 10: Bookmark
 * Unit: POST /api/bookmarks, DELETE /api/bookmarks/[id]
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const bookmarks = await import("@/app/api/bookmarks/route");
const bookmarkItem = await import("@/app/api/bookmarks/[id]/route");

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAs({ id: "u1" });
});

describe("TC-WB-BMK — Bookmark", () => {
  it("TC-WB-BMK-01: simpan properti yang ada → 201 (upsert, aman bila diklik dua kali)", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ id: "p1" });
    const res = await bookmarks.POST(makeRequest("/api/bookmarks", { method: "POST", body: { propertyId: "p1" } }));
    expect(res.status).toBe(201);
    expect(prismaMock.bookmark.upsert.mock.calls[0][0].update).toEqual({});
  });

  it("TC-WB-BMK-02: simpan properti yang tidak ada → 404", async () => {
    prismaMock.property.findUnique.mockResolvedValue(null);
    const res = await bookmarks.POST(makeRequest("/api/bookmarks", { method: "POST", body: { propertyId: "x" } }));
    expect(res.status).toBe(404);
  });

  it("TC-WB-BMK-03: hapus bookmark yang belum disimpan → 404, tidak menghapus apa pun", async () => {
    prismaMock.bookmark.findUnique.mockResolvedValue(null);
    const res = await bookmarkItem.DELETE(makeRequest("/api/bookmarks/p1", { method: "DELETE" }), ctx({ id: "p1" }));
    expect(res.status).toBe(404);
    expect(prismaMock.bookmark.delete).not.toHaveBeenCalled();
  });
});
