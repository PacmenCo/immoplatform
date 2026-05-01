import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { routing, urlPrefixFor } from "@/i18n/routing";

// Robots rules are prefix-match. After the i18n move, every page-shaped
// route lives under `/{locale}/...`, so a flat `/dashboard/` rule no longer
// covers `/en/dashboard/` or `/nl/dashboard/`. Emit the cross-product:
// {locale prefix} × {protected path}, plus the unprefixed paths as a
// defensive belt against any pre-i18n inbound link or legacy crawler.
//
// `/api/` stays unprefixed — API routes never get a locale segment.
const LOCALE_PROTECTED_PATHS = [
  "/dashboard/",
  "/no-access",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/invites/",
  "/designs/",
];

export default function robots(): MetadataRoute.Robots {
  const disallow: string[] = [];
  // Unprefixed first (matches no real route post-move, but defensive).
  for (const path of LOCALE_PROTECTED_PATHS) disallow.push(path);
  // Cross-product per locale.
  for (const locale of routing.locales) {
    const prefix = urlPrefixFor(locale);
    for (const path of LOCALE_PROTECTED_PATHS) {
      disallow.push(`${prefix}${path}`);
    }
  }
  // API never localizes.
  disallow.push("/api/");

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow,
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
