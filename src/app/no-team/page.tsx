import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { BRAND_NAME } from "@/lib/site";

export default function NoTeamPage() {
  return (
    <AuthShell
      title="Your agency isn't set up yet."
      subtitle={`${BRAND_NAME} runs on agency teams — you need to belong to one before you can use the dashboard.`}
    >
      <div className="space-y-6">
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-5">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            What to do next
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[var(--color-ink-soft)]">
            <li className="flex gap-2">
              <span className="text-[var(--color-ink-muted)]">1.</span>
              <span>
                Ask your agency owner to invite you via{" "}
                <strong className="text-[var(--color-ink)]">
                  /dashboard/users/invite
                </strong>{" "}
                — they&apos;ll send a secure link to your work email.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-[var(--color-ink-muted)]">2.</span>
              <span>
                Click the link, set a password, and you&apos;ll land in the dashboard
                with the right team context.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] p-4 text-xs text-[var(--color-ink-soft)]">
          <p className="font-medium text-[var(--color-ink)]">Need help?</p>
          <p className="mt-1">
            If you&apos;re the founder of a new agency and should be able to create
            your own team, email us at{" "}
            <a
              href="mailto:support@immo.app"
              className="font-medium text-[var(--color-ink)] underline"
            >
              support@immo.app
            </a>{" "}
            — we&apos;ll get you set up.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Button href="/login" variant="secondary" size="lg" className="w-full">
            Switch account
          </Button>
          <Link
            href="/"
            className="text-center text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Return to homepage
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
