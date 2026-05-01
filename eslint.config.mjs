import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Locale-aware Link / redirect / useRouter / usePathname live in
// `src/i18n/navigation` — using the bare `next/link` and `next/navigation`
// versions skips the locale prefix and ships an extra middleware redirect
// hop on every click. The exemption boundary is the i18n internals + any
// route that legitimately needs the unprefixed primitive (root-level API
// routes, server actions, root metadata files, the next.config plugin).
const I18N_BOUNDARY_EXEMPTIONS = [
  "src/i18n/**",
  "src/middleware.ts",
  "src/app/api/**",
  "src/app/actions/**",
  "next.config.ts",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/link",
              message:
                "Use Link from @/i18n/navigation so locale prefix is applied automatically.",
            },
          ],
          patterns: [
            {
              group: ["next/navigation"],
              importNames: [
                "redirect",
                "permanentRedirect",
                "useRouter",
                "usePathname",
              ],
              message:
                "Use the locale-aware version from @/i18n/navigation. Other named exports (notFound, useSearchParams, etc.) are fine on next/navigation.",
            },
          ],
        },
      ],
    },
  },
  {
    files: I18N_BOUNDARY_EXEMPTIONS,
    rules: {
      "no-restricted-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/i18n/_generated/**",
  ]),
]);

export default eslintConfig;
