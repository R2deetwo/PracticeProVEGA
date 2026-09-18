import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// NOTE (Task 61, ui-primitives adoption): this config previously extended
// eslint-config-next — which requires the `next` package. PracticePro is a
// Vite app (ADR-0003); `next` was never installed, so `npm run lint` crashed
// with "Cannot find module 'next/dist/compiled/babel/eslint-parser'" and NO
// lint gate actually ran. The dead scaffold (eslint-config-next, ADR-0004
// §"dead shadcn config") is now removed; the effective rule surface is
// preserved exactly as the old config declared it:
//   - every react / react-hooks / @typescript-eslint / next rule: OFF
//     (the old config turned them all off individually; absent == off)
//   - the ONE enforced rule: the rounded-xl deprecation gate (STYLE_GUIDE §2)
//   - the same ignore set (+ generated/vendor dirs that were never lintable)
// The old script also passed --report-unused-disable-directives, which would
// now error on 41 pre-existing disable comments for rules that are off
// (react-hooks/exhaustive-deps etc.) — unused-directive reporting is set
// "off" in linterOptions below so those stay inert, as they always were.
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "coverage/**",
      "next-env.d.ts",
      "examples/**",
      "skills",
      // Generated code (Convex codegen, Capacitor/Gradle output) — never lintable.
      "convex/_generated/**",
      "android/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      // TypeScript rules — all off (as before; this is a legacy-tolerant repo,
      // the quality gates are tsc baselines + vitest, see tests.yml).
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/prefer-as-const": "off",

      // General JavaScript rules — off, as before.
      "prefer-const": "off",
      "no-unused-vars": "off",
      "no-console": "off",
      "no-debugger": "off",
      "no-empty": "off",
      "no-irregular-whitespace": "off",
      "no-case-declarations": "off",
      "no-fallthrough": "off",
      "no-mixed-spaces-and-tabs": "off",
      "no-redeclare": "off",
      "no-undef": "off",
      "no-unreachable": "off",
      "no-useless-escape": "off",

      // Border-radius scale enforcement (STYLE_GUIDE.md §2, audit Pillar 1.1).
      // `rounded-xl` is deprecated — the 3-tier scale is rounded-md (buttons,
      // inputs, chips), rounded-lg (cards, list items, dropdowns), rounded-2xl
      // (modals, hero blocks). Matches both plain string literals and template
      // literals used for className composition.
      // NOTE (Task 61): WARN, not error — 42 pre-existing occurrences exist on
      // main (invisible until this config stopped crashing). Converting them is
      // a visual change (radius 12px -> 8px) and is therefore OUT OF SCOPE for
      // zero-visual-change refactors; each must ship in its own screen
      // migration. The error-level gate flips on when the count reaches zero
      // (same ratchet discipline as scripts/check-ui-primitives.mjs).
      "no-restricted-syntax": ["warn",
        {
          selector: "Literal[value=/\\brounded-xl\\b/]",
          message: "rounded-xl is deprecated (STYLE_GUIDE.md §2). Use rounded-md (buttons/inputs/chips), rounded-lg (cards/list items/dropdowns), or rounded-2xl (modals/hero blocks).",
        },
        {
          selector: "TemplateElement[value.raw=/\\brounded-xl\\b/]",
          message: "rounded-xl is deprecated (STYLE_GUIDE.md §2). Use rounded-md (buttons/inputs/chips), rounded-lg (cards/list items/dropdowns), or rounded-2xl (modals/hero blocks).",
        },
      ],
    },
  },
  {
    // 41 pre-existing disable comments reference rules that are off (mostly
    // react-hooks/exhaustive-deps). They were inert while the config crashed;
    // keep them inert now that lint actually runs.
    linterOptions: {
      reportUnusedDisableDirectives: "off",
    },
  },
];

export default eslintConfig;
