/**
 * Assignment-cancelled email. Platform parity: AssignmentStatusChangedMail
 * (cancelled). Copy lives under `emails.assignmentCancelled.*`.
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

export type AssignmentCancelledEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  cancelledByName: string;
  reason: string | null;
};

export const subjectKey = "emails.assignmentCancelled.subject";

export function subjectArgs(
  p: AssignmentCancelledEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

export default function AssignmentCancelled(
  props: AssignmentCancelledEmailProps,
) {
  const t = useTranslations("emails.assignmentCancelled");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {t("body", {
          cancelledByName: props.cancelledByName,
          reference: props.reference,
          address: addressLine(props),
        })}
      </P>
      {props.reason ? (
        <P>{t("reasonLabel", { reason: props.reason })}</P>
      ) : null}
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentCancelledEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  cancelledByName: "Alex Admin",
  reason: "Owner rescheduled to next quarter.",
};
