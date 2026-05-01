/**
 * Sent to a freelancer on (re)assignment. Platform parity:
 * FreelancerAssignedMail. Copy lives under `emails.assignmentReassigned.*`.
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

export type AssignmentReassignedEmailProps = AssignmentEmailCtx & {
  freelancerName: string;
  preferredDate: Date | null;
};

export const subjectKey = "emails.assignmentReassigned.subject";

export function subjectArgs(
  p: AssignmentReassignedEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

export default function AssignmentReassigned(
  props: AssignmentReassignedEmailProps,
) {
  const t = useTranslations("emails.assignmentReassigned");
  const tCommon = useTranslations("emails.common");
  const dateStr = props.preferredDate?.toISOString().slice(0, 10) ?? null;
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.freelancerName })}</P>
      <P>
        {t("body", {
          reference: props.reference,
          address: addressLine(props),
        })}
      </P>
      {dateStr ? <P>{t("plannedDateLabel", { date: dateStr })}</P> : null}
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentReassignedEmailProps = {
  ...demoCtx,
  freelancerName: "Pat Inspector",
  preferredDate: new Date(Date.now() + 4 * 86_400_000),
};
