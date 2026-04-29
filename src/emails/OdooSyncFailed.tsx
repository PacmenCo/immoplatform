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
 * back to the dashboard for retry).
 */

import * as React from "react";
import { Link } from "@react-email/components";
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

export const subject = (p: OdooSyncFailedEmailProps) =>
  `Odoo sync failed — ${p.fullAddress}`;

export default function OdooSyncFailed(props: OdooSyncFailedEmailProps) {
  return (
    <EmailLayout
      preview={`Odoo sync failed for ${props.reference}`}
      title="Odoo sync failed"
    >
      <P>
        Odoo synchronization for the following assignment has failed. Click
        through to the dashboard to retry once the underlying issue is
        resolved.
      </P>
      <P style={panelStyle}>
        <strong>Reference:</strong> {props.reference}
        <br />
        <strong>Address:</strong> {props.fullAddress}
        <br />
        <strong>Owner:</strong> {props.ownerName ?? "Onbekend"} (
        {props.ownerEmail ?? "geen email"})
        <br />
        <strong>Property type:</strong> {props.propertyType ?? "Niet opgegeven"}
        <br />
        <strong>Odoo Contact ID:</strong>{" "}
        {props.odooContactId ?? "Niet aangemaakt"}
        <br />
        <strong>Odoo Order ID:</strong>{" "}
        {props.odooOrderId ?? "Niet aangemaakt"}
      </P>
      <P style={errorStyle}>
        <strong>Error:</strong>
        <br />
        {props.errorMessage}
      </P>
      <CtaButton href={props.dashboardUrl}>Open assignment</CtaButton>
      <P style={mutedStyle}>
        Or open this URL:{" "}
        <Link href={props.dashboardUrl}>{props.dashboardUrl}</Link>
      </P>
      <P style={mutedStyle}>
        This is an automated notification from the platform.
      </P>
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
