/**
 * Assignment-delivered email. Sent to agency when a freelancer marks the
 * work delivered. Platform parity: AssignmentStatusChangedMail (delivered).
 * Copy lives under `emails.assignmentDelivered.*`.
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

export type AssignmentDeliveredEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  /** The person who flipped the status. May be the freelancer or an admin acting on their behalf. */
  actorName: string;
  /** The assigned freelancer's name, if any — rendered when actor ≠ freelancer so recipients know whose work was delivered. */
  freelancerName: string | null;
};

export const subjectKey = "emails.assignmentDelivered.subject";

export function subjectArgs(
  p: AssignmentDeliveredEmailProps,
): Record<string, unknown> {
  return { address: addressLine(p), reference: p.reference };
}

export default function AssignmentDelivered(
  props: AssignmentDeliveredEmailProps,
) {
  const t = useTranslations("emails.assignmentDelivered");
  const tCommon = useTranslations("emails.common");
  const useFreelancer =
    props.freelancerName && props.freelancerName !== props.actorName;
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.recipientName })}</P>
      <P>
        {useFreelancer
          ? t("bodyWithFreelancer", {
              actorName: props.actorName,
              freelancerName: props.freelancerName as string,
              address: addressLine(props),
              reference: props.reference,
            })
          : t("bodyDirect", {
              actorName: props.actorName,
              address: addressLine(props),
              reference: props.reference,
            })}
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentDeliveredEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  actorName: "Alex Admin",
  freelancerName: "Pat Inspector",
};
