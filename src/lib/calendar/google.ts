import "server-only";
import { google, type calendar_v3 } from "googleapis";
import type { CalendarAccount } from "@prisma/client";
import { prisma } from "../db";
import {
  isGoogleAgencyConfigured,
  isGooglePersonalConfigured,
} from "./config";
import { decryptToken, encryptToken } from "./crypto";
import { redirectUriFor } from "./oauth";
import type { EventPayload } from "./types";

/**
 * Google Calendar clients — two sibling flows:
 *
 * 1. **Agency shared calendar** (service account) — Platform parity.
 *    Env-configured, writes to ONE calendar id for the whole agency.
 * 2. **Personal calendars** (per-user OAuth) — the "Add to my calendar"
 *    flow. Each user connects their own Google account; we store tokens
 *    per `CalendarAccount` row and let `google-auth-library` auto-refresh.
 *
 * Event-shape parity is centralised in `payload.ts`; this module just maps
 * into `calendar_v3.Schema$Event` and hits the v3 API.
 */

// ─── Shared event mapping ──────────────────────────────────────────

function toGoogleEvent(payload: EventPayload): calendar_v3.Schema$Event {
  return {
    summary: payload.title,
    description: payload.descriptionHtml,
    location: payload.location,
    start: { dateTime: payload.start.toISOString(), timeZone: payload.timeZone },
    end: { dateTime: payload.end.toISOString(), timeZone: payload.timeZone },
    // Orange — matches Platform's GoogleCalendarService::$colorId.
    colorId: "5",
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: payload.reminderMinutes }],
    },
  };
}

// ─── Agency service-account client ─────────────────────────────────

let cachedAgency: calendar_v3.Calendar | null = null;
let cachedAgencyCalendarId: string | null = null;

function agencyClient(): { calendar: calendar_v3.Calendar; calendarId: string } {
  if (!isGoogleAgencyConfigured()) {
    throw new Error("Agency Google is not configured.");
  }
  if (cachedAgency && cachedAgencyCalendarId) {
    return { calendar: cachedAgency, calendarId: cachedAgencyCalendarId };
  }
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // The env value may be the raw PEM or a JSON blob — accept either.
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
  const key = rawKey.includes("BEGIN PRIVATE KEY")
    ? rawKey.replace(/\\n/g, "\n")
    : JSON.parse(rawKey).private_key;
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/calendar.events"],
  });
  cachedAgency = google.calendar({ version: "v3", auth });
  cachedAgencyCalendarId = process.env.GOOGLE_AGENCY_CALENDAR_ID!;
  return { calendar: cachedAgency, calendarId: cachedAgencyCalendarId };
}

export async function createAgencyGoogleEvent(payload: EventPayload): Promise<string> {
  const { calendar, calendarId } = agencyClient();
  const res = await calendar.events.insert({
    calendarId,
    requestBody: toGoogleEvent(payload),
  });
  const id = res.data.id;
  if (!id) throw new Error("Google agency insert returned no event id.");
  return id;
}

export async function updateAgencyGoogleEvent(
  eventId: string,
  payload: EventPayload,
): Promise<string> {
  const { calendar, calendarId } = agencyClient();
  try {
    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: toGoogleEvent(payload),
    });
    return eventId;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      // Platform parity: fall back to insert on 404 (event was deleted by
      // a user or vanished from the shared calendar).
      return createAgencyGoogleEvent(payload);
    }
    throw err;
  }
}

export async function deleteAgencyGoogleEvent(eventId: string): Promise<void> {
  const { calendar, calendarId } = agencyClient();
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err: unknown) {
    if (isNotFound(err) || isGone(err)) return;
    throw err;
  }
}

// ─── Personal per-user OAuth client ────────────────────────────────

/**
 * Build an OAuth2 client for a connected Google account. Wires a `tokens`
 * listener so the auto-refresh inside google-auth-library persists the
 * fresh access (and optionally refresh) token back to our DB, encrypted.
 */
function personalOAuth(account: CalendarAccount) {
  if (!isGooglePersonalConfigured()) {
    throw new Error("Personal Google OAuth is not configured.");
  }
  if (account.provider !== "google") {
    throw new Error(`Expected provider=google, got ${account.provider}.`);
  }
  if (!account.accessTokenCipher) {
    throw new Error(`CalendarAccount ${account.id} has no access token.`);
  }

  const oauth2 = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirectUri: redirectUriFor("google"),
  });

  oauth2.setCredentials({
    access_token: decryptToken(account.accessTokenCipher),
    refresh_token: account.refreshTokenCipher
      ? decryptToken(account.refreshTokenCipher)
      : undefined,
    expiry_date: account.expiresAt?.getTime() ?? undefined,
    scope: account.scope,
  });

  // Persist rotated tokens — runs on silent refresh + initial grant.
  oauth2.on("tokens", (tokens) => {
    void persistRotatedGoogleTokens(account.id, tokens);
  });

  return oauth2;
}

async function persistRotatedGoogleTokens(
  accountId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
) {
  const data: { accessTokenCipher?: string; refreshTokenCipher?: string; expiresAt?: Date } = {};
  if (tokens.access_token) data.accessTokenCipher = encryptToken(tokens.access_token);
  if (tokens.refresh_token) data.refreshTokenCipher = encryptToken(tokens.refresh_token);
  if (tokens.expiry_date) data.expiresAt = new Date(tokens.expiry_date);
  if (Object.keys(data).length === 0) return;
  await prisma.calendarAccount
    .update({ where: { id: accountId }, data })
    .catch((e) => console.error(`[calendar] persist rotated google tokens ${accountId}:`, e));
}

function personalClient(account: CalendarAccount): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: personalOAuth(account) });
}

export async function createPersonalGoogleEvent(
  account: CalendarAccount,
  payload: EventPayload,
): Promise<string> {
  const res = await personalClient(account).events.insert({
    calendarId: "primary",
    requestBody: toGoogleEvent(payload),
  });
  const id = res.data.id;
  if (!id) throw new Error("Google personal insert returned no event id.");
  return id;
}

export async function updatePersonalGoogleEvent(
  account: CalendarAccount,
  eventId: string,
  payload: EventPayload,
): Promise<string> {
  const calendar = personalClient(account);
  try {
    await calendar.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: toGoogleEvent(payload),
    });
    return eventId;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      return createPersonalGoogleEvent(account, payload);
    }
    throw err;
  }
}

export async function deletePersonalGoogleEvent(
  account: CalendarAccount,
  eventId: string,
): Promise<void> {
  try {
    await personalClient(account).events.delete({
      calendarId: "primary",
      eventId,
    });
  } catch (err: unknown) {
    if (isNotFound(err) || isGone(err)) return;
    throw err;
  }
}

export async function revokePersonalGoogle(account: CalendarAccount): Promise<void> {
  if (!account.accessTokenCipher) return;
  const token = decryptToken(account.accessTokenCipher);
  // Best-effort — if this fails we still drop the row locally.
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(5000),
  }).catch((e) => console.warn("[calendar] google revoke failed (non-fatal):", e));
}

// ─── Helpers ───────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  return hasCode(err, 404);
}
function isGone(err: unknown): boolean {
  return hasCode(err, 410);
}
function hasCode(err: unknown, code: number): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };
  return e.code === code || e.status === code;
}
