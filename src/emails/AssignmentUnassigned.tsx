/**
 * Sent to a freelancer when they're removed from an assignment.
 * Platform parity: FreelancerUnassignedMail.
 */

import * as React from "react";
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

export const subject = (p: AssignmentUnassignedEmailProps) =>
  `Unassigned: ${addressLine(p)} (${p.reference})`;

export default function AssignmentUnassigned(
  props: AssignmentUnassignedEmailProps,
) {
  return (
    <EmailLayout
      preview={`You've been removed from ${props.reference}`}
      title="Removed from an assignment"
    >
      <P>Hi {props.freelancerName},</P>
      <P>
        You&rsquo;ve been removed from <strong>{props.reference}</strong> (
        {addressLine(props)}). No action needed on your side.
      </P>
      <AssignmentCta ctx={props} />
    </EmailLayout>
  );
}

export const previewProps: AssignmentUnassignedEmailProps = {
  ...demoCtx,
  freelancerName: "Pat Inspector",
};
