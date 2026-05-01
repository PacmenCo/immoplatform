import { describe, it, expect } from "vitest";
import { routing, urlPrefixFor } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";

const PROTECTED_PATHS = [
  "/dashboard/",
  "/no-access",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/invites/",
  "/designs/",
];

describe("robots", () => {
  it("emits the cross-product of locales × protected paths", async () => {
    const robots = (await import("@/app/robots")).default;
    const out = robots();

    // shape
    expect(out.sitemap).toBe(`${SITE_URL}/sitemap.xml`);
    const rules = Array.isArray(out.rules) ? out.rules[0] : out.rules;
    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");

    const disallow = Array.isArray(rules.disallow)
      ? rules.disallow
      : rules.disallow
        ? [rules.disallow]
        : [];

    // Every (locale prefix × protected path) pair is present.
    for (const locale of routing.locales) {
      const prefix = urlPrefixFor(locale);
      for (const path of PROTECTED_PATHS) {
        expect(disallow).toContain(`${prefix}${path}`);
      }
    }

    // Defensive unprefixed entries kept in the list.
    for (const path of PROTECTED_PATHS) {
      expect(disallow).toContain(path);
    }

    // /api/ is not prefixed.
    expect(disallow).toContain("/api/");
    for (const locale of routing.locales) {
      const prefix = urlPrefixFor(locale);
      expect(disallow).not.toContain(`${prefix}/api/`);
    }

    // Cardinality: protected × (locales + 1 unprefixed) + 1 (`/api/`).
    expect(disallow.length).toBe(
      PROTECTED_PATHS.length * (routing.locales.length + 1) + 1,
    );
  });

  it("scales linearly with routing.locales", async () => {
    // If a third locale were added (e.g. `fr-BE`), the disallow list would
    // grow by exactly PROTECTED_PATHS.length entries — one per new prefix.
    // We can't actually mutate `routing.locales` (it's `as const`), but we
    // can assert the relationship holds for the current locale set: the
    // count of locale-prefixed entries equals locales × protected.
    const robots = (await import("@/app/robots")).default;
    const rulesField = robots().rules;
    const rules = Array.isArray(rulesField) ? rulesField[0] : rulesField;
    const disallow = Array.isArray(rules.disallow)
      ? rules.disallow
      : rules.disallow
        ? [rules.disallow]
        : [];

    const localePrefixed = disallow.filter((entry: string) =>
      routing.locales.some((l) => entry.startsWith(urlPrefixFor(l) + "/")),
    );
    expect(localePrefixed.length).toBe(
      PROTECTED_PATHS.length * routing.locales.length,
    );
  });

  it("matches the regression snapshot", async () => {
    const robots = (await import("@/app/robots")).default;
    expect(robots()).toMatchInlineSnapshot(`
      {
        "rules": {
          "allow": "/",
          "disallow": [
            "/dashboard/",
            "/no-access",
            "/verify-email",
            "/reset-password",
            "/forgot-password",
            "/invites/",
            "/designs/",
            "/en/dashboard/",
            "/en/no-access",
            "/en/verify-email",
            "/en/reset-password",
            "/en/forgot-password",
            "/en/invites/",
            "/en/designs/",
            "/nl/dashboard/",
            "/nl/no-access",
            "/nl/verify-email",
            "/nl/reset-password",
            "/nl/forgot-password",
            "/nl/invites/",
            "/nl/designs/",
            "/api/",
          ],
          "userAgent": "*",
        },
        "sitemap": "http://localhost:3000/sitemap.xml",
      }
    `);
  });
});
