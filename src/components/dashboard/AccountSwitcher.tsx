"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTranslateError } from "@/i18n/error";
import { switchToAccount } from "@/app/actions/account-switcher";

export type SwitcherAccount = {
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

/**
 * Dev-only account switcher. Renders a dropdown next to the team switcher
 * in the Topbar. Each item is a one-click swap to the target account —
 * the action revokes the current session, mints a new one, and redirects
 * to /dashboard/assignments. See `src/app/actions/account-switcher.ts` for
 * the server-side gates (NODE_ENV, SWITCHER_GROUP membership, soft-delete).
 *
 * Hidden in production: the parent (Topbar) only renders this when the
 * current user is in the switcher group AND the action would actually run.
 */
export function AccountSwitcher({
  currentEmail,
  accounts,
}: {
  currentEmail: string;
  accounts: SwitcherAccount[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const t = useTranslations("dashboard.shared.accountSwitcher");
  const tErr = useTranslateError();

  if (accounts.length === 0) return null;

  function close() {
    if (detailsRef.current) detailsRef.current.open = false;
    setOpen(false);
  }

  function handleSwitch(targetEmail: string) {
    startTransition(async () => {
      const res = await switchToAccount(targetEmail);
      // Server action redirects on success — we only reach this point on
      // an error result. Surface it minimally; the dev tool doesn't deserve
      // a full toast system.
      if (res && !res.ok) {
        // eslint-disable-next-line no-alert
        alert(t("switchFailed", { error: tErr(res.error) }));
      } else {
        // Success — full reload to evict any stale React state for the old
        // session. The action's redirect handles routing.
        router.refresh();
      }
      close();
    });
  }

  return (
    <details
      ref={detailsRef}
      className="relative"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary
        className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-sm hover:bg-[var(--color-bg-alt)] [&::-webkit-details-marker]:hidden"
        aria-label={t("ariaLabel")}
        aria-expanded={open}
      >
        <span aria-hidden className="text-xs text-[var(--color-ink-muted)]">
          {t("devTag")}
        </span>
        <span className="text-xs font-medium text-[var(--color-ink)]">
          {t("trigger")}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div
        role="menu"
        className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[var(--shadow-md)]"
      >
        <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-ink-muted)]">
          {t("currentlyPrefix")}{" "}
          <span className="font-medium text-[var(--color-ink)]">{currentEmail}</span>
        </div>
        <ul className="max-h-80 overflow-y-auto py-1">
          {accounts.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                role="menuitem"
                disabled={pending}
                onClick={() => handleSwitch(a.email)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-alt)] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-[var(--color-ink)]">
                    {a.firstName} {a.lastName}
                  </span>
                  <span className="block truncate text-xs text-[var(--color-ink-muted)]">
                    {a.email}
                  </span>
                </span>
                <span className="shrink-0 rounded bg-[var(--color-bg-alt)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {a.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
