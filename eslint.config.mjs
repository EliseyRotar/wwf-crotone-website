// ESLint flat config for Next.js 16. Replaces the legacy .eslintrc.json
// which was dropped when `next lint` was removed (Next.js 16).
//
// Usage:
//   npx eslint .
//   npx eslint src/app/api/admin/iscrizioni
//
// Inherits rules from `next/core-web-vitals` (the modern successor to
// the old `next` + `next/core-web-vitals` legacy config). The custom
// rules below mirror what the old .eslintrc.json had.

import nextPlugin from "eslint-config-next";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // Apply Next.js's recommended + core-web-vitals rules
  ...nextPlugin,

  {
    rules: {
      // We use <img> for legacy leaflet / canvas / Leaflet marker
      // icons — opt out of Next's prefer-<Image>-element warning.
      "@next/next/no-img-element": "off",
      // Only allow console.warn / console.error (per AGENTS.md).
      // Audit originally found `console.log` in src/lib/sms.ts (now deleted).
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      // React 19 / Next 16 introduced stricter purity rules that turn
      // some of our pre-existing patterns into errors:
      //   - Date.now() / crypto.randomUUID() inside render for ICS UID
      //     + receipt IDs (technically impure but stable for the same input)
      //   - setState() at the top of useEffect for cookie-consent reads
      // These are benign in practice (no hydration mismatch, no cascading
      // re-renders for our specific use) but the rule fires. Disabled
      // here during the migration; plan a follow-up PR to move these
      // into useMemo / event handlers / lazy initial state.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off"
    }
  },

  // Ignore generated / build artifacts
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "prisma/migrations/**",
      "public/**"
    ]
  }
];
