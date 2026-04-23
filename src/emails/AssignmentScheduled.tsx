/**
 * Assignment-scheduled email. Sent when an assignment lands in `scheduled`
 * with a date set. Platform parity: AssignmentScheduledMail (action=scheduled).
 */

import * as React from "react";
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

export const subject = (p: AssignmentScheduledEmailProps) =>
  `Scheduled: ${addressLine(p)} — ${BE_DATETIME.format(p.scheduledAt)} (${p.reference})`;

export default function AssignmentScheduled(
  props: AssignmentScheduledEmailProps,
) {
  const dateStr = BE_DATETIME.format(props.scheduledAt);
  return (
    <EmailLayout
      preview={`${props.reference} scheduled for ${dateStr}`}
      title="Assignment scheduled"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        <strong>{props.reference}</strong> at {addressLine(props)} is now
        scheduled for <strong>{dateStr}</strong>.
      </P>
      <P>
        Inspector:{" "}
        {props.freelancerName ? (
          <strong>{props.freelancerName}</strong>
        ) : (
          <em>not yet assigned</em>
        )}
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
