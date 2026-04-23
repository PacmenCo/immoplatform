/**
 * Shared types + helpers for assignment-lifecycle email templates.
 * Mirrors `AssignmentEmailCtx` in `src/lib/email.ts` (source of truth for
 * the caller-facing shape).
 */

import * as React from "react";
import { Link } from "@react-email/components";
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
  return (
    <>
      <CtaButton href={ctx.assignmentUrl}>Open assignment</CtaButton>
      <P style={mutedStyle}>
        Or open this URL:{" "}
        <Link href={ctx.assignmentUrl}>{ctx.assignmentUrl}</Link>
      </P>
      {ctx.addToCalendarUrl ? (
        <P style={mutedStyle}>
          Add this appointment to your Google calendar:{" "}
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
