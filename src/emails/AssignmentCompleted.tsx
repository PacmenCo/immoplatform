/**
 * Assignment-completed email. Sent when an agency admin signs off.
 * Platform parity: AssignmentCompletedMail.
 */

import * as React from "react";
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

export const subject = (p: AssignmentCompletedEmailProps) =>
  `Completed: ${addressLine(p)} (${p.reference})`;

export default function AssignmentCompleted(
  props: AssignmentCompletedEmailProps,
) {
  return (
    <EmailLayout
      preview={`${props.reference} signed off`}
      title="Assignment completed"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        {props.completedByName} signed off on{" "}
        <strong>{props.reference}</strong> ({addressLine(props)}). It&rsquo;s
        now closed and moves out of the active queue.
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
