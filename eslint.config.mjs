import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@next/next/no-html-link-for-pages": "warn",
      // Gambar sengaja pakai <img> + optimizeImage() (lib/image.ts) yang meminta
      // ukuran kecil langsung ke Cloudinary. Sebagian src juga tidak cocok untuk
      // next/image: preview blob:, foto KYC privat lewat /api/kyc/image, dan data
      // URI ulasan lama. next/image di atas Cloudinary hanya menambah kuota
      // Image Optimization Vercel tanpa manfaat.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
