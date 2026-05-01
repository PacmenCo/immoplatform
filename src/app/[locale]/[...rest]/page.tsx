import { notFound } from "next/navigation";

/**
 * Catch-all under `[locale]` so unknown public routes (e.g. `/en/pricing`,
 * `/nl/demo`) actually render the marketing 404 (`[locale]/not-found.tsx`).
 *
 * Without this, Next.js's resolver short-circuits on a missing leaf inside
 * a dynamic segment and falls through to the framework's built-in
 * "404: This page could not be found." error page — bypassing the
 * project's branded "this page went to the inspector and never came back"
 * shell. The catch-all "matches" any URL the routes don't claim, then
 * immediately calls `notFound()`, which triggers the closest
 * `not-found.tsx` (i.e. `src/app/[locale]/not-found.tsx`).
 *
 * This is the documented next-intl + App Router pattern for catching
 * unknown locale-prefixed routes; see
 * https://next-intl.dev/docs/environments/error-files#not-found
 *
 * Dashboard 404s already work without this — `[locale]/dashboard/` has
 * its own `not-found.tsx` and Next resolves its segment cleanly because
 * the layout chain is intact below the segment. Top-level marketing
 * routes don't have that sub-segment, hence the catch-all.
 */
export default function NotFoundCatchAll() {
  notFound();
}
