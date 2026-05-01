/**
 * Shared types + helpers for assignment-lifecycle email templates.
 * Mirrors `AssignmentEmailCtx` in `src/lib/email.ts` (source of truth for
 * the caller-facing shape).
 *
 * Copy lives under `emails.assignment.*` — both the open-assignment CTA
 * label and the optional calendar-link prompt.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, P, mutedStyle } from "./_layout";

export type AssignmentEmailCtx = {
  reference: string;
  address: string;
  city: string;
  postal: string;
  assignmentUrl: string;
  /** Optional — populated for scheduled assignments. Adds the event to the
   *  recipient's personal Google calendar in one click (session required). */
  addToCalendarUrl?: string;
};

export function addressLine(a: AssignmentEmailCtx): string {
  return `${a.address}, ${a.postal} ${a.city}`;
}

/**
 * Primary CTA — "Open assignment" — plus the optional calendar secondary link.
 * Every assignment-lifecycle email ends with this block so recipients have a
 * consistent click target.
 */
export function AssignmentCta({ ctx }: { ctx: AssignmentEmailCtx }) {
  const t = useTranslations("emails.assignment");
  const tCommon = useTranslations("emails.common");
  return (
    <>
      <CtaButton href={ctx.assignmentUrl}>{t("openCta")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={ctx.assignmentUrl}>{ctx.assignmentUrl}</Link>
      </P>
      {ctx.addToCalendarUrl ? (
        <P style={mutedStyle}>
          {t("calendarPrompt")}{" "}
          <Link href={ctx.addToCalendarUrl}>{ctx.addToCalendarUrl}</Link>
        </P>
      ) : null}
    </>
  );
}

export const demoCtx: AssignmentEmailCtx = {
  reference: "A-2026-0042",
  address: "Rue de la Loi 42",
  city: "Brussels",
  postal: "1000",
  assignmentUrl: "https://example.com/dashboard/assignments/preview",
  addToCalendarUrl: "https://example.com/api/calendar/add?assignmentId=preview",
};
