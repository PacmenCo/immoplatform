/**
 * Assignment-delivered email. Sent to agency when a freelancer marks the
 * work delivered. Platform parity: AssignmentStatusChangedMail (delivered).
 */

import * as React from "react";
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

export const subject = (p: AssignmentDeliveredEmailProps) =>
  `Delivered: ${addressLine(p)} (${p.reference})`;

export default function AssignmentDelivered(
  props: AssignmentDeliveredEmailProps,
) {
  const byLine =
    props.freelancerName && props.freelancerName !== props.actorName
      ? `${props.actorName} marked ${props.freelancerName}'s inspection`
      : `${props.actorName} marked the inspection`;
  return (
    <EmailLayout
      preview={`${props.reference} delivered — review files`}
      title="Assignment delivered"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        {byLine} at {addressLine(props)} (<strong>{props.reference}</strong>)
        as delivered. Review the files and sign off when you&rsquo;re ready.
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
