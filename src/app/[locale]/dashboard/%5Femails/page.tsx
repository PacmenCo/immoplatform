/**
 * Email template gallery — admin-only review environment.
 *
 * Mounted under the private folder `_emails` (literally `%5Femails` on disk
 * because App Router treats underscore-prefixed folders as non-routable). The
 * URL is `/dashboard/_emails`. See the Next.js docs on private folders.
 */

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link, localeRedirect } from "@/i18n/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { EMAIL_TEMPLATES } from "@/emails/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("emails") };
}

export default async function EmailsIndexPage() {
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) {
    await localeRedirect("/dashboard");
  }

  const t = await getTranslations("dashboard.emails.index");

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">
          {t("heading")}
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          {t("description")}
        </p>
      </header>

      <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
        {EMAIL_TEMPLATES.map((tpl) => (
          <li key={tpl.slug}>
            <Link
              href={`/dashboard/%5Femails/${tpl.slug}`}
              className="block px-4 py-3 hover:bg-[var(--color-bg-alt)]"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-[var(--color-fg)]">
                  {tpl.label}
                </span>
                <code className="text-xs text-[var(--color-fg-muted)]">
                  {tpl.slug}
                </code>
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {tpl.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
