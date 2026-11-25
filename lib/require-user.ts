import { getServerSession, type Session } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Hasil guard. Tipe ditulis eksplisit (bukan hasil inferensi) supaya
 * `'error' in auth` mempersempit tipe dengan benar: tanpa ini TypeScript
 * menambahkan `error?: undefined` ke cabang sukses sehingga `auth.error`
 * bertipe `Response | undefined`.
 */
export type AuthResult = { error: Response } | { session: Session };

export async function getCurrentUserSession() {
  return getServerSession(authOptions);
}

export async function requireAuth(): Promise<AuthResult> {
  const session = await getCurrentUserSession();
  if (!session?.user?.id) {
    return { error: Response.json({ message: "Unauthorized" }, { status: 401 }) };
  }

  return { session };
}

export const requireUser = requireAuth;

export async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth;
  }

  if (auth.session.user.role !== "ADMIN") {
    return { error: Response.json({ message: "Forbidden" }, { status: 403 }) };
  }

  return auth;
}
