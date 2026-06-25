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
      ".claude/worktrees/**", // ephemeral Workflow git worktrees — git-excluded; never lint
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    // Lint-debt ratchet (Q-01-004). Pervasively-violated rules were downgraded to "warn" so CI
    // could adopt lint without a mass refactor, then burned down rule-by-rule. Each is promoted to
    // "error" once it reaches 0 via genuine, behavior-preserving fixes, so new violations fail CI.
    // The rest stay "warn" (visible, non-blocking) until they reach 0. Every other rule is enforced.
    rules: {
      // Locked — burned down to 0 and ratcheted to "error":
      "@typescript-eslint/ban-ts-comment": "error",
      "@typescript-eslint/no-empty-object-type": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-wrapper-object-types": "error",
      "prefer-const": "error",
      "jsx-a11y/alt-text": "error",
      "import/no-anonymous-default-export": "error",
      "react/no-unescaped-entities": "error",
      "react-hooks/error-boundaries": "error",
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/no-explicit-any": "error",
      // Still burning down — kept at "warn" until it reaches 0:
      // @typescript-eslint/no-unused-vars (the final ratchet pass).
    },
  },
];

export default eslintConfig;
