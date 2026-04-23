/**
 * Email template gallery — admin-only review environment.
 *
 * Mounted under the private folder `_emails` (literally `%5Femails` on disk
 * because App Router treats underscore-prefixed folders as non-routable). The
 * URL is `/dashboard/_emails`. See the Next.js docs on private folders.
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { EMAIL_TEMPLATES } from "@/emails/registry";

export const metadata = {
  title: "Email templates",
};

export default async function EmailsIndexPage() {
  const session = await getSession();
  if (!session || !hasRole(session, "admin")) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--color-fg)]">
          Email templates
        </h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Review how each transactional / lifecycle email renders. Edit the JSON
          props to see how the template handles different inputs. Admin only.
        </p>
      </header>

      <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)] bg-[var(--color-bg)]">
        {EMAIL_TEMPLATES.map((t) => (
          <li key={t.slug}>
            <Link
              href={`/dashboard/_emails/${t.slug}`}
              className="block px-4 py-3 hover:bg-[var(--color-bg-alt)]"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-[var(--color-fg)]">
                  {t.label}
                </span>
                <code className="text-xs text-[var(--color-fg-muted)]">
                  {t.slug}
                </code>
              </div>
              <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
                {t.description}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
