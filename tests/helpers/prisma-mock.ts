import { vi, type Mock } from "vitest";

/**
 * Mock Prisma generik untuk test route handler.
 *
 * Setiap akses `prismaMock.<model>.<method>` mengembalikan `vi.fn()` yang sama
 * selama satu test, sehingga test bisa mengatur nilai balik per cabang:
 *   prismaMock.user.findUnique.mockResolvedValue(null)
 *
 * `$transaction` menerima callback (dijalankan dengan prismaMock sebagai tx)
 * atau array promise (di-resolve berurutan), sama seperti Prisma asli.
 *
 * Pakai di file test:
 *   vi.mock("@/lib/prisma", async () => ({ prisma: (await import("../helpers/prisma-mock")).prismaMock }));
 *   beforeEach(() => resetPrismaMock());
 */

type ModelMock = Record<string, Mock>;

const models = new Map<string, ModelMock>();
const rootFns = new Map<string, Mock>();

function createModel(): ModelMock {
  const fns = new Map<string, Mock>();
  return new Proxy({} as ModelMock, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      if (!fns.has(prop)) fns.set(prop, vi.fn().mockResolvedValue(null));
      return fns.get(prop);
    },
  });
}

function transactionImpl(arg: unknown) {
  if (typeof arg === "function") return arg(prismaMock);
  if (Array.isArray(arg)) return Promise.all(arg);
  throw new Error("$transaction mock: argumen tidak dikenali");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const prismaMock: any = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      if (prop.startsWith("$")) {
        if (!rootFns.has(prop)) {
          const fn = vi.fn();
          if (prop === "$transaction") fn.mockImplementation(transactionImpl);
          else fn.mockResolvedValue([]);
          rootFns.set(prop, fn);
        }
        return rootFns.get(prop);
      }
      if (!models.has(prop)) models.set(prop, createModel());
      return models.get(prop);
    },
  },
);

/** Kosongkan semua mock model supaya tiap test mulai bersih. */
export function resetPrismaMock() {
  models.clear();
  rootFns.clear();
}
