import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// Flat-config ESLint setup for Next 16 / ESLint 9 (replaces the removed `next lint`
// and the legacy .eslintrc.json). eslint-config-next 16 ships native flat configs
// (Linter.Config[]); spread them directly — FlatCompat double-wraps and throws.
const eslintConfig = [
  {
    ignores: [
      "src/generated/**", // Prisma-generated client — not our code
      ".next/**",
      "node_modules/**",
      "prisma/migrations/**",
      "next-env.d.ts",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // Rules currently violated pervasively across the fast-built codebase are
    // downgraded to warnings so CI can adopt lint now without a mass refactor
    // (they stay visible to burn down over time). Every OTHER error-level rule
    // remains enforced, so NEW violations of them fail CI.
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-wrapper-object-types": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "prefer-const": "warn",
    },
  },
];

export default eslintConfig;
