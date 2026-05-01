/**
 * Monthly admin reminder — end-of-month nudge to generate invoices.
 * Platform parity: MonthlyInvoiceReminder. Copy lives under
 * `emails.monthlyInvoiceReminder.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type MonthlyInvoiceReminderEmailProps = {
  monthLabel: string; // e.g. "April 2026"
  overviewUrl: string;
};

export const subjectKey = "emails.monthlyInvoiceReminder.subject";

export function subjectArgs(
  p: MonthlyInvoiceReminderEmailProps,
): Record<string, unknown> {
  return { monthLabel: p.monthLabel };
}

export default function MonthlyInvoiceReminder(
  props: MonthlyInvoiceReminderEmailProps,
) {
  const t = useTranslations("emails.monthlyInvoiceReminder");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { monthLabel: props.monthLabel })}
      title={t("title", { monthLabel: props.monthLabel })}
    >
      <P>{t("greeting")}</P>
      <P>{t("body", { monthLabel: props.monthLabel })}</P>
      <CtaButton href={props.overviewUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.overviewUrl}>{props.overviewUrl}</Link>
      </P>
      <P style={mutedStyle}>{t("footerNote")}</P>
    </EmailLayout>
  );
}

export const previewProps: MonthlyInvoiceReminderEmailProps = {
  monthLabel: "April 2026",
  overviewUrl: "https://example.com/dashboard/commissions",
};
