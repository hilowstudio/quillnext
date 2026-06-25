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
    // Lint-debt ratchet (Q-01-004) — COMPLETE. Pervasively-violated rules were downgraded to "warn" so
    // CI could adopt lint without a mass refactor, then burned down rule-by-rule to 0 and promoted to
    // "error" via genuine, behavior-preserving fixes, so new violations now fail CI. The only rule left
    // at "warn" is @next/next/no-img-element (11 remain by design — remote images bypass next/image; ch.01).
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
      // Locked last (the final pass, 2026-06-25). `^_` is the sanctioned "intentionally unused" marker
      // (contract/positional params, deliberately dropped destructures, caught errors we don't inspect) —
      // rename to `_x`, don't delete & break the shape.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
];

export default eslintConfig;
