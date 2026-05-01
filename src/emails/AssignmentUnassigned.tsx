/**
 * Sent to a freelancer when they're removed from an assignment.
 * Platform parity: FreelancerUnassignedMail. Copy lives under
 * `emails.assignmentUnassigned.*`.
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

export type AssignmentUnassignedEmailProps = AssignmentEmailCtx & {
  freelancerName: string;
};

export const subjectKey = "emails.assignmentUnassigned.subject";

export function subjectArgs(
  p: AssignmentUnassignedEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

export default function AssignmentUnassigned(
  props: AssignmentUnassignedEmailProps,
) {
  const t = useTranslations("emails.assignmentUnassigned");
  const tCommon = useTranslations("emails.common");
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
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentUnassignedEmailProps = {
  ...demoCtx,
  freelancerName: "Pat Inspector",
};
