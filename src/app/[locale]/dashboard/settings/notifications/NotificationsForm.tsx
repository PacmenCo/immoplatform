"use client";

import { useActionState, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconMail } from "@/components/ui/Icons";
import { updateNotificationPrefs } from "@/app/actions/preferences";
import { SettingsSaveBar } from "@/components/dashboard/SettingsSaveBar";
import { useTranslateError } from "@/i18n/error";
import type { ActionResult } from "@/app/actions/_types";
import type { EmailCategoryKey } from "@/lib/email-events";

export type PrefRow = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

export type PrefGroup = {
  key: EmailCategoryKey;
  label: string;
  description: string;
  rows: PrefRow[];
};

/** Dot color per category, matching service/brand accents defined in globals.css. */
const CATEGORY_DOT: Record<EmailCategoryKey, string> = {
  assignment: "var(--color-epc)",
  team: "var(--color-brand)",
  user: "var(--color-electrical)",
};

export function NotificationsForm({ groups }: { groups: PrefGroup[] }) {
  const t = useTranslations("dashboard.settings.notifications");
  const tSave = useTranslations("dashboard.settings.saveBar");
  const tErr = useTranslateError();
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateNotificationPrefs, undefined);

  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {state && !state.ok && <ErrorAlert>{tErr(state.error)}</ErrorAlert>}
      {state?.ok && (
        <p
          role="status"
          className="rounded-md border border-[var(--color-epc)]/30 bg-[color-mix(in_srgb,var(--color-epc)_6%,var(--color-bg))] px-3 py-2 text-sm text-[var(--color-ink-soft)]"
        >
          {t("saved")}
        </p>
      )}

      {groups.map((group) => (
        <Card key={group.key}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_DOT[group.key] }}
              />
              <CardTitle>{group.label}</CardTitle>
            </div>
            <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
              {group.description}
            </p>
          </CardHeader>
          <CardBody className="p-0">
            <div className="hidden items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)] px-6 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)] sm:flex">
              <span className="flex-1">{t("header.event")}</span>
              <span className="flex w-24 items-center justify-center gap-1">
                <IconMail size={12} />
                {t("header.email")}
              </span>
            </div>
            <ul className="divide-y divide-[var(--color-border)]">
              {group.rows.map((r) => (
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
                    <span className="sm:hidden">{t("rowEmailLabel")}</span>
                    <Toggle
                      defaultChecked={r.enabled}
                      name={r.key}
                      ariaLabel={t("rowToggleAria", { label: r.label })}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}

      <p className="text-xs text-[var(--color-ink-muted)]">
        {t("footer")}
      </p>

      <SettingsSaveBar
        formRef={formRef}
        pending={pending}
        label={tSave("savePreferences")}
      />
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
