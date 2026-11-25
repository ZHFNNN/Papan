import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAsOwner } from "../helpers/session";
import { ctx, makeRequest, readJson } from "../helpers/request";

/**
 * White box — Fitur 13: Kelola properti owner
 * Unit: POST /api/owner/properties, PATCH /api/owner/properties/[id]
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);
vi.mock("@/lib/facilities", () => ({ resolveFacilityRecords: vi.fn(async () => []) }));

const collection = await import("@/app/api/owner/properties/route");
const item = await import("@/app/api/owner/properties/[id]/route");

const photo = (n: number) => `https://res.cloudinary.com/demo/image/upload/v1/papan/properties/owner1_hash${n}.jpg`;
const valid = {
  title: "Kos Melati",
  price: "1500000",
  listingType: "SEWA",
  category: "KOSAN",
  genderTarget: "PUTRI",
  address: "Jl. Mawar",
  imageUrls: [photo(1), photo(2), photo(3), photo(4)],
};
const create = (body: unknown) => collection.POST(makeRequest("/api/owner/properties", { method: "POST", body }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAsOwner();
  prismaMock.user.findUnique.mockResolvedValue({ kycStatus: "APPROVED" });
});

describe("TC-WB-OWN — Kelola properti", () => {
  it("TC-WB-OWN-01: KYC owner belum disetujui → 403, properti tidak dibuat", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ kycStatus: "PENDING" });
    expect((await create(valid)).status).toBe(403);
    expect(prismaMock.property.create).not.toHaveBeenCalled();
  });

  it("TC-WB-OWN-02: foto kurang dari 4 → 400", async () => {
    const { status, body } = await readJson(await create({ ...valid, imageUrls: [photo(1), photo(2), photo(3)] }));
    expect([status, body.message]).toEqual([400, "Minimal 4 foto properti."]);
  });

  it("TC-WB-OWN-03: ada foto kembar (gambar sama diunggah dua kali) → 400", async () => {
    const dup = photo(1).replace("/v1/", "/v2/");
    expect((await create({ ...valid, imageUrls: [photo(1), photo(2), photo(3), dup] })).status).toBe(400);
  });

  it("TC-WB-OWN-04: kosan tanpa tipe gender → 400; data lengkap → 201", async () => {
    expect((await create({ ...valid, genderTarget: undefined })).status).toBe(400);
    prismaMock.property.create.mockResolvedValue({ id: "p1" });
    expect((await create(valid)).status).toBe(201);
  });

  it("TC-WB-OWN-05: edit diskon di luar 1–99% → 400; diskon milik owner lain → 403", async () => {
    const patch = (body: unknown) =>
      item.PATCH(makeRequest("/api/owner/properties/p1", { method: "PATCH", body }), ctx({ id: "p1" }));
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: "owner-1", category: "RUMAH", genderTarget: null });
    expect((await patch({ title: "A", price: 1000, listingType: "SEWA", discountPercentage: 150 })).status).toBe(400);
    prismaMock.property.findUnique.mockResolvedValue({ ownerId: "owner-2", category: "RUMAH", genderTarget: null });
    expect((await patch({ title: "A", price: 1000, listingType: "SEWA", discountPercentage: 10 })).status).toBe(403);
  });
});
