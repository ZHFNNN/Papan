import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";
import {
  VERIFICATION_TOKEN_TTL_MS,
  buildVerifyUrl,
  createVerificationToken,
} from "@/lib/email-verification";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  phoneNumber: z.string().min(8).max(20),
  password: z.string().min(6),
  confirmPassword: z.string().min(6)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Konfirmasi password tidak cocok",
  path: ["confirmPassword"]
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { message: "Payload tidak valid", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, username, email, phoneNumber, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const [existingEmail, existingUsername, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { phoneNumber } })
    ]);

    if (existingEmail) {
      const message =
        existingEmail.passwordHash && !existingEmail.emailVerified
          ? "Email sudah terdaftar tapi belum diverifikasi. Kirim ulang email verifikasi dari halaman login."
          : "Email sudah terdaftar";
      return Response.json({ message }, { status: 409 });
    }

    if (existingUsername) {
      return Response.json({ message: "Username sudah digunakan" }, { status: 409 });
    }

    if (existingPhone) {
      return Response.json({ message: "Nomor telepon sudah digunakan" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const verificationToken = createVerificationToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await prisma.$transaction([
      prisma.user.create({
        data: {
          username,
          name,
          email: normalizedEmail,
          phoneNumber,
          passwordHash,
          emailVerified: null,
        },
      }),
      prisma.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token: verificationToken,
          expires: expiresAt,
        },
      }),
    ]);

    const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;

    try {
      await sendVerificationEmail({
        to: normalizedEmail,
        username,
        verifyUrl: buildVerifyUrl(baseUrl, normalizedEmail, verificationToken),
      });
    } catch (mailError) {
      await prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail, token: verificationToken },
      });
      await prisma.user.delete({
        where: { email: normalizedEmail },
      });

      throw mailError;
    }

    return Response.json(
      {
        message: "Register berhasil. Silakan cek email untuk verifikasi akun.",
        verificationRequired: true,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server";
    return Response.json({ message }, { status: 500 });
  }
}
