/**
 * Assignment-scheduled email. Sent when an assignment lands in `scheduled`
 * with a date set. Platform parity: AssignmentScheduledMail (action=scheduled).
 * Copy lives under `emails.assignmentScheduled.*`.
 */

import * as React from "react";
import { useTranslations } from "next-intl";
import { BE_DATETIME } from "@/lib/format";
import { EmailLayout, P } from "./_layout";
import {
  AssignmentCta,
  addressLine,
  demoCtx,
  type AssignmentEmailCtx,
} from "./_assignment";

export type AssignmentScheduledEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  scheduledAt: Date;
  freelancerName: string | null;
};

export const subjectKey = "emails.assignmentScheduled.subject";

export function subjectArgs(
  p: AssignmentScheduledEmailProps,
): Record<string, unknown> {
  return {
    address: addressLine(p),
    date: BE_DATETIME.format(p.scheduledAt),
    reference: p.reference,
  };
}

export default function AssignmentScheduled(
  props: AssignmentScheduledEmailProps,
) {
  const t = useTranslations("emails.assignmentScheduled");
  const tCommon = useTranslations("emails.common");
  const dateStr = BE_DATETIME.format(props.scheduledAt);
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference, date: dateStr })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {t("body", {
          reference: props.reference,
          address: addressLine(props),
          date: dateStr,
        })}
      </P>
      <P>
        {props.freelancerName
          ? t("inspectorLine", { name: props.freelancerName })
          : t("inspectorUnassigned")}
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentScheduledEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  scheduledAt: new Date(Date.now() + 3 * 86_400_000),
  freelancerName: "Pat Inspector",
};
