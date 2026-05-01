import { defineRouting } from "next-intl/routing";

// URL segments stay short ("/nl") for ergonomics; internal locale IDs are
// region-tagged ("nl-BE") so copy can lean Flemish and a future "fr-BE" /
// "fr-FR" split slots in without a URL migration. Add new locales here +
// drop a sibling messages/<id>/ directory; staleness check enforces the rest.
export const routing = defineRouting({
  locales: ["en", "nl-BE"] as const,
  defaultLocale: "nl-BE",
  localePrefix: {
    mode: "always",
    prefixes: {
      en: "/en",
      "nl-BE": "/nl",
    },
  },
  // First-visit negotiation: read Accept-Language, persist via NEXT_LOCALE
  // cookie, redirect on subsequent loads. Belgian visitors land on /nl,
  // English browsers on /en, returning visitors keep their last choice.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

// Tiny accessor so call-sites (sitemap, hreflang helper, future locale-aware
// link builders) don't reach into the `localePrefix.prefixes` shape directly.
// Adding a locale here = updating `defineRouting` above; no other site needs to
// know the URL segment mapping.
//
// next-intl's resolved type for `localePrefix` is the open union
// `LocalePrefixMode | LocalePrefixConfigVerbose<...>` with `prefixes` typed as
// `Partial<Record<Locale, string>>`. We always pass a verbose `{ mode, prefixes }`
// object with every locale present, so a narrow cast + `?? "/" + locale` fallback
// keeps this honest without forcing every caller to widen.
export function urlPrefixFor(locale: Locale): string {
  const lp = routing.localePrefix as { prefixes?: Partial<Record<Locale, string>> };
  return lp.prefixes?.[locale] ?? `/${locale}`;
}
