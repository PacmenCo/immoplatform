import { getLocale } from "next-intl/server";
import { routing, urlPrefixFor, type Locale } from "@/i18n/routing";

/**
 * Per-page hreflang + canonical builder for `generateMetadata`.
 *
 * Why this exists: Next's metadata resolver only re-bases *relative* paths
 * against `metadataBase`. An ABSOLUTE path like "/en" set in a layout's
 * `alternates.languages` resolves to the same URL on every nested page, so a
 * deep page (e.g. `/nl/services/epc`) ends up emitting
 *   <link rel="alternate" hreflang="en" href="https://immoplatform.be/en">
 * pointing at the EN homepage instead of the EN counterpart of THAT page.
 * Catastrophic for hreflang clusters.
 *
 * Fix: emit alternates from each page's own `generateMetadata`, deriving the
 * URL per locale from the locale-less pathname the page already knows.
 *
 * Usage in a page:
 *   export async function generateMetadata(): Promise<Metadata> {
 *     return { alternates: await buildLocaleAlternates("/services/epc") };
 *   }
 *
 * - `pathnameWithoutLocale` is the route below the locale segment, with a
 *   leading slash. The homepage is `"/"` (handled specially so we emit
 *   `/nl` rather than `/nl/`).
 * - `canonical` is the active locale's URL — `getLocale()` reads the request
 *   scope so the helper works for both static and dynamic pages.
 * - `languages` is keyed by BCP-47 IDs (`en`, `nl-BE`) plus `x-default` →
 *   default locale. Returned values are absolute paths (relative to
 *   `metadataBase`) so Next produces a fully-qualified `<link href>`.
 */
export async function buildLocaleAlternates(
  pathnameWithoutLocale: string,
): Promise<{ canonical: string; languages: Record<string, string> }> {
  const path = normalizePath(pathnameWithoutLocale);
  const activeLocale = (await getLocale()) as Locale;

  const languages: Record<string, string> = {};
  for (const locale of routing.locales) {
    languages[locale] = urlFor(locale, path);
  }
  languages["x-default"] = urlFor(routing.defaultLocale, path);

  return {
    canonical: urlFor(activeLocale, path),
    languages,
  };
}

function urlFor(locale: Locale, normalizedPath: string): string {
  const prefix = urlPrefixFor(locale);
  // Homepage: `/nl` not `/nl/`. Anything else: `/nl/services/epc`.
  return normalizedPath === "" ? prefix : `${prefix}${normalizedPath}`;
}

function normalizePath(input: string): string {
  if (!input || input === "/") return "";
  // Tolerate trailing slashes ("/about/") and missing leading ones ("about").
  const withLead = input.startsWith("/") ? input : `/${input}`;
  return withLead.length > 1 && withLead.endsWith("/")
    ? withLead.slice(0, -1)
    : withLead;
}
