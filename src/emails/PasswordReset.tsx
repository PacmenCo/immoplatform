/**
 * Password-reset email. Transactional: always sends regardless of prefs.
 * Copy lives under `emails.passwordReset.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";
import { BRAND_NAME } from "@/lib/site";

export type PasswordResetEmailProps = {
  name: string;
  resetUrl: string;
};

export const subjectKey = "emails.passwordReset.subject";

export function subjectArgs(_p: PasswordResetEmailProps): Record<string, unknown> {
  return { brand: BRAND_NAME };
}

export default function PasswordReset(props: PasswordResetEmailProps) {
  const t = useTranslations("emails.passwordReset");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { brand: BRAND_NAME })}
      title={t("title")}
    >
      <P>{tCommon("hi", { name: props.name })}</P>
      <P>{t("intro", { brand: BRAND_NAME })}</P>
      <CtaButton href={props.resetUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.resetUrl}>{props.resetUrl}</Link>
      </P>
      <P style={mutedStyle}>{t("ignoreNotice")}</P>
    </EmailLayout>
  );
}

export const previewProps: PasswordResetEmailProps = {
  name: "Sam",
  resetUrl: "https://example.com/reset?token=preview",
};
