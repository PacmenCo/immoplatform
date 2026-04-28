/**
 * Password-reset email. Transactional: always sends regardless of prefs.
 * Copy preserved from `passwordResetEmail` string template.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { BrandMark, CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type PasswordResetEmailProps = {
  name: string;
  resetUrl: string;
};

export const subject = (_p: PasswordResetEmailProps) =>
  `Reset your ${BRAND_NAME} password`;

export default function PasswordReset(props: PasswordResetEmailProps) {
  return (
    <EmailLayout
      preview={`Reset your ${BRAND_NAME} password`}
      title="Reset your password"
    >
      <P>Hi {props.name},</P>
      <P>
        Someone requested a password reset for your <BrandMark size={15} />{" "}
        account. If this was you, open the link below to choose a new password.
        The link expires in 1 hour.
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
