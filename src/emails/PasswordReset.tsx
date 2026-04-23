/**
 * Password-reset email. Transactional: always sends regardless of prefs.
 * Copy preserved from `passwordResetEmail` string template.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type PasswordResetEmailProps = {
  name: string;
  resetUrl: string;
};

export const subject = (_p: PasswordResetEmailProps) =>
  "Reset your Immo password";

export default function PasswordReset(props: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview="Reset your Immo password"
      title="Reset your password"
    >
      <P>Hi {props.name},</P>
      <P>
        Someone requested a password reset for your Immo account. If this was
        you, open the link below to choose a new password. The link expires in
        1 hour.
      </P>
      <CtaButton href={props.resetUrl}>Choose a new password</CtaButton>
      <P style={mutedStyle}>
        Or open this URL: <Link href={props.resetUrl}>{props.resetUrl}</Link>
      </P>
      <P style={mutedStyle}>
        If you didn&rsquo;t request this, you can safely ignore this email.
      </P>
    </EmailLayout>
  );
}

export const previewProps: PasswordResetEmailProps = {
  name: "Sam",
  resetUrl: "https://example.com/reset?token=preview",
};
