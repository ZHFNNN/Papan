import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn();

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail }) },
}));

const { sendVerificationEmail } = await import("@/lib/mailer");

const SMTP_ENV = {
  SMTP_HOST: "smtp.test.local",
  SMTP_PORT: "587",
  SMTP_FROM: "noreply@papan.test",
};

describe("sendVerificationEmail — HTML escaping", () => {
  const original = { ...process.env };

  beforeEach(() => {
    sendMail.mockReset();
    Object.assign(process.env, SMTP_ENV);
  });

  afterEach(() => {
    process.env = { ...original };
  });

  const sentHtml = () => sendMail.mock.calls[0][0].html as string;

  it("escapes HTML in the username so it cannot inject links", async () => {
    await sendVerificationEmail({
      to: "korban@example.com",
      username: '<a href="https://evil.example">Klik di sini</a>',
      verifyUrl: "https://papan.test/api/auth/verify-email?email=a&token=b",
    });

    const html = sentHtml();
    expect(html).not.toContain('href="https://evil.example"');
    expect(html).toContain("Halo &lt;a href=&quot;https://evil.example&quot;&gt;Klik di sini&lt;/a&gt;,");
  });

  it("keeps the verify link working (ampersand encoded inside href)", async () => {
    await sendVerificationEmail({
      to: "user@example.com",
      username: "budi",
      verifyUrl: "https://papan.test/api/auth/verify-email?email=a&token=b",
    });

    const html = sentHtml();
    expect(html).toContain('href="https://papan.test/api/auth/verify-email?email=a&amp;token=b"');
    expect(html).toContain("Halo budi,");
  });

  it("leaves the plain-text version unescaped", async () => {
    await sendVerificationEmail({
      to: "user@example.com",
      username: "a<b",
      verifyUrl: "https://papan.test/verify?x=1&y=2",
    });

    const text = sendMail.mock.calls[0][0].text as string;
    expect(text).toContain("Halo a<b,");
    expect(text).toContain("https://papan.test/verify?x=1&y=2");
  });

  it("throws when SMTP is not configured", async () => {
    delete process.env.SMTP_HOST;
    await expect(
      sendVerificationEmail({ to: "x@example.com", username: "x", verifyUrl: "https://papan.test" }),
    ).rejects.toThrow(/Konfigurasi email/);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
