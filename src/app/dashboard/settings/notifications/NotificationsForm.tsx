"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconMail } from "@/components/ui/Icons";
import { updateNotificationPrefs } from "@/app/actions/preferences";
import type { ActionResult } from "@/app/actions/_types";

export type PrefRow = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

export function NotificationsForm({ rows }: { rows: PrefRow[] }) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateNotificationPrefs, undefined);

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok && <ErrorAlert>{state.error}</ErrorAlert>}
      {state?.ok && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
        >
          Notification preferences saved.
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: "var(--color-epc)" }}
            />
            <CardTitle>Assignment events</CardTitle>
          </div>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            Emails we send when assignments you're on change state. Transactional
            mail (invites, password resets, team adds) always sends regardless.
          </p>
        </CardHeader>
        <CardBody className="p-0">
          <div className="hidden items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] sm:flex">
            <span className="flex-1">Event</span>
            <span className="flex w-24 items-center justify-center gap-1">
              <IconMail size={12} />
              Email
            </span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--color-ink)]">
                    {r.label}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                    {r.description}
                  </p>
                </div>
                <label className="flex w-24 items-center justify-center gap-2 text-xs sm:gap-0">
                  <span className="sm:hidden">Email</span>
                  <Toggle
                    defaultChecked={r.enabled}
                    name={r.key}
                    ariaLabel={`Email — ${r.label}`}
                  />
                </label>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      <div className="sticky bottom-0 -mx-8 border-t border-[var(--color-border)] bg-[var(--color-bg)]/95 px-8 py-4 backdrop-blur">
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" size="md" loading={pending}>
            Save preferences
          </Button>
        </div>
      </div>
    </form>
  );
}

function Toggle({
  defaultChecked,
  name,
  ariaLabel,
}: {
  defaultChecked?: boolean;
  name: string;
  ariaLabel?: string;
}) {
  return (
    <span className="relative inline-flex">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        role="switch"
        aria-label={ariaLabel}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="h-5 w-9 cursor-pointer rounded-full bg-[var(--color-border-strong)] transition-colors peer-checked:bg-[var(--color-brand)] peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--color-accent)] peer-focus-visible:ring-offset-2"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-[var(--color-bg)] shadow-sm transition-transform peer-checked:translate-x-4"
      />
    </span>
  );
}
