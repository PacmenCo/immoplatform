/**
 * Assignment-completed email. Sent when an agency admin signs off.
 * Platform parity: AssignmentCompletedMail. Copy lives under
 * `emails.assignmentCompleted.*`.
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

export type AssignmentCompletedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  completedByName: string;
};

export const subjectKey = "emails.assignmentCompleted.subject";

export function subjectArgs(
  p: AssignmentCompletedEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

export default function AssignmentCompleted(
  props: AssignmentCompletedEmailProps,
) {
  const t = useTranslations("emails.assignmentCompleted");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {t("body", {
          completedByName: props.completedByName,
          reference: props.reference,
          address: addressLine(props),
        })}
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentCompletedEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  completedByName: "Alex Admin",
};
