// Jalankan perintah (prisma / tsx) dengan environment database uji lokal.
//   node tests/blackbox/prisma-env.mjs npx prisma migrate deploy
//   node tests/blackbox/prisma-env.mjs npx tsx tests/blackbox/seed.ts
import { spawnSync } from "node:child_process";
import { applyBlackboxEnv } from "./env.mjs";

applyBlackboxEnv();
const [cmd, ...args] = process.argv.slice(2);
const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, env: process.env });
process.exit(result.status ?? 1);
