import { hash } from "bcryptjs";
import { z } from "zod";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/mailer";

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
      return Response.json({ message: "Email sudah terdaftar" }, { status: 409 });
    }

    if (existingUsername) {
      return Response.json({ message: "Username sudah digunakan" }, { status: 409 });
    }

    if (existingPhone) {
      return Response.json({ message: "Nomor telepon sudah digunakan" }, { status: 409 });
    }

    const passwordHash = await hash(password, 12);
    const verificationToken = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
    const verifyUrl = new URL("/api/auth/verify-email", baseUrl);
    verifyUrl.searchParams.set("email", normalizedEmail);
    verifyUrl.searchParams.set("token", verificationToken);

    try {
      await sendVerificationEmail({
        to: normalizedEmail,
        username,
        verifyUrl: verifyUrl.toString(),
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
