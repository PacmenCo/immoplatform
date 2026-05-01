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

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Link, localeRedirect } from "@/i18n/navigation";
import { render } from "@react-email/render";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { findTemplate, hydratePropsFromJson } from "@/emails/registry";
import { EmailPreviewEditor } from "./EmailPreviewEditor";

// KNOWN LIMITATION: this admin-only dev preview is currently broken because
// email templates call `useTranslations()` internally and the RSC server-
// component context can't invoke `NextIntlClientProvider` (client-only) and
// can't import `IntlProvider` from `use-intl/react` (would leak `createContext`
// into the RSC bundle and crash other routes — verified). Real email sending
// works via `src/lib/email.tsx` which renders from a server-action context
// that CAN invoke client components. Fixing this preview tool requires either
// (a) converting all 17 templates to receive `t` as a prop (big refactor) or
// (b) moving the preview render into a route handler. Out of scope for the
// current i18n push; tracked for follow-up.

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
    await localeRedirect("/dashboard");
  }

  const { slug } = await params;
  const { props: propsParam } = await searchParams;

  const tpl = findTemplate(slug);
  if (!tpl) notFound();

  const t = await getTranslations("dashboard.emails.detail");

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

  // See KNOWN LIMITATION at top of file. Render attempt below will fail
  // with "useTranslations is not callable within an async component" until
  // the templates are refactored to receive a translator as a prop.
  const element = tpl.element(props);
  const [html, text] = await Promise.all([
    render(element, { pretty: true }).catch(() => "<p>Preview unavailable — see file header for context.</p>"),
    render(element, { plainText: true }).catch(() => "Preview unavailable — see file header for context."),
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
            href="/dashboard/%5Femails"
            className="text-sm text-[var(--color-fg-muted)] hover:underline"
          >
            {t("backToList")}
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
          <span className="text-[var(--color-fg-muted)]">{t("subjectLabel")}</span>{" "}
          <strong>{subject}</strong>
        </div>
        {parseError ? (
          <div className="mt-2 text-[color:var(--color-danger,#b91c1c)]">
            {t("propsErrorPrefix", { error: parseError })}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <EmailPreviewEditor slug={slug} initialJson={initialPropsJson} />

        <div className="space-y-4 min-w-0">
          <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-white">
            <iframe
              title={t("previewIframeTitle", { label: tpl.label })}
              srcDoc={html}
              className="h-[700px] w-full"
            />
          </div>

          <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--color-fg)]">
              {t("plainTextSummary")}
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
