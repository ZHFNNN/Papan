import { describe, expect, it } from "vitest";
import {
  RESEND_COOLDOWN_MS,
  VERIFICATION_TOKEN_TTL_MS,
  buildVerifyUrl,
  createVerificationToken,
  isResendThrottled,
} from "@/lib/email-verification";

describe("createVerificationToken", () => {
  it("returns 64 hex characters (32 random bytes)", () => {
    expect(createVerificationToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is different every time", () => {
    expect(createVerificationToken()).not.toBe(createVerificationToken());
  });
});

describe("buildVerifyUrl", () => {
  it("points to the verify-email endpoint with email and token", () => {
    const url = new URL(buildVerifyUrl("https://papan.test", "budi@example.com", "abc"));
    expect(url.origin + url.pathname).toBe("https://papan.test/api/auth/verify-email");
    expect(url.searchParams.get("email")).toBe("budi@example.com");
    expect(url.searchParams.get("token")).toBe("abc");
  });

  it("encodes special characters in the email", () => {
    const url = buildVerifyUrl("https://papan.test", "a+b@example.com", "t");
    expect(new URL(url).searchParams.get("email")).toBe("a+b@example.com");
    expect(url).toContain("email=a%2Bb%40example.com");
  });

  it("ignores any path on the base URL", () => {
    expect(buildVerifyUrl("https://papan.test/login", "x@y.z", "t")).toMatch(
      /^https:\/\/papan\.test\/api\/auth\/verify-email\?/,
    );
  });
});

describe("isResendThrottled", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");
  const issuedAgo = (ms: number) => new Date(now.getTime() - ms + VERIFICATION_TOKEN_TTL_MS);

  it("allows resend when there is no previous token", () => {
    expect(isResendThrottled(null, now)).toBe(false);
    expect(isResendThrottled(undefined, now)).toBe(false);
  });

  it("throttles when the last token was issued within the cooldown", () => {
    expect(isResendThrottled(issuedAgo(0), now)).toBe(true);
    expect(isResendThrottled(issuedAgo(RESEND_COOLDOWN_MS - 1), now)).toBe(true);
  });

  it("allows resend once the cooldown has passed", () => {
    expect(isResendThrottled(issuedAgo(RESEND_COOLDOWN_MS), now)).toBe(false);
    expect(isResendThrottled(issuedAgo(25 * 60 * 60 * 1000), now)).toBe(false);
  });
});
