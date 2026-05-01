/**
 * Assignment-date-updated email. Sent when the planned date changes.
 * Platform parity: AssignmentDateUpdated. Copy lives under
 * `emails.assignmentDateUpdated.*`.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { EmailLayout, P } from "./_layout";
import {
  AssignmentCta,
  addressLine,
  demoCtx,
  type AssignmentEmailCtx,
} from "./_assignment";

export type AssignmentDateUpdatedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  previousDate: Date | null;
  newDate: Date | null;
};

export const subjectKey = "emails.assignmentDateUpdated.subject";

export function subjectArgs(
  p: AssignmentDateUpdatedEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

function fmt(d: Date | null, fallback: string): string {
  return d?.toISOString().slice(0, 10) ?? fallback;
}

export default function AssignmentDateUpdated(
  props: AssignmentDateUpdatedEmailProps,
) {
  const t = useTranslations("emails.assignmentDateUpdated");
  const tCommon = useTranslations("emails.common");
  const unscheduled = t("unscheduled");
  const prev = fmt(props.previousDate, unscheduled);
  const next = fmt(props.newDate, unscheduled);
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {t("body", {
          reference: props.reference,
          address: addressLine(props),
        })}
      </P>
      <P>
        {t("previousLabel", { date: prev })}
        <br />
        {t("newLabel", { date: next })}
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentDateUpdatedEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  previousDate: new Date(Date.now() + 2 * 86_400_000),
  newDate: new Date(Date.now() + 5 * 86_400_000),
};
