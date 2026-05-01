import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

// Catch-all so unmatched /dashboard/* URLs trigger the segment's
// `not-found.tsx` (rendered inside the dashboard layout, with the sidebar)
// instead of falling through to the root marketing 404. Next.js only fires
// segment-scoped `not-found.tsx` when a route handler explicitly throws
// `notFound()` — without this catch-all, unknown URLs get routed to the
// closest match, which is `src/app/not-found.tsx`.
//
// Metadata lives here (not on `not-found.tsx`) because Next renders the
// catch-all's metadata before throwing the not-found signal — exporting
// from `not-found.tsx` doesn't always reach the `<head>`.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("notFound") };
}

export default function CatchAllNotFound() {
  notFound();
}
