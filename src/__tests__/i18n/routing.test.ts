import { describe, expect, it } from "vitest";

import { routing, urlPrefixFor, type Locale } from "@/i18n/routing";

// Tests the locale-prefix accessor + routing config that everything else
// (sitemap, hreflang, canonical, navigation hooks) hangs off. The cast
// inside `urlPrefixFor` is the only place we narrow next-intl's loose
// `LocalePrefix` type to our own shape, so this is the contract we lean on.

describe("routing config", () => {
  it("declares the expected locales tuple", () => {
    expect(routing.locales).toEqual(["en", "nl-BE"]);
  });

  it("defaults to nl-BE", () => {
    expect(routing.defaultLocale).toBe("nl-BE");
  });

  it("uses always-prefix mode so middleware redirects every bare path", () => {
    // Verbose `{ mode, prefixes }` shape — the cast in urlPrefixFor relies
    // on this. If someone flips it back to a bare `"always"` string the
    // cast fallback (`?? "/" + locale`) would suddenly become reachable.
    const lp = routing.localePrefix as {
      mode?: string;
      prefixes?: Record<string, string>;
    };
    expect(lp.mode).toBe("always");
    expect(lp.prefixes).toEqual({ en: "/en", "nl-BE": "/nl" });
  });
});

describe("urlPrefixFor", () => {
  it("returns /en for the English locale", () => {
    expect(urlPrefixFor("en")).toBe("/en");
  });

  it("returns /nl for the Belgian-Flemish locale (URL stays short)", () => {
    expect(urlPrefixFor("nl-BE")).toBe("/nl");
  });

  it("covers every declared locale (no missing prefix)", () => {
    // If a future locale is added to `routing.locales` without a
    // corresponding entry in `localePrefix.prefixes`, the cast fallback
    // would produce a wrong URL like `/fr-BE` instead of `/fr`. Guard
    // against that by asserting every locale resolves to a non-fallback
    // value (i.e. the prefix lookup actually hit the map).
    for (const locale of routing.locales) {
      const prefix = urlPrefixFor(locale as Locale);
      expect(prefix).toMatch(/^\/[a-z]+$/);
      // Sanity: the prefix should NOT be the literal `/${locale}` fallback
      // for region-tagged locales — that's the bug we're protecting against.
      if (locale.includes("-")) {
        expect(prefix).not.toBe(`/${locale}`);
      }
    }
  });
});
