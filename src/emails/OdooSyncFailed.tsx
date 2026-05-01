/**
 * Operational alert — fires from src/lib/odoo-sync.ts whenever Odoo sync
 * for an assignment lands in the "failed" state (odooSyncedAt null +
 * odooSyncError set). Recipient list is configured via
 * ODOO_SYNC_FAILURE_EMAIL (falls back to INVOICE_REMINDER_EMAIL). v1
 * parity: Platform's emails/odoo-sync-failed.blade.php.
 *
 * Body fields mirror v1 field-for-field (assignment ID, full address,
 * owner name + email with "Onbekend" / "geen email" fallbacks, property
 * type, Odoo IDs with "Niet aangemaakt" fallback, error message, link
 * back to the dashboard for retry). Copy lives under
 * `emails.odooSyncFailed.*`.
 */

import * as React from "react";
import { Link } from "@react-email/components";
import { useTranslations } from "next-intl";
import { CtaButton, EmailLayout, P, mutedStyle } from "./_layout";

export type OdooSyncFailedEmailProps = {
  assignmentId: string;
  reference: string;
  fullAddress: string;
  ownerName: string | null;
  ownerEmail: string | null;
  propertyType: string | null;
  odooContactId: number | null;
  odooOrderId: number | null;
  errorMessage: string;
  dashboardUrl: string;
};

export const subjectKey = "emails.odooSyncFailed.subject";

export function subjectArgs(
  p: OdooSyncFailedEmailProps,
): Record<string, unknown> {
  return { address: p.fullAddress };
}

export default function OdooSyncFailed(props: OdooSyncFailedEmailProps) {
  const t = useTranslations("emails.odooSyncFailed");
  const tCommon = useTranslations("emails.common");
  return (
    <EmailLayout
      preview={t("preview", { reference: props.reference })}
      title={t("title")}
    >
      <P>{t("intro")}</P>
      <P style={panelStyle}>
        <strong>{t("referenceLabel")}</strong> {props.reference}
        <br />
        <strong>{t("addressLabel")}</strong> {props.fullAddress}
        <br />
        <strong>{t("ownerLabel")}</strong>{" "}
        {props.ownerName ?? t("ownerUnknown")} (
        {props.ownerEmail ?? t("ownerNoEmail")})
        <br />
        <strong>{t("propertyTypeLabel")}</strong>{" "}
        {props.propertyType ?? t("propertyTypeUnknown")}
        <br />
        <strong>{t("odooContactIdLabel")}</strong>{" "}
        {props.odooContactId ?? t("odooNotCreated")}
        <br />
        <strong>{t("odooOrderIdLabel")}</strong>{" "}
        {props.odooOrderId ?? t("odooNotCreated")}
      </P>
      <P style={errorStyle}>
        <strong>{t("errorHeading")}</strong>
        <br />
        {props.errorMessage}
      </P>
      <CtaButton href={props.dashboardUrl}>{t("ctaButton")}</CtaButton>
      <P style={mutedStyle}>
        {tCommon("openUrlPrefix")}{" "}
        <Link href={props.dashboardUrl}>{props.dashboardUrl}</Link>
      </P>
      <P style={mutedStyle}>{tCommon("automatedNotice")}</P>
    </EmailLayout>
  );
}

const panelStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 6,
  padding: "12px 16px",
  fontSize: 14,
  lineHeight: 1.7,
};

const errorStyle: React.CSSProperties = {
  backgroundColor: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: 6,
  padding: "12px 16px",
  fontSize: 13,
  lineHeight: 1.6,
  fontFamily:
    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  whiteSpace: "pre-wrap",
};

export const previewProps: OdooSyncFailedEmailProps = {
  assignmentId: "asg_preview_id",
  reference: "ASG-2026-1042",
  fullAddress: "Meir 34, 2000 Antwerpen",
  ownerName: "Sam De Vries",
  ownerEmail: "sam@example.be",
  propertyType: "apartment",
  odooContactId: 4711,
  odooOrderId: 9821,
  errorMessage:
    "Odoo res.partner.create: AccessError: You don't have permission to create res.partner.",
  dashboardUrl: "https://immoplatform.be/dashboard/assignments/asg_preview_id",
};
