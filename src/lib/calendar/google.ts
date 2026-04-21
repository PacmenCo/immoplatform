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
    // Banana (Google's colorId 5 is banana/yellow). Matches Platform.
    colorId: "5",
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: payload.reminderMinutes }],
    },
  };
}

/**
 * Deterministic client-supplied event id. Google accepts caller-set ids
 * on `events.insert` and returns 409 if one already exists — which makes
 * the insert idempotent across retries. The id must be base32hex (lowercase
 * a-v, 0-9) and 5–1024 chars. We use sha1 over a stable key so a retry
 * after a 5xx never duplicates the event.
 */
async function deterministicGoogleEventId(stableKey: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  // sha1 hex is base16; map hex to base32hex (0-9 a-v) by a simple pass.
  const hex = createHash("sha1").update(stableKey).digest("hex");
  return hex
    .split("")
    .map((c) => {
      const n = parseInt(c, 16);
      return n < 10 ? String(n) : String.fromCharCode("a".charCodeAt(0) + (n - 10));
    })
    .join("");
}

/**
 * Retry once on transient 5xx / 429 after a short sleep. Google writes
 * are cheap, and without this we silently drop events on brief Google
 * hiccups — Platform's queued job had 3 retries; one inline retry keeps
 * the happy-path simple and covers most transient flakes.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (isTransient(err)) {
      console.warn(`[calendar] ${label} transient error — retrying once:`, err);
      await sleep(750);
      return fn();
    }
    throw err;
  }
}

function isTransient(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };
  // HTTP status (GaxiosError puts it on `.status`, occasionally on `.code`).
  const httpCode =
    typeof e.status === "number" ? e.status : typeof e.code === "number" ? e.code : 0;
  if (httpCode === 429 || (httpCode >= 500 && httpCode <= 599)) return true;
  // Node system errors surface as string codes on .code.
  if (typeof e.code === "string") {
    return (
      e.code === "ECONNRESET" ||
      e.code === "ETIMEDOUT" ||
      e.code === "ECONNREFUSED" ||
      e.code === "EAI_AGAIN" ||
      e.code === "ENOTFOUND"
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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

export async function createAgencyGoogleEvent(
  payload: EventPayload,
  stableKey: string,
): Promise<string> {
  const { calendar, calendarId } = agencyClient();
  // Deterministic id makes the insert idempotent — a 5xx retry that actually
  // landed upstream surfaces as a 409 we swallow with a GET, instead of
  // creating a duplicate event.
  const requestId = await deterministicGoogleEventId(`agency:${stableKey}`);
  try {
    const res = await withRetry("agency.insert", () =>
      calendar.events.insert({
        calendarId,
        requestBody: { ...toGoogleEvent(payload), id: requestId },
      }),
    );
    return res.data.id ?? requestId;
  } catch (err: unknown) {
    if (isConflict(err)) {
      return requestId; // already exists — retry landed twice, return same id
    }
    throw err;
  }
}

export async function updateAgencyGoogleEvent(
  eventId: string,
  payload: EventPayload,
  stableKey: string,
): Promise<string> {
  const { calendar, calendarId } = agencyClient();
  try {
    await withRetry("agency.patch", () =>
      calendar.events.patch({
        calendarId,
        eventId,
        requestBody: toGoogleEvent(payload),
      }),
    );
    return eventId;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      // 404 → event deleted upstream, re-create.
      return createAgencyGoogleEvent(payload, stableKey);
    }
    throw err;
  }
}

export async function deleteAgencyGoogleEvent(eventId: string): Promise<void> {
  const { calendar, calendarId } = agencyClient();
  try {
    await withRetry("agency.delete", () => calendar.events.delete({ calendarId, eventId }));
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
  stableKey: string,
): Promise<string> {
  const requestId = await deterministicGoogleEventId(`personal:${account.id}:${stableKey}`);
  try {
    const res = await withRetry("personal.insert", () =>
      personalClient(account).events.insert({
        calendarId: "primary",
        requestBody: { ...toGoogleEvent(payload), id: requestId },
      }),
    );
    return res.data.id ?? requestId;
  } catch (err: unknown) {
    if (isConflict(err)) return requestId;
    throw err;
  }
}

export async function updatePersonalGoogleEvent(
  account: CalendarAccount,
  eventId: string,
  payload: EventPayload,
  stableKey: string,
): Promise<string> {
  const calendar = personalClient(account);
  try {
    await withRetry("personal.patch", () =>
      calendar.events.patch({
        calendarId: "primary",
        eventId,
        requestBody: toGoogleEvent(payload),
      }),
    );
    return eventId;
  } catch (err: unknown) {
    if (isNotFound(err)) {
      return createPersonalGoogleEvent(account, payload, stableKey);
    }
    throw err;
  }
}

export async function deletePersonalGoogleEvent(
  account: CalendarAccount,
  eventId: string,
): Promise<void> {
  try {
    await withRetry("personal.delete", () =>
      personalClient(account).events.delete({ calendarId: "primary", eventId }),
    );
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
function isConflict(err: unknown): boolean {
  return hasCode(err, 409);
}
function hasCode(err: unknown, code: number): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown };
  return e.code === code || e.status === code;
}
