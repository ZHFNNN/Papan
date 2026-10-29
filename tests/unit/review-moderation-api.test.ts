import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unit tests untuk API moderasi review: user melaporkan review, admin melihat laporan,
 * menolak laporan, atau menghapus review.
 * Database diganti penyimpanan di memori dan sesi login di-mock, jadi test tidak butuh database sungguhan.
 */

type UserRow = { id: string; name: string | null; username: string | null; email: string | null };

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

type ReportStatus = "PENDING" | "DISMISSED";

type ReportRow = {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
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

const { db, requireAuth, requireAdmin } = vi.hoisted(() => ({
  db: {
    users: new Map<string, UserRow>(),
    properties: new Map<string, { id: string; title: string }>(),
    reviews: new Map<string, ReviewRow>(),
    reports: [] as ReportRow[],
    notifications: [] as NotificationRow[],
  },
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/require-user", () => ({ requireAuth, requireAdmin }));

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
        // onDelete: Cascade di ReviewReport
        db.reports = db.reports.filter((report) => report.reviewId !== where.id);
        return review;
      },
    },
    reviewReport: {
      findUnique: async ({
        where,
      }: {
        where: { reviewId_reporterId: { reviewId: string; reporterId: string } };
      }) => {
        const { reviewId, reporterId } = where.reviewId_reporterId;
        return db.reports.find((r) => r.reviewId === reviewId && r.reporterId === reporterId) ?? null;
      },
      create: async ({ data }: { data: Pick<ReportRow, "reviewId" | "reporterId" | "reason"> }) => {
        if (db.reports.some((r) => r.reviewId === data.reviewId && r.reporterId === data.reporterId)) {
          throw new Error("Unique constraint failed on the fields: (`reviewId`,`reporterId`)");
        }
        const row: ReportRow = {
          id: `report-${db.reports.length + 1}`,
          status: "PENDING",
          createdAt: new Date(),
          ...data,
        };
        db.reports.push(row);
        return row;
      },
      // Bentuk hasil sama dengan select di GET /api/admin/review-reports
      findMany: async ({ where }: { where: { status: ReportStatus } }) =>
        db.reports
          .filter((report) => report.status === where.status)
          .map((report) => {
            const reporter = db.users.get(report.reporterId)!;
            const review = db.reviews.get(report.reviewId)!;
            return {
              id: report.id,
              reason: report.reason,
              createdAt: report.createdAt,
              reporter: { id: reporter.id, name: reporter.name, username: reporter.username },
              review: {
                id: review.id,
                rating: review.rating,
                comment: review.comment,
                imageUrls: review.imageUrls,
                createdAt: review.createdAt,
                user: db.users.get(review.userId)!,
                property: db.properties.get(review.propertyId)!,
              },
            };
          }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { reviewId: string; status: ReportStatus };
        data: { status: ReportStatus };
      }) => {
        const matches = db.reports.filter((r) => r.reviewId === where.reviewId && r.status === where.status);
        for (const report of matches) report.status = data.status;
        return { count: matches.length };
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

import { GET as listReportsRoute } from "@/app/api/admin/review-reports/route";
import { PATCH as dismissReportsRoute } from "@/app/api/admin/reviews/[reviewId]/dismiss/route";
import { DELETE as deleteReviewRoute } from "@/app/api/admin/reviews/[reviewId]/route";
import { POST as reportReviewRoute } from "@/app/api/reviews/[id]/report/route";

function sessionOf(id: string, role: "USER" | "ADMIN") {
  return {
    session: {
      user: { id, role, name: `User ${id}`, email: `${id}@papan.test` },
      expires: "2099-01-01T00:00:00.000Z",
    },
  };
}

function authError(status: 401 | 403) {
  return { error: Response.json({ message: status === 401 ? "Unauthorized" : "Forbidden" }, { status }) };
}

type Handler<P> = (request: Request, context: { params: Promise<P> }) => Promise<Response | undefined>;

async function send<P>(handler: Handler<P>, method: string, params: P, body?: unknown): Promise<Response> {
  const request = new Request("http://localhost/api", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await handler(request, { params: Promise.resolve(params) });
  if (!res) throw new Error("Route tidak mengembalikan response.");
  return res;
}

function addReport(reviewId: string, reporterId: string, status: ReportStatus = "PENDING") {
  db.reports.push({
    id: `seed-${db.reports.length + 1}`,
    reviewId,
    reporterId,
    reason: "Spam atau promosi",
    status,
    createdAt: new Date("2026-10-28T08:00:00Z"),
  });
}

beforeEach(() => {
  db.users.clear();
  db.properties.clear();
  db.reviews.clear();
  db.reports = [];
  db.notifications.length = 0;

  for (const [id, name] of [["user-1", "Budi"], ["user-2", "Sari"], ["user-3", "Dewi"], ["admin-1", "Admin"]]) {
    db.users.set(id, { id, name, username: null, email: `${id}@papan.test` });
  }
  db.properties.set("prop-1", { id: "prop-1", title: "Kos Melati Jatinangor" });
  for (const [id, userId] of [["review-1", "user-1"], ["review-2", "user-3"]]) {
    db.reviews.set(id, {
      id,
      userId,
      propertyId: "prop-1",
      rating: 1,
      comment: "Promo kos lain, hubungi 08xx",
      imageUrls: [],
      createdAt: new Date("2026-10-20T10:00:00Z"),
      updatedAt: new Date("2026-10-20T10:00:00Z"),
    });
  }

  requireAuth.mockReset();
  requireAuth.mockResolvedValue(sessionOf("user-2", "USER"));
  requireAdmin.mockReset();
  requireAdmin.mockResolvedValue(sessionOf("admin-1", "ADMIN"));
});

describe("DELETE /api/admin/reviews/[reviewId] — hapus review oleh admin", () => {
  const deleteReview = (body: unknown, reviewId = "review-1") =>
    send(deleteReviewRoute, "DELETE", { reviewId }, body);

  // D1: selain admin tidak boleh menghapus review orang lain
  it("D1: returns the auth error and keeps the review for non-admins", async () => {
    requireAdmin.mockResolvedValue(authError(403));

    const res = await deleteReview({ reason: "Spam atau promosi" });

    expect(res.status).toBe(403);
    expect(db.reviews.has("review-1")).toBe(true);
    expect(db.notifications).toHaveLength(0);
  });

  // D2: alasan tidak valid -> 400, review tetap ada
  it("D2: rejects a too-short reason with 400 and keeps the review", async () => {
    const res = await deleteReview({ reason: "ab" });

    expect(res.status).toBe(400);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.reviews.has("review-1")).toBe(true);
  });

  // D3: body bukan JSON -> 400, bukan error 500
  it("D3: rejects a malformed JSON body with 400", async () => {
    const res = await deleteReview("{bukan json");

    expect(res.status).toBe(400);
    expect(db.reviews.has("review-1")).toBe(true);
  });

  // D4: review tidak ada -> 404 tanpa notifikasi
  it("D4: returns 404 for an unknown review", async () => {
    const res = await deleteReview({ reason: "Spam atau promosi" }, "review-x");

    expect(res.status).toBe(404);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.notifications).toHaveLength(0);
  });

  // D5: sukses -> review terhapus dan penulisnya (bukan admin) dapat notifikasi berisi alasan
  it("D5: deletes the review and notifies its author with the reason", async () => {
    const res = await deleteReview({ reason: "  Spam atau promosi  " });

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

describe("POST /api/reviews/[id]/report — user melaporkan review", () => {
  const reportReview = (body: unknown, id = "review-1") => send(reportReviewRoute, "POST", { id }, body);

  // P1: harus login
  it("P1: returns the auth error for guests", async () => {
    requireAuth.mockResolvedValue(authError(401));

    const res = await reportReview({ reason: "Spam atau promosi" });

    expect(res.status).toBe(401);
    expect(db.reports).toHaveLength(0);
  });

  // P2: alasan tidak valid -> 400
  it("P2: rejects a too-short reason with 400", async () => {
    const res = await reportReview({ reason: "ab" });

    expect(res.status).toBe(400);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.reports).toHaveLength(0);
  });

  // P3: review tidak ada -> 404
  it("P3: returns 404 for an unknown review", async () => {
    const res = await reportReview({ reason: "Spam atau promosi" }, "review-x");

    expect(res.status).toBe(404);
    expect(db.reports).toHaveLength(0);
  });

  // P4: tidak bisa melaporkan review sendiri
  it("P4: does not let users report their own review", async () => {
    requireAuth.mockResolvedValue(sessionOf("user-1", "USER"));

    const res = await reportReview({ reason: "Spam atau promosi" });

    expect(res.status).toBe(400);
    expect(db.reports).toHaveLength(0);
  });

  // P5: sukses -> laporan tersimpan atas nama user yang login, status PENDING
  it("P5: stores a pending report from the signed-in user", async () => {
    const res = await reportReview({ reason: "  Spam atau promosi  " });

    expect(res.status).toBe(201);
    expect(db.reports).toHaveLength(1);
    expect(db.reports[0]).toMatchObject({
      reviewId: "review-1",
      reporterId: "user-2",
      reason: "Spam atau promosi",
      status: "PENDING",
    });
  });

  // P6: 1 user hanya bisa melaporkan 1 review sekali
  it("P6: rejects a second report from the same user with 409", async () => {
    expect((await reportReview({ reason: "Spam atau promosi" })).status).toBe(201);

    const res = await reportReview({ reason: "Kata kasar" });

    expect(res.status).toBe(409);
    expect(typeof (await res.json()).message).toBe("string");
    expect(db.reports).toHaveLength(1);
  });
});

describe("GET /api/admin/review-reports — antrean laporan untuk admin", () => {
  // L1: hanya admin
  it("L1: returns the auth error for non-admins", async () => {
    requireAdmin.mockResolvedValue(authError(403));

    const res = await listReportsRoute();

    expect(res?.status).toBe(403);
  });

  // L2: hanya review dengan laporan PENDING, lengkap dengan alasan dan pelapornya
  it("L2: lists only reviews with pending reports, with each reason and reporter", async () => {
    addReport("review-1", "user-2");
    addReport("review-2", "user-1", "DISMISSED");

    const res = await listReportsRoute();
    expect(res?.status).toBe(200);
    const { data } = await res!.json();

    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("review-1");
    expect(data[0].user.id).toBe("user-1");
    expect(data[0].property.title).toBe("Kos Melati Jatinangor");
    expect(data[0].reports).toHaveLength(1);
    expect(data[0].reports[0].reason).toBe("Spam atau promosi");
    expect(data[0].reports[0].reporter.id).toBe("user-2");
  });
});

describe("PATCH /api/admin/reviews/[reviewId]/dismiss — admin menolak laporan", () => {
  const dismissReports = (reviewId = "review-1") => send(dismissReportsRoute, "PATCH", { reviewId });

  // S1: hanya admin
  it("S1: returns the auth error for non-admins and keeps reports pending", async () => {
    addReport("review-1", "user-2");
    requireAdmin.mockResolvedValue(authError(403));

    const res = await dismissReports();

    expect(res.status).toBe(403);
    expect(db.reports[0].status).toBe("PENDING");
  });

  // S2: semua laporan PENDING untuk review itu ditolak, review tetap ada, review lain tidak tersentuh
  it("S2: dismisses the pending reports of that review only and keeps the review", async () => {
    addReport("review-1", "user-2");
    addReport("review-1", "user-3");
    addReport("review-2", "user-2");

    const res = await dismissReports();

    expect(res.status).toBe(200);
    expect(db.reviews.has("review-1")).toBe(true);
    expect(db.reports.map((report) => [report.reviewId, report.status])).toEqual([
      ["review-1", "DISMISSED"],
      ["review-1", "DISMISSED"],
      ["review-2", "PENDING"],
    ]);
  });

  // S3: tidak ada laporan PENDING -> 404
  it("S3: returns 404 when the review has no pending reports", async () => {
    addReport("review-1", "user-2", "DISMISSED");

    const res = await dismissReports();

    expect(res.status).toBe(404);
    expect(typeof (await res.json()).message).toBe("string");
  });
});
