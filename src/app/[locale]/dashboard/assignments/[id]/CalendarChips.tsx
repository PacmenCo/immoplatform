"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { IconCheck } from "@/components/ui/Icons";
import {
  addAssignmentToPersonalGoogle,
  removeAssignmentFromPersonalGoogle,
} from "@/app/actions/calendar";
import { useTranslateError } from "@/i18n/error";

type Props = {
  assignmentId: string;
  agencyGoogle: boolean;
  ownOutlook: boolean;
  personalGoogleAdded: boolean;
  canAddPersonalGoogle: boolean;
};

/**
 * Visual indicators next to the status pill showing where this assignment
 * lives on calendars:
 *   - "Agency Google" when the shared-calendar event exists
 *   - "Your Outlook" when the viewer is the creator and has connected Outlook
 *   - "On your Google" + remove when the viewer opted in via "Add to my calendar"
 *   - "Add to my Google" button when they have a connected account but no event yet
 */
export function CalendarChips({
  assignmentId,
  agencyGoogle,
  ownOutlook,
  personalGoogleAdded,
  canAddPersonalGoogle,
}: Props) {
  const t = useTranslations("dashboard.assignments.calendarChips");
  const tErr = useTranslateError();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function add() {
    setError(null);
    start(async () => {
      const res = await addAssignmentToPersonalGoogle(assignmentId);
      if (!res.ok) setError(res.error);
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const res = await removeAssignmentFromPersonalGoogle(assignmentId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {agencyGoogle && (
        <Badge size="sm">
          <IconCheck size={10} className="text-[var(--color-epc)]" />
          {t("agencyGoogle")}
        </Badge>
      )}
      {ownOutlook && (
        <Badge size="sm">
          <IconCheck size={10} className="text-[var(--color-epc)]" />
          {t("yourOutlook")}
        </Badge>
      )}
      {personalGoogleAdded && (
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          title={t("removeFromGoogleTitle")}
          className="rounded-full disabled:opacity-60"
        >
          <Badge size="sm" className="hover:[&>*]:opacity-80">
            <IconCheck size={10} className="text-[var(--color-epc)]" />
            {t("onYourGoogle")}
            <span aria-hidden className="ml-0.5 text-[var(--color-ink-muted)]">×</span>
          </Badge>
        </button>
      )}
      {!personalGoogleAdded && canAddPersonalGoogle && (
        <button
          type="button"
          onClick={add}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-brand)] hover:text-[var(--color-ink)] disabled:opacity-60"
        >
          {pending ? t("adding") : t("addToMyGoogle")}
        </button>
      )}
      {error && (
        <span role="alert" className="text-xs text-[var(--color-asbestos)]">
          {tErr(error)}
        </span>
      )}
    </div>
  );
}
