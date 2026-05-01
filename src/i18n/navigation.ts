import { createNavigation } from "next-intl/navigation";
import { getLocale } from "next-intl/server";
import { routing } from "./routing";

// Drop-in locale-aware replacements:
//   import { Link, redirect, usePathname, useRouter } from "@/i18n/navigation";
// Use these instead of `next/link` / `next/navigation` for any URL the user
// can see or that you redirect to. They auto-prefix the active locale, so
// `<Link href="/about">` routes to `/nl/about` or `/en/about` without an
// extra middleware redirect hop.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

/**
 * Locale-aware server-side redirect with the active locale resolved for you.
 *
 * Why this exists: every server action / page redirect was duplicating the
 * `redirect({ href, locale: await getLocale() })` boilerplate. A single
 * missed `await getLocale()` ships an unprefixed URL that the middleware
 * has to re-route — slower, and a regression vector. Use this helper for
 * any redirect that runs inside a request scope (server actions, server
 * components, route segment handlers under `[locale]/`).
 *
 * When NOT to use it: anywhere `getLocale()` can't read request-scoped
 * config — emails (use the recipient's stored locale), cron jobs, OAuth
 * callbacks that bounce to external providers. In those cases call the
 * underlying `redirect({ href, locale })` from `@/i18n/navigation` and
 * pass the locale explicitly. For redirects to fully external URLs
 * (Google/Outlook OAuth initiate), use `redirect` from `next/navigation`
 * directly — locale prefixing doesn't apply to off-site URLs.
 *
 * @param href Unprefixed app-route path (e.g. `/dashboard/assignments`).
 *             The helper resolves the active locale and prefixes for you.
 */
export async function localeRedirect(href: string): Promise<never> {
  const locale = await getLocale();
  return redirect({ href, locale });
}
