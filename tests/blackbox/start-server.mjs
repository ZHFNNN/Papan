// Jalankan Next.js dev server untuk black box testing di http://localhost:3100
// memakai database uji lokal (bukan production).
//   node tests/blackbox/start-server.mjs
import { spawn } from "node:child_process";
import { applyBlackboxEnv } from "./env.mjs";

applyBlackboxEnv();
console.log(`[blackbox] DATABASE_URL -> ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ":***@")}`);

const child = spawn("npx", ["next", "dev", "-p", "3100"], { stdio: "inherit", shell: true, env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
