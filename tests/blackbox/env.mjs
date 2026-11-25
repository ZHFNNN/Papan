// Nilai lingkungan black box testing. Bukan secret: semuanya hanya berlaku untuk
// container lokal di tests/blackbox/docker-compose.yml.
// Variabel database SELALU di-override supaya server uji tidak pernah menyentuh production.
export const BLACKBOX_ENV = {
  DATABASE_URL: "postgresql://papan:papan@localhost:55432/papan_blackbox",
  DIRECT_URL: "postgresql://papan:papan@localhost:55432/papan_blackbox",
  NEXTAUTH_URL: "http://localhost:3100",
  NEXTAUTH_SECRET: "papan-blackbox-test-secret-not-for-production",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  SMTP_USER: "blackbox",
  SMTP_PASS: "blackbox",
  SMTP_FROM: "noreply@papan.test",
  ADMIN_EMAIL: "admin@papan.test",
  MIDTRANS_IS_PRODUCTION: "false",
};

export function applyBlackboxEnv() {
  Object.assign(process.env, BLACKBOX_ENV);
  if (!process.env.DATABASE_URL.includes("localhost:55432")) {
    throw new Error("DATABASE_URL bukan database uji lokal — dibatalkan.");
  }
}
