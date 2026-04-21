import "server-only";
import { requireAppUrl } from "./config";
import type { EventPayload } from "./types";

/**
 * Platform-parity event payload. Ports the field mapping from
 * `GoogleCalendarService.php` + `syncOutlookCalendar`:
 *
 *   title        = UPPERCASE(clientName) - address, city
 *   location     = address, postal city
 *   description  = HTML block with property + contact + link
 *   duration     = 90 min (unless we ever store a real appointmentDuration)
 *   timezone     = Europe/Brussels (hardcoded, matches Platform)
 *   reminder     = 10 min popup
 *
 * Client-name fallback mirrors Platform's chain:
 *   team.name → team.legalName → owner.name → tenant.name → 'CLIENT'.
 */

const DEFAULT_DURATION_MIN = 90;
const TIME_ZONE = "Europe/Brussels";
const REMINDER_MINUTES = 10;

type AssignmentLike = {
  id: string;
  reference: string;
  address: string;
  city: string;
  postal: string;
  propertyType: string | null;
  areaM2: number | null;
  keyPickup: string | null;
  notes: string | null;
  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
  preferredDate: Date | null;
};

type TeamLike = {
  name: string;
  legalName: string | null;
} | null;

export type PayloadInput = {
  assignment: AssignmentLike;
  team: TeamLike;
};

/** For callers that want to decide whether an assignment is even syncable. */
export function canBuildPayload(a: AssignmentLike): a is AssignmentLike & { preferredDate: Date } {
  return a.preferredDate instanceof Date && !Number.isNaN(a.preferredDate.getTime());
}

export function buildEventPayload(input: PayloadInput): EventPayload | null {
  const { assignment, team } = input;
  if (!canBuildPayload(assignment)) return null;

  const start = assignment.preferredDate;
  const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);

  const clientName = resolveClientName(team, assignment);
  const title = `${clientName} - ${assignment.address}, ${assignment.city}`;
  const location = `${assignment.address}, ${assignment.postal} ${assignment.city}`;
  const descriptionHtml = buildDescription(assignment);

  return {
    title,
    descriptionHtml,
    location,
    start,
    end,
    timeZone: TIME_ZONE,
    reminderMinutes: REMINDER_MINUTES,
  };
}

function resolveClientName(team: TeamLike, a: AssignmentLike): string {
  const candidates = [
    team?.name,
    team?.legalName,
    a.ownerName,
    a.tenantName,
  ];
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed.toUpperCase();
  }
  return "CLIENT";
}

function buildDescription(a: AssignmentLike): string {
  const url = `${requireAppUrl()}/dashboard/assignments/${a.id}`;
  const rows: string[] = [];

  rows.push(`<p><strong>${escape(a.reference)}</strong></p>`);

  const lines: string[] = [];
  if (a.propertyType) lines.push(`<strong>Type:</strong> ${escape(a.propertyType)}`);
  if (a.areaM2) lines.push(`<strong>Area:</strong> ${a.areaM2} m²`);
  if (a.keyPickup) lines.push(`<strong>Key pickup:</strong> ${escape(a.keyPickup)}`);
  if (lines.length) rows.push(`<p>${lines.join("<br />")}</p>`);

  if (a.ownerName || a.ownerEmail || a.ownerPhone) {
    rows.push(`<p><strong>Owner:</strong> ${contactLine(a.ownerName, a.ownerEmail, a.ownerPhone)}</p>`);
  }
  if (a.tenantName || a.tenantEmail || a.tenantPhone) {
    rows.push(`<p><strong>Tenant:</strong> ${contactLine(a.tenantName, a.tenantEmail, a.tenantPhone)}</p>`);
  }

  if (a.notes) {
    rows.push(`<p><strong>Notes:</strong><br />${escape(a.notes).replace(/\n/g, "<br />")}</p>`);
  }

  rows.push(`<p><a href="${escapeAttr(url)}">Open in Immo →</a></p>`);

  return rows.join("\n");
}

function contactLine(name: string | null, email: string | null, phone: string | null): string {
  const parts: string[] = [];
  if (name) parts.push(escape(name));
  if (email) parts.push(`<a href="mailto:${escapeAttr(email)}">${escape(email)}</a>`);
  if (phone) parts.push(`<a href="tel:${escapeAttr(phone)}">${escape(phone)}</a>`);
  return parts.join(" · ");
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escape(s).replace(/"/g, "&quot;");
}
