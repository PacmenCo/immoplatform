/**
 * Email-verification link sent after a user changes their email address.
 * Copy lives under `emails.emailVerification.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type EmailVerificationEmailProps = {
  name: string;
  verifyUrl: string;
};

export const subjectKey = "emails.emailVerification.subject";

export function subjectArgs(_p: EmailVerificationEmailProps): Record<string, unknown> {
  return { brand: BRAND_NAME };
}

export default function EmailVerification(props: EmailVerificationEmailProps) {
  const t = useTranslations("emails.emailVerification");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { brand: BRAND_NAME })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.name })}</P>
      <P>{t("intro")}</P>
      <CtaButton href={props.verifyUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.verifyUrl}>{props.verifyUrl}</Link>
      </P>
      <P style={mutedStyle}>{t("ignoreNotice", { brand: BRAND_NAME })}</P>
    </EmailLayout>
  );
}

export const previewProps: EmailVerificationEmailProps = {
  name: "Sam",
  verifyUrl: "https://example.com/verify?token=preview",
};
