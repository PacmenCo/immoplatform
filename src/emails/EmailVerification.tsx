/**
 * Email-verification link sent after a user changes their email address.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { BrandMark, CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type EmailVerificationEmailProps = {
  name: string;
  verifyUrl: string;
};

/** Constant subject — param kept so the call-signature is uniform across
 *  templates (the registry treats `subject(props)` as homogeneous). */
export const subject = (_p: EmailVerificationEmailProps): string =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  `Verify your ${BRAND_NAME} email address`;

export default function EmailVerification(props: EmailVerificationEmailProps) {
  return (
    <EmailLayout
      preview={`Confirm your email address on ${BRAND_NAME}`}
      title="Verify your email"
    >
      <P>Hi {props.name},</P>
      <P>
        Confirm this is your email address so we can send you account
        notifications. The link expires in 24 hours.
      </P>
      <CtaButton href={props.verifyUrl}>Verify email</CtaButton>
      <P style={mutedStyle}>
        Or open this URL: <Link href={props.verifyUrl}>{props.verifyUrl}</Link>
      </P>
      <P style={mutedStyle}>
        If you didn&rsquo;t change your email on <BrandMark size={13} />, you
        can safely ignore this message — your account stays on the previous
        address.
      </P>
    </EmailLayout>
  );
}

export const previewProps: EmailVerificationEmailProps = {
  name: "Sam",
  verifyUrl: "https://example.com/verify?token=preview",
};
