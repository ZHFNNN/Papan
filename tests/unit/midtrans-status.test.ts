import { describe, expect, it } from "vitest";
import type { BoostPaymentStatus } from "@prisma/client";
import {
  canTransitionPaymentStatus,
  mapMidtransStatus,
  parseMidtransTime,
} from "@/lib/midtrans";

describe("mapMidtransStatus", () => {
  it("maps settlement to PAID", () => {
    expect(mapMidtransStatus("settlement")).toBe("PAID");
  });

  it("maps capture by fraud_status", () => {
    expect(mapMidtransStatus("capture", "accept")).toBe("PAID");
    expect(mapMidtransStatus("capture")).toBe("PAID");
    expect(mapMidtransStatus("capture", "challenge")).toBe("PROCESSING");
    expect(mapMidtransStatus("capture", "deny")).toBe("FAILED");
  });

  it("maps pending / expire / cancel", () => {
    expect(mapMidtransStatus("pending")).toBe("PENDING");
    expect(mapMidtransStatus("expire")).toBe("EXPIRED");
    expect(mapMidtransStatus("cancel")).toBe("CANCELLED");
  });

  it("maps deny and failure to FAILED", () => {
    expect(mapMidtransStatus("deny")).toBe("FAILED");
    expect(mapMidtransStatus("failure")).toBe("FAILED");
  });

  it("maps unknown statuses (refund, authorize, missing) to PROCESSING", () => {
    expect(mapMidtransStatus("refund")).toBe("PROCESSING");
    expect(mapMidtransStatus("authorize")).toBe("PROCESSING");
    expect(mapMidtransStatus(undefined)).toBe("PROCESSING");
  });
});

describe("canTransitionPaymentStatus", () => {
  const ALL: BoostPaymentStatus[] = ["PENDING", "PROCESSING", "PAID", "EXPIRED", "FAILED", "CANCELLED"];

  it("never leaves PAID (late expire / pending / duplicate settlement)", () => {
    for (const next of ALL) {
      expect(canTransitionPaymentStatus("PAID", next)).toBe(false);
    }
  });

  it("allows PAID from every unpaid status", () => {
    for (const current of ALL.filter((s) => s !== "PAID")) {
      expect(canTransitionPaymentStatus(current, "PAID")).toBe(true);
    }
  });

  it("keeps final failures final except for PAID", () => {
    for (const current of ["EXPIRED", "CANCELLED", "FAILED"] as const) {
      expect(canTransitionPaymentStatus(current, "PENDING")).toBe(false);
      expect(canTransitionPaymentStatus(current, "PROCESSING")).toBe(false);
      expect(canTransitionPaymentStatus(current, "EXPIRED")).toBe(false);
    }
  });

  it("does not move PROCESSING back to PENDING", () => {
    expect(canTransitionPaymentStatus("PROCESSING", "PENDING")).toBe(false);
  });

  it("allows normal forward progress", () => {
    expect(canTransitionPaymentStatus("PENDING", "PENDING")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "PROCESSING")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING", "EXPIRED")).toBe(true);
    expect(canTransitionPaymentStatus("PROCESSING", "FAILED")).toBe(true);
  });
});

describe("parseMidtransTime", () => {
  it("reads Midtrans timestamps as WIB (UTC+7) regardless of server timezone", () => {
    expect(parseMidtransTime("2026-10-08 13:00:00")?.toISOString()).toBe("2026-10-08T06:00:00.000Z");
  });

  it("handles the day boundary", () => {
    expect(parseMidtransTime("2026-10-09 03:30:00")?.toISOString()).toBe("2026-10-08T20:30:00.000Z");
  });

  it("keeps explicit ISO timestamps as-is", () => {
    expect(parseMidtransTime("2026-10-08T13:00:00Z")?.toISOString()).toBe("2026-10-08T13:00:00.000Z");
  });

  it("returns null for empty or invalid input", () => {
    expect(parseMidtransTime(undefined)).toBeNull();
    expect(parseMidtransTime(null)).toBeNull();
    expect(parseMidtransTime("")).toBeNull();
    expect(parseMidtransTime("bukan tanggal")).toBeNull();
  });
});
