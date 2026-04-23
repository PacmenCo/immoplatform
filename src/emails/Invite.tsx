/**
 * Invite email — sent when an inviter creates a user invite.
 *
 * Platform parity: NewUserTeamInvitationMail / ExistingUserTeamInvitationMail,
 * flattened into a single template since Immo's invite flow is unified.
 * Copy is preserved verbatim from the string template in `lib/email.ts`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type InviteEmailProps = {
  inviterName: string;
  acceptUrl: string;
  role: string;
  teamName?: string | null;
  teamRole?: string | null;
  note?: string | null;
  expiresAt: Date;
};

export const subject = (p: InviteEmailProps) =>
  `You're invited to join Immo as a ${p.role}`;

export default function Invite(props: InviteEmailProps) {
  const expiresOn = props.expiresAt.toISOString().slice(0, 10);
  const preview = `${props.inviterName} invited you to Immo.`;
  return (
    <EmailLayout preview={preview} title={`You're invited to Immo`}>
      <P>
        <strong>{props.inviterName}</strong> invited you to Immo.
      </P>
      <P>
        Role: <strong>{props.role}</strong>
        {props.teamName ? (
          <>
            <br />
            Team: <strong>{props.teamName}</strong>
            {props.teamRole ? <> ({props.teamRole})</> : null}
          </>
        ) : null}
      </P>
      {props.note ? (
        <P>
          Note from {props.inviterName}:{" "}
          <em>&ldquo;{props.note}&rdquo;</em>
        </P>
      ) : null}
      <P>Accept your invite and set a password:</P>
      <CtaButton href={props.acceptUrl}>Accept invite</CtaButton>
      <P style={mutedStyle}>
        Or open this URL:{" "}
        <Link href={props.acceptUrl}>{props.acceptUrl}</Link>
      </P>
      <P style={mutedStyle}>This link expires on {expiresOn}.</P>
    </EmailLayout>
  );
}

export const previewProps: InviteEmailProps = {
  inviterName: "Alex Admin",
  acceptUrl: "https://example.com/invite/accept?token=preview",
  role: "realtor",
  teamName: "Downtown Agency",
  teamRole: "member",
  note: "Looking forward to working with you!",
  expiresAt: new Date(Date.now() + 7 * 86_400_000),
};
