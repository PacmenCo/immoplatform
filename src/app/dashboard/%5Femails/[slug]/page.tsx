/**
 * Email template preview page.
 *
 * Renders the selected React Email template server-side via `render()`, then
 * embeds the result into an iframe using `srcDoc`. The editable props panel
 * (client component) round-trips JSON via a `?props=...` query string so
 * server-side rehydration stays deterministic and no client JS is needed
 * to render the email.
 *
 * Admin only — same gate as the index page.
 */

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { render } from "@react-email/render";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { findTemplate, hydratePropsFromJson } from "@/emails/registry";
import { EmailPreviewEditor } from "./EmailPreviewEditor";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ props?: string }>;

export default async function EmailPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: SearchParams;
}) {
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) {
    redirect("/dashboard");
  }

  const { slug } = await params;
  const { props: propsParam } = await searchParams;

  const tpl = findTemplate(slug);
  if (!tpl) notFound();

  // Decide which props object to use: defaults if no query string, otherwise
  // parse the JSON. Bad JSON falls back to defaults with an inline error.
  let props: Record<string, unknown> = tpl.previewProps;
  let parseError: string | null = null;
  if (propsParam) {
    try {
      const decoded = JSON.parse(propsParam) as Record<string, unknown>;
      props = hydratePropsFromJson(slug, decoded);
    } catch (err) {
      parseError =
        err instanceof Error
          ? err.message
          : "Unable to parse props JSON.";
    }
  }

  // Render HTML + plain-text preview. We do both so admins can verify the
  // text fallback matches what inboxes without HTML see.
  const element = tpl.element(props);
  const [html, text] = await Promise.all([
    render(element, { pretty: true }),
    render(element, { plainText: true }),
  ]);

  const subject = tpl.subject(props);

  // Serialise props back with Date -> ISO so the editor can display them
  // as strings. JSON.stringify already handles Date via toJSON() = ISO.
  const initialPropsJson = JSON.stringify(props, null, 2);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <div>
          <Link
            href="/dashboard/_emails"
            className="text-sm text-[var(--color-fg-muted)] hover:underline"
          >
            ← All templates
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--color-fg)]">
            {tpl.label}
          </h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            {tpl.description}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm">
        <div>
          <span className="text-[var(--color-fg-muted)]">Subject:</span>{" "}
          <strong>{subject}</strong>
        </div>
        {parseError ? (
          <div className="mt-2 text-[color:var(--color-danger,#b91c1c)]">
            Props JSON error: {parseError} — showing defaults.
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <EmailPreviewEditor slug={slug} initialJson={initialPropsJson} />

        <div className="space-y-4 min-w-0">
          <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
            <iframe
              title={`${tpl.label} preview`}
              srcDoc={html}
              className="h-[700px] w-full"
            />
          </div>

          <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--color-fg)]">
              Plain-text fallback
            </summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-[var(--color-fg-muted)]">
              {text}
            </pre>
          </details>
        </div>
      </div>
    </main>
  );
}
