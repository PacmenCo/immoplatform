/**
 * Assignment-cancelled email. Platform parity: AssignmentStatusChangedMail
 * (cancelled).
 */

import * as React from "react";
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

export const subject = (p: AssignmentCancelledEmailProps) =>
  `Cancelled: ${addressLine(p)} (${p.reference})`;

export default function AssignmentCancelled(
  props: AssignmentCancelledEmailProps,
) {
  return (
    <EmailLayout
      preview={`${props.reference} was cancelled`}
      title="Assignment cancelled"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        {props.cancelledByName} cancelled <strong>{props.reference}</strong> (
        {addressLine(props)}).
      </P>
      {props.reason ? (
        <P>
          Reason: <em>{props.reason}</em>
        </P>
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
