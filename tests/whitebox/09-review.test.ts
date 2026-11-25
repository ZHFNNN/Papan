import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { ctx, makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 9: Review (tulis & lapor)
 * Unit: POST /api/properties/[id]/reviews, POST /api/reviews/[id]/report
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const reviews = await import("@/app/api/properties/[id]/reviews/route");
const report = await import("@/app/api/reviews/[id]/report/route");

const postReview = (body: unknown) =>
  reviews.POST(makeRequest("/api/properties/p1/reviews", { method: "POST", body }), ctx({ id: "p1" }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAs({ id: "u1" });
});

describe("TC-WB-REV — Review", () => {
  it("TC-WB-REV-01: ulasan pertama untuk properti orang lain → 201 tersimpan", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: "o1" });
    prismaMock.review.findUnique.mockResolvedValue(null);
    prismaMock.review.create.mockResolvedValue({ id: "r1" });
    expect((await postReview({ rating: 5, comment: "Bersih" })).status).toBe(201);
    expect(prismaMock.review.create.mock.calls[0][0].data).toMatchObject({ rating: 5, userId: "u1", propertyId: "p1" });
  });

  it("TC-WB-REV-02: user sudah pernah mengulas properti ini → 409", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: "o1" });
    prismaMock.review.findUnique.mockResolvedValue({ id: "r-lama" });
    expect((await postReview({ rating: 4 })).status).toBe(409);
  });

  it("TC-WB-REV-03: owner mengulas propertinya sendiri → 403", async () => {
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: "u1" });
    expect((await postReview({ rating: 5 })).status).toBe(403);
  });

  it("TC-WB-REV-04: rating di luar 1–5 → 400", async () => {
    expect((await postReview({ rating: 6 })).status).toBe(400);
  });

  it("TC-WB-REV-05: laporkan ulasan orang lain → 201 masuk antrean admin; melaporkan ulasan sendiri → 400", async () => {
    const send = () =>
      report.POST(makeRequest("/api/reviews/r1/report", { method: "POST", body: { reason: "Spam promosi" } }), ctx({ id: "r1" }));
    prismaMock.review.findUnique.mockResolvedValue({ id: "r1", userId: "u2" });
    prismaMock.reviewReport.findUnique.mockResolvedValue(null);
    expect((await send()).status).toBe(201);
    expect(prismaMock.reviewReport.create).toHaveBeenCalled();
    prismaMock.review.findUnique.mockResolvedValue({ id: "r1", userId: "u1" });
    expect((await readJson(await send())).status).toBe(400);
  });
});
