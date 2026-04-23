/**
 * Added-to-team email — sent when an existing user is added to a team.
 * Platform parity: ExistingUserTeamInvitationMail (welcome half of the flow).
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type AddedToTeamEmailProps = {
  inviterName: string;
  teamName: string;
  teamRole: string;
  loginUrl: string;
};

export const subject = (p: AddedToTeamEmailProps) =>
  `You've been added to ${p.teamName} on Immo`;

export default function AddedToTeam(props: AddedToTeamEmailProps) {
  return (
    <EmailLayout
      preview={`You've been added to ${props.teamName}`}
      title={`Welcome to ${props.teamName}`}
    >
      <P>
        {props.inviterName} added you to the team{" "}
        <strong>&ldquo;{props.teamName}&rdquo;</strong> on Immo as a{" "}
        {props.teamRole}.
      </P>
      <P>Sign in to see the team&rsquo;s assignments:</P>
      <CtaButton href={props.loginUrl}>Sign in</CtaButton>
      <P style={mutedStyle}>
        Or open this URL: <Link href={props.loginUrl}>{props.loginUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: AddedToTeamEmailProps = {
  inviterName: "Alex Admin",
  teamName: "Downtown Agency",
  teamRole: "member",
  loginUrl: "https://example.com/login",
};
