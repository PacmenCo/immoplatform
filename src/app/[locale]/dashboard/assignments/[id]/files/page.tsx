import { localeRedirect } from "@/i18n/navigation";

/**
 * Files have been folded into the merged assignment page. Redirect to keep
 * any bookmarks / external links working.
 */
export default async function AssignmentFilesRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await localeRedirect(`/dashboard/assignments/${id}/edit`);
}
