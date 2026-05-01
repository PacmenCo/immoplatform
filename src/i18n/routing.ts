import { defineRouting } from "next-intl/routing";

// URLs use the full locale ID as the segment: /nl-BE/... and /en/....
//
// We previously used a `prefixes: { "nl-BE": "/nl", en: "/en" }` mapping for
// shorter URLs, but Next 16's proxy runtime mis-resolved the prefix→locale
// rewrite — `/nl` would 307-redirect to `https://immoplatform.be:3000/nl/nl-BE`
// (port leak + doubled path) instead of internally rendering. Falling back to
// locale-as-prefix is what works on Next 16 + next-intl 4.x today; revisit if
// the upstream issue is fixed.
export const routing = defineRouting({
  locales: ["en", "nl-BE"] as const,
  defaultLocale: "nl-BE",
  localePrefix: "always",
  // First-visit negotiation: read Accept-Language, persist via NEXT_LOCALE
  // cookie, redirect on subsequent loads.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

// Tiny accessor so call-sites (sitemap, hreflang helper, future locale-aware
// link builders) don't reach into routing internals directly. URL = locale id.
export function urlPrefixFor(locale: Locale): string {
  return `/${locale}`;
}
