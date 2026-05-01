import { localeRedirect } from "@/i18n/navigation";

/**
 * The legacy details route. The merged assignment page now lives at
 * `/dashboard/assignments/[id]/edit`. We keep this redirect so external
 * URLs (email links from `lib/urls.ts`, calendar event descriptions, OAuth
 * callbacks) continue to land on a working page. Search params (`?notice=...`)
 * are forwarded so the in-app post-action banner still surfaces after the
 * extra hop.
 */
export default async function AssignmentDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) for (const item of v) qs.append(k, item);
  }
  const tail = qs.toString();
  await localeRedirect(
    `/dashboard/assignments/${id}/edit${tail ? `?${tail}` : ""}`,
  );
}
