"use client";

import { Link } from "@/i18n/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/Button";
import { logout } from "@/app/actions/auth";

/**
 * Shown when someone is already signed in and lands on /invites/<token>
 * (or its set-password child). Without this guard, accepting would
 * silently swap the active session to the new invitee account, clobbering
 * the signed-in user's work. Offer to sign out and continue, or go back.
 */
export function AlreadySignedIn({
  currentEmail,
  inviteEmail,
  continueHref,
}: {
  currentEmail: string;
  inviteEmail: string;
  continueHref: string;
}) {
  const t = useTranslations("auth.invite.alreadySignedIn");
  const [pending, startTransition] = useTransition();
  return (
    <AuthShell
      title={t("title")}
      subtitle={t("subtitle")}
    >
      <div className="space-y-5">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-4 text-sm">
          <p className="text-[var(--color-ink-soft)]">
            {t("currentlySignedInAs")}{" "}
            <span className="font-semibold text-[var(--color-ink)]">{currentEmail}</span>.
          </p>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            {t("inviteIsFor")}{" "}
            <span className="font-semibold text-[var(--color-ink)]">{inviteEmail}</span>.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              await logout();
              // logout() redirects to /login; in case it doesn't, fall back.
              window.location.href = continueHref;
            })
          }
        >
          {t("signOutAndContinue")}
        </Button>
        <Button
          href="/dashboard"
          variant="secondary"
          size="lg"
          className="w-full"
        >
          {t("backToDashboard")}
        </Button>
        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          {t("closeTabHint")}
        </p>
        <p className="text-center text-xs text-[var(--color-ink-muted)]">
          <Link href="/login" className="underline hover:text-[var(--color-ink)]">
            {t("loginAsSomeoneElse")}
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
