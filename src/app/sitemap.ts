import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { SERVICE_KEYS } from "@/lib/mockData";
import { routing, urlPrefixFor, type Locale } from "@/i18n/routing";

// Each path is emitted once per locale, with `alternates.languages` listing
// every other locale's URL for the same path. That's the hreflang signal
// Google uses to map searchers to the right language version. `x-default`
// is the fallback for unmatched locales.
//
// URL prefix (`/nl` vs `/nl-BE`) flows from `urlPrefixFor` so adding a
// locale stays a single edit in `src/i18n/routing.ts`.
const PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
  ...SERVICE_KEYS.map((slug) => ({
    path: `/services/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.9,
  })),
  { path: "/legal/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/terms", changeFrequency: "yearly", priority: 0.3 },
  { path: "/legal/cookies", changeFrequency: "yearly", priority: 0.3 },
  { path: "/register", changeFrequency: "yearly", priority: 0.6 },
];

function urlFor(locale: Locale, path: string): string {
  const prefix = urlPrefixFor(locale);
  return path === "/" ? `${SITE_URL}${prefix}` : `${SITE_URL}${prefix}${path}`;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PATHS.flatMap(({ path, changeFrequency, priority }) =>
    routing.locales.map((locale) => {
      const languages: Record<string, string> = {};
      for (const l of routing.locales) languages[l] = urlFor(l, path);
      languages["x-default"] = urlFor(routing.defaultLocale, path);
      return {
        url: urlFor(locale, path),
        lastModified: now,
        changeFrequency,
        priority,
        alternates: { languages },
      };
    }),
  );
}
