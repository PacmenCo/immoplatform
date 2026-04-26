/**
 * Sent to platform admins when someone completes self-serve sign-up.
 * Lets the team notice new accounts so they can reach out / verify.
 * Platform parity: EmailTypesSeeder `user_registered`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type UserRegisteredEmailProps = {
  newUserName: string;
  newUserEmail: string;
  newUserRole: string;
  agency?: string | null;
  region?: string | null;
  usersUrl: string;
};

export const subject = (p: UserRegisteredEmailProps) =>
  `New ${p.newUserRole} signed up: ${p.newUserName}`;

export default function UserRegistered(props: UserRegisteredEmailProps) {
  return (
    <EmailLayout
      preview={`${props.newUserName} just registered as a ${props.newUserRole}.`}
      title="New user signed up"
    >
      <P>Hi,</P>
      <P>
        <strong>{props.newUserName}</strong> just registered as a{" "}
        {props.newUserRole}.
      </P>
      <P style={mutedStyle}>
        Email: <Link href={`mailto:${props.newUserEmail}`}>{props.newUserEmail}</Link>
        {props.agency ? <><br />Agency: {props.agency}</> : null}
        {props.region ? <><br />Region: {props.region}</> : null}
      </P>
      <CtaButton href={props.usersUrl}>View users</CtaButton>
      <P style={mutedStyle}>
        Or open this URL: <Link href={props.usersUrl}>{props.usersUrl}</Link>
      </P>
    </EmailLayout>
  );
}

export const previewProps: UserRegisteredEmailProps = {
  newUserName: "Riley Parker",
  newUserEmail: "riley@parkerproperties.be",
  newUserRole: "realtor",
  agency: "Parker Properties",
  region: "Brussels",
  usersUrl: "https://example.com/dashboard/users",
};
