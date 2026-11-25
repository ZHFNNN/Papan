import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock, resetPrismaMock } from "../helpers/prisma-mock";
import { getServerSessionMock, loginAs } from "../helpers/session";
import { ctx, makeRequest } from "../helpers/request";

/**
 * White box — Fitur 11: Chat
 * Unit: POST /api/conversations, GET /api/conversations/[id]/messages
 */

vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
vi.mock("next-auth", async () => ({ getServerSession: (await import("../helpers/session")).getServerSessionMock }));
vi.mock("@/lib/auth", async () => (await import("../helpers/session")).authModuleMock);

const conversations = await import("@/app/api/conversations/route");
const messages = await import("@/app/api/conversations/[conversationId]/messages/route");

const start = () =>
  conversations.POST(makeRequest("/api/conversations", { method: "POST", body: { propertyId: "p1", initialMessage: "Halo" } }));

beforeEach(() => {
  resetPrismaMock();
  getServerSessionMock.mockReset();
  loginAs({ id: "u1" });
  prismaMock.property.findUnique.mockResolvedValue({ id: "p1", ownerId: "o1" });
});

describe("TC-WB-CHT — Chat", () => {
  it("TC-WB-CHT-01: belum pernah chat → percakapan baru dibuat bersama pesan pertama", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue(null);
    prismaMock.conversation.create.mockResolvedValue({ id: "c1" });
    expect((await start()).status).toBe(201);
    expect(prismaMock.conversation.create).toHaveBeenCalled();
  });

  it("TC-WB-CHT-02: percakapan sudah ada → pesan ditambahkan ke percakapan yang sama", async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({ id: "c1" });
    await start();
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(prismaMock.message.create.mock.calls[0][0].data).toMatchObject({ conversationId: "c1", content: "Halo" });
  });

  it("TC-WB-CHT-03: membuka percakapan orang lain → 404, pesan tidak ditandai dibaca", async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null);
    const res = await messages.GET(makeRequest("/api/conversations/c9/messages"), ctx({ conversationId: "c9" }));
    expect(res.status).toBe(404);
    expect(prismaMock.message.updateMany).not.toHaveBeenCalled();
  });
});
