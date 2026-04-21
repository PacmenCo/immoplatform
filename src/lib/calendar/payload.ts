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
  /** Internal calendar override — falls back to preferredDate. Matches
   *  Platform's `calendar_date ?: actual_date` ladder. */
  calendarDate?: Date | null;
  /** Optional — include only when caller passed comments on the input. */
  comments?: Array<{
    createdAt: Date;
    body: string;
    author: { firstName: string; lastName: string } | null;
  }>;
};

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  house: "Woning",
  apartment: "Appartement",
  studio_appartement: "Studio / appartement",
  studio_room: "Studentenkamer",
  commercial: "Handelspand",
  office: "Kantoor",
  villa: "Villa",
  land: "Grond",
};

const KEY_PICKUP_LABELS: Record<string, string> = {
  owner: "Bij de eigenaar",
  tenant: "Bij de huurder",
  office: "Op kantoor ophalen",
  lockbox: "Sleutelkluis ter plaatse",
};

type TeamLike = {
  name: string;
  legalName: string | null;
} | null;

export type PayloadInput = {
  assignment: AssignmentLike;
  team: TeamLike;
};


export function buildEventPayload(input: PayloadInput): EventPayload | null {
  const { assignment, team } = input;
  // Platform-parity date ladder: calendarDate overrides preferredDate so
  // staff can set an internal appointment time without mutating the
  // customer-visible requested date.
  const start = assignment.calendarDate ?? assignment.preferredDate;
  if (!start || Number.isNaN(start.getTime())) return null;

  const end = new Date(start.getTime() + DEFAULT_DURATION_MIN * 60_000);

  const clientName = resolveClientName(team, assignment);
  const title = `${clientName} - ${assignment.address}, ${assignment.city}`;
  const location = `${assignment.address}, ${assignment.postal} ${assignment.city}`;
  const descriptionHtml = buildDescription(assignment, start);

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
  // Platform's chain (simplified to the fields we model today):
  // team.name → team.legalName → owner → tenant → "KLANT".
  const candidates = [team?.name, team?.legalName, a.ownerName, a.tenantName];
  for (const c of candidates) {
    const trimmed = c?.trim();
    if (trimmed) return trimmed.toUpperCase();
  }
  return "KLANT";
}

function buildDescription(a: AssignmentLike, start: Date): string {
  const url = `${requireAppUrl()}/dashboard/assignments/${a.id}`;
  const rows: string[] = [];

  rows.push(`<p><strong>${escape(a.reference)}</strong></p>`);
  rows.push(
    `<p><strong>Adres:</strong> ${escape(a.address)}, ${escape(a.postal)} ${escape(a.city)}</p>`,
  );
  rows.push(`<p><strong>Datum afspraak:</strong> ${escape(formatNl(start))}</p>`);

  const propLines: string[] = [];
  if (a.propertyType) {
    propLines.push(
      `<strong>Type woning:</strong> ${escape(labelProperty(a.propertyType))}`,
    );
  }
  if (a.areaM2) propLines.push(`<strong>Oppervlakte:</strong> ${a.areaM2} m²`);
  if (a.keyPickup) {
    propLines.push(`<strong>Sleutel ophalen:</strong> ${escape(labelKeyPickup(a.keyPickup))}`);
  }
  if (propLines.length) rows.push(`<p>${propLines.join("<br />")}</p>`);

  if (a.ownerName || a.ownerEmail || a.ownerPhone) {
    rows.push(`<p><strong>Eigenaar:</strong><br />${contactLine(a.ownerName, a.ownerEmail, a.ownerPhone)}</p>`);
  }
  if (a.tenantName || a.tenantEmail || a.tenantPhone) {
    rows.push(`<p><strong>Huurder:</strong><br />${contactLine(a.tenantName, a.tenantEmail, a.tenantPhone)}</p>`);
  }

  if (a.notes) {
    rows.push(`<p><strong>Opmerkingen:</strong><br />${escape(a.notes).replace(/\n/g, "<br />")}</p>`);
  }

  if (a.comments && a.comments.length) {
    const lastFew = a.comments.slice(-5);
    rows.push("<p><strong>Laatste activiteit:</strong></p>");
    rows.push("<ul>");
    for (const c of lastFew) {
      const who = c.author ? `${c.author.firstName} ${c.author.lastName}` : "—";
      rows.push(
        `<li><strong>${escape(who)}</strong> schreef (${escape(formatNl(c.createdAt))}): ${escape(
          c.body,
        ).replace(/\n/g, " ")}</li>`,
      );
    }
    rows.push("</ul>");
  }

  rows.push(`<p><a href="${escapeAttr(url)}">Bekijk opdracht →</a></p>`);

  return rows.join("\n");
}

function labelProperty(raw: string): string {
  return PROPERTY_TYPE_LABELS[raw] ?? raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, " ");
}

function labelKeyPickup(raw: string): string {
  return KEY_PICKUP_LABELS[raw] ?? raw;
}

/** dd-mm-YYYY HH:MM in Europe/Brussels. Matches Platform's format exactly. */
function formatNl(d: Date): string {
  const fmt = new Intl.DateTimeFormat("nl-BE", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== "literal") acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.day}-${parts.month}-${parts.year} ${parts.hour}:${parts.minute}`;
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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escape(s);
}
