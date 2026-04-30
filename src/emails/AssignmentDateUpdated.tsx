/**
 * Assignment-date-updated email. Sent when the planned date changes.
 * Platform parity: AssignmentDateUpdated.
 */

import * as React from "react";
import { EmailLayout, P } from "./_layout";
import {
  AssignmentCta,
  addressLine,
  demoCtx,
  type AssignmentEmailCtx,
} from "./_assignment";

export type AssignmentDateUpdatedEmailProps = AssignmentEmailCtx & {
  recipientName: string;
  previousDate: Date | null;
  newDate: Date | null;
};

export const subject = (p: AssignmentDateUpdatedEmailProps) =>
  `Date changed: ${addressLine(p)} (${p.reference})`;

function fmt(d: Date | null): string {
  return d?.toISOString().slice(0, 10) ?? "unscheduled";
}

export default function AssignmentDateUpdated(
  props: AssignmentDateUpdatedEmailProps,
) {
  const prev = fmt(props.previousDate);
  const next = fmt(props.newDate);
  return (
    <EmailLayout
      preview={`Date changed on ${props.reference}`}
      title="Planned date changed"
    >
      <P>Hi {props.recipientName},</P>
      <P>
        The planned date for <strong>{props.reference}</strong> (
        {addressLine(props)}) has changed.
      </P>
      <P>
        Previous: <strong>{prev}</strong>
        <br />
        New: <strong>{next}</strong>
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentDateUpdatedEmailProps = {
  ...demoCtx,
  recipientName: "Sam",
  previousDate: new Date(Date.now() + 2 * 86_400_000),
  newDate: new Date(Date.now() + 5 * 86_400_000),
};
