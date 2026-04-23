/**
 * Monthly admin reminder — end-of-month nudge to generate invoices.
 * Platform parity: MonthlyInvoiceReminder.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type MonthlyInvoiceReminderEmailProps = {
  monthLabel: string; // e.g. "April 2026"
  overviewUrl: string;
};

export const subject = (p: MonthlyInvoiceReminderEmailProps) =>
  `Invoices due — ${p.monthLabel}`;

export default function MonthlyInvoiceReminder(
  props: MonthlyInvoiceReminderEmailProps,
) {
  return (
    <EmailLayout
      preview={`Heads up: it's the end of ${props.monthLabel}.`}
      title={`Invoices due — ${props.monthLabel}`}
    >
      <P>Hi,</P>
      <P>
        Heads up: it&rsquo;s the end of {props.monthLabel}. Review the
        completed assignments for this month and generate invoices for any
        that are still open.
      </P>
      <CtaButton href={props.overviewUrl}>Go to overview</CtaButton>
      <P style={mutedStyle}>
        Or open this URL:{" "}
        <Link href={props.overviewUrl}>{props.overviewUrl}</Link>
      </P>
      <P style={mutedStyle}>
        You&rsquo;re getting this as the platform&rsquo;s billing contact.
      </P>
    </EmailLayout>
  );
}

export const previewProps: MonthlyInvoiceReminderEmailProps = {
  monthLabel: "April 2026",
  overviewUrl: "https://example.com/dashboard/commissions",
};
