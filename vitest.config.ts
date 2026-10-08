import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      reportsDirectory: "./coverage",
      include: [
        "lib/dss/scoring.ts",
        "lib/dss/facility-mapping.ts",
        "lib/format-price.ts",
        "lib/booster.ts",
        "lib/midtrans.ts",
        "lib/kyc-image.ts",
        "lib/review-photos.ts",
      ],
    },
  },
});
