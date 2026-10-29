import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests untuk DELETE /api/admin/reviews/[reviewId] (admin menghapus review dari halaman Moderasi Review).
 * Database diganti penyimpanan di memori dan sesi login di-mock, jadi test tidak butuh database sungguhan.
 */

type ReviewRow = {
  id: string;
  userId: string;
  propertyId: string;
  rating: number;
  comment: string | null;
  imageUrls: string[];
  createdAt: Date;
  updatedAt: Date;
};

type NotificationRow = {
  id: string;
  ownerId: string;
  title: string;
  message: string;
  imageUrl: string | null;
  isRead: boolean;
  type: string;
  createdAt: Date;
};

const { db, requireAdmin } = vi.hoisted(() => ({
  db: {
    properties: new Map<string, { id: string; title: string }>(),
    reviews: new Map<string, ReviewRow>(),
    notifications: [] as NotificationRow[],
  },
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({ requireAdmin }));

vi.mock("@/lib/prisma", () => {
  const tx = {
    review: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const review = db.reviews.get(where.id);
        return review ? { ...review, property: db.properties.get(review.propertyId)! } : null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const review = db.reviews.get(where.id);
        if (!review) throw new Error("Record to delete does not exist.");
        db.reviews.delete(where.id);
        return review;
      },
    },
    notification: {
      create: async ({ data }: { data: Pick<NotificationRow, "ownerId" | "title" | "message" | "type"> }) => {
        const row: NotificationRow = {
          id: `notif-${db.notifications.length + 1}`,
          imageUrl: null,
          isRead: false,
          createdAt: new Date(),
          ...data,
        };
        db.notifications.push(row);
        return row;
      },
    },
  };
  return {
    prisma: { ...tx, $transaction: async <T>(fn: (client: typeof tx) => Promise<T>) => fn(tx) },
  };
});

import { DELETE } from "@/app/api/admin/reviews/[reviewId]/route";

const ADMIN_SESSION = {
  user: { id: "admin-1", role: "ADMIN", name: "Admin Papan", email: "admin@papan.test" },
  expires: "2099-01-01T00:00:00.000Z",
};

async function callDelete(body: unknown, reviewId = "review-1"): Promise<Response> {
  const request = new Request(`http://localhost/api/admin/reviews/${reviewId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await DELETE(request, { params: Promise.resolve({ reviewId }) });
  if (!res) throw new Error("Route tidak mengembalikan response.");
  return res;
}

beforeEach(() => {
  db.properties.clear();
  db.reviews.clear();
  db.notifications.length = 0;

  db.properties.set("prop-1", { id: "prop-1", title: "Kos Melati Jatinangor" });
  db.reviews.set("review-1", {
    id: "review-1",
    userId: "user-1",
    propertyId: "prop-1",
    rating: 1,
    comment: "Promo kos lain, hubungi 08xx",
    imageUrls: [],
    createdAt: new Date("2026-10-20T10:00:00Z"),
    updatedAt: new Date("2026-10-20T10:00:00Z"),
  });

  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue({ session: ADMIN_SESSION });
});

describe("DELETE /api/admin/reviews/[reviewId] — hapus review oleh admin", () => {
  // D1: selain admin tidak boleh menghapus review orang lain
  it("D1: returns the auth error and keeps the review for non-admins", async () => {
    requireAdmin.mockResolvedValue({ error: Response.json({ message: "Forbidden" }, { status: 403 }) });

    const res = await callDelete({ reason: "Spam atau promosi" });

    expect(res.status).toBe(403);
    expect(db.reviews.has("review-1")).toBe(true);
    expect(db.notifications).toHaveLength(0);
  });

  // D2: alasan tidak valid -> 400, review tetap ada
  it("D2: rejects a too-short reason with 400 and keeps the review", async () => {
    const res = await callDelete({ reason: "ab" });

    expect(res.status).toBe(400);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.reviews.has("review-1")).toBe(true);
  });

  // D3: body bukan JSON -> 400, bukan error 500
  it("D3: rejects a malformed JSON body with 400", async () => {
    const res = await callDelete("{bukan json");

    expect(res.status).toBe(400);
    expect(db.reviews.has("review-1")).toBe(true);
  });

  // D4: review tidak ada -> 404 tanpa notifikasi
  it("D4: returns 404 for an unknown review", async () => {
    const res = await callDelete({ reason: "Spam atau promosi" }, "review-x");

    expect(res.status).toBe(404);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.notifications).toHaveLength(0);
  });

  // D5: sukses -> review terhapus dan penulisnya (bukan admin) dapat notifikasi berisi alasan
  it("D5: deletes the review and notifies its author with the reason", async () => {
    const res = await callDelete({ reason: "  Spam atau promosi  " });

    expect(res.status).toBe(200);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.reviews.has("review-1")).toBe(false);

    expect(db.notifications).toHaveLength(1);
    const [notification] = db.notifications;
    expect(notification.ownerId).toBe("user-1");
    expect(notification.type).toBe("REVIEW_REMOVED");
    expect(notification.message).toContain("Spam atau promosi");
    expect(notification.message).toContain("Kos Melati Jatinangor");
    expect(notification.message).not.toMatch(/\s{2,}/);
  });
});
