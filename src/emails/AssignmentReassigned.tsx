/**
 * Sent to a freelancer on (re)assignment. Platform parity:
 * FreelancerAssignedMail.
 */

import * as React from "react";
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

export const subject = (p: AssignmentReassignedEmailProps) =>
  `New inspection: ${addressLine(p)} (${p.reference})`;

export default function AssignmentReassigned(
  props: AssignmentReassignedEmailProps,
) {
  const dateStr = props.preferredDate?.toISOString().slice(0, 10) ?? null;
  return (
    <EmailLayout
      preview={`New inspection: ${props.reference}`}
      title="You've been assigned to a new inspection"
    >
      <P>Hi {props.freelancerName},</P>
      <P>
        You&rsquo;ve been assigned to <strong>{props.reference}</strong> (
        {addressLine(props)}).
      </P>
      {dateStr ? (
        <P>
          Planned date: <strong>{dateStr}</strong>
        </P>
      ) : null}
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentReassignedEmailProps = {
  ...demoCtx,
  freelancerName: "Pat Inspector",
  preferredDate: new Date(Date.now() + 4 * 86_400_000),
};
