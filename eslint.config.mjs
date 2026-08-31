import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",
    
    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",
    
    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",
    
    // General JavaScript rules
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
    "no-restricted-syntax": ["error",
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
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills"]
}];

export default eslintConfig;
