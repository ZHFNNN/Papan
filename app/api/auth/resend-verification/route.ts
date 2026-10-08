import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";
import {
  VERIFICATION_TOKEN_TTL_MS,
  buildVerifyUrl,
  createVerificationToken,
  isResendThrottled,
} from "@/lib/email-verification";

const resendSchema = z.object({
  email: z.string().email(),
});

// Jawaban selalu sama, baik email terdaftar atau tidak, supaya endpoint ini
// tidak bisa dipakai untuk mengecek email siapa saja yang terdaftar.
const GENERIC_RESPONSE = {
  message: "Jika email terdaftar dan belum diverifikasi, tautan verifikasi baru sudah dikirim.",
};

// POST /api/auth/resend-verification
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ message: "Format email tidak valid." }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { username: true, name: true, passwordHash: true, emailVerified: true },
  });

  // Akun Google tidak punya password dan tidak butuh verifikasi email
  if (!user || !user.passwordHash || user.emailVerified) {
    return Response.json(GENERIC_RESPONSE);
  }

  const latestToken = await prisma.verificationToken.findFirst({
    where: { identifier: email },
    orderBy: { expires: "desc" },
    select: { expires: true },
  });

  if (isResendThrottled(latestToken?.expires)) {
    return Response.json(GENERIC_RESPONSE);
  }

  const token = createVerificationToken();
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;

  try {
    await sendVerificationEmail({
      to: email,
      username: user.username ?? user.name ?? email,
      verifyUrl: buildVerifyUrl(baseUrl, email, token),
    });
  } catch (error) {
    // Token lama tetap berlaku kalau pengiriman gagal
    await prisma.verificationToken.deleteMany({ where: { identifier: email, token } });
    console.error("[resend-verification] gagal mengirim email:", error);
    return Response.json({ message: "Gagal mengirim email. Coba lagi nanti." }, { status: 500 });
  }

  // Tautan lama tidak berlaku lagi setelah tautan baru terkirim
  await prisma.verificationToken.deleteMany({
    where: { identifier: email, token: { not: token } },
  });

  return Response.json(GENERIC_RESPONSE);
}
