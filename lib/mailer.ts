import nodemailer from "nodemailer";

type MailerConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}

function sanitizeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}

function getMailerConfig(): MailerConfig | null {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "0");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.ADMIN_EMAIL;

  if (!host || !port || !from) {
    return null;
  }

  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    from,
  };
}

export async function sendVerificationEmail(params: {
  to: string;
  username: string;
  verifyUrl: string;
}) {
  const config = getMailerConfig();
  if (!config) {
    throw new Error("Konfigurasi email belum tersedia.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  // Username diisi bebas saat register, jadi wajib di-escape supaya tidak bisa
  // menyisipkan HTML/link palsu ke email resmi PAPAN.
  const safeUsername = escapeHtml(params.username);
  const safeVerifyUrl = escapeHtmlAttribute(params.verifyUrl);

  await transporter.sendMail({
    from: config.from,
    to: params.to,
    subject: "Verifikasi email akun PAPAN",
    text: [
      `Halo ${params.username},`,
      "",
      "Terima kasih sudah mendaftar di PAPAN.",
      "Silakan verifikasi email kamu dengan membuka tautan berikut:",
      params.verifyUrl,
      "",
      "Jika kamu tidak meminta pendaftaran ini, abaikan email ini.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
        <h2 style="margin:0 0 12px">Verifikasi email PAPAN</h2>
        <p style="margin:0 0 12px">Halo ${safeUsername},</p>
        <p style="margin:0 0 12px">Terima kasih sudah mendaftar di PAPAN. Klik tombol di bawah untuk memverifikasi email kamu.</p>
        <p style="margin:24px 0">
          <a href="${safeVerifyUrl}" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px">
            Verifikasi Email
          </a>
        </p>
        <p style="margin:0 0 12px">Atau salin tautan ini ke browser kamu:</p>
        <p style="margin:0;word-break:break-all"><a href="${safeVerifyUrl}">${safeVerifyUrl}</a></p>
        <p style="margin:24px 0 0;color:#6b7280">Jika kamu tidak meminta pendaftaran ini, abaikan email ini.</p>
      </div>
    `,
  });
}

export async function sendNotificationEmail(params: {
  to: string;
  title: string;
  message: string;
  imageUrl?: string | null;
}) {
  const config = getMailerConfig();
  if (!config) {
    throw new Error("Konfigurasi email belum tersedia.");
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  const safeTitle = escapeHtml(params.title);
  const safeMessage = escapeHtml(params.message);
  const safeImageUrl = sanitizeImageUrl(params.imageUrl);

  const htmlParts = [
    `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">`,
    `<h2 style="margin:0 0 12px">${safeTitle}</h2>`,
    `<p style="margin:0 0 12px">${safeMessage}</p>`,
  ];

  if (safeImageUrl) {
    htmlParts.push(`<p style="margin:12px 0"><img src="${escapeHtmlAttribute(safeImageUrl)}" alt="image" style="max-width:100%"></p>`);
  }

  htmlParts.push(`<p style="margin:24px 0 0;color:#6b7280">Jika kamu tidak menginginkan pemberitahuan ini, abaikan email ini.</p>`);
  htmlParts.push(`</div>`);

  await transporter.sendMail({
    from: config.from,
    to: params.to,
    subject: params.title,
    text: `${params.title}\n\n${params.message}`,
    html: htmlParts.join("\n"),
  });
}
