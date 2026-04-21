import "server-only";
import { randomUUID } from "node:crypto";
import {
  ConfidentialClientApplication,
  type AccountInfo,
  type Configuration,
} from "@azure/msal-node";
import { Client } from "@microsoft/microsoft-graph-client";
import type { CalendarAccount } from "@prisma/client";
import { prisma } from "../db";
import { isOutlookConfigured } from "./config";
import { decryptToken, encryptToken } from "./crypto";
import { redirectUriFor } from "./oauth";
import type { EventPayload } from "./types";

/**
 * Outlook / Microsoft 365 calendar sync via direct Graph calls. No n8n.
 *
 * MSAL owns the OAuth2 dance and token cache. We persist the MSAL token
 * cache (serialized JSON blob, encrypted) per `CalendarAccount` and
 * rehydrate it on each sync. `acquireTokenSilent` transparently refreshes
 * when the access token is near expiry.
 */

export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Calendars.ReadWrite",
];

/** Minutes to shift IANA → naive-local for Graph. */
const PREFERRED_TIMEZONE_HEADER = 'outlook.timezone="Europe/Brussels"';

// ─── MSAL client ───────────────────────────────────────────────────

function msalConfig(): Configuration {
  if (!isOutlookConfigured()) {
    throw new Error("Outlook is not configured.");
  }
  const tenant = process.env.OUTLOOK_OAUTH_TENANT ?? "common";
  return {
    auth: {
      clientId: process.env.OUTLOOK_OAUTH_CLIENT_ID!,
      clientSecret: process.env.OUTLOOK_OAUTH_CLIENT_SECRET!,
      authority: `https://login.microsoftonline.com/${tenant}`,
    },
  };
}

function getOutlookCca(): ConfidentialClientApplication {
  return new ConfidentialClientApplication(msalConfig());
}

/** Produce the consent URL for the initiate route. */
export async function buildOutlookAuthUrl(state: string): Promise<string> {
  const cca = getOutlookCca();
  return cca.getAuthCodeUrl({
    scopes: OUTLOOK_SCOPES,
    redirectUri: redirectUriFor("outlook"),
    state,
    prompt: "select_account",
  });
}

/**
 * Exchange an auth-code for tokens. Returns the data the callback route
 * needs to upsert a CalendarAccount (email + serialized MSAL cache blob).
 */
export async function redeemOutlookAuthCode(code: string): Promise<{
  email: string;
  cacheBlob: string;
  scope: string;
  expiresAt: Date | null;
}> {
  const cca = getOutlookCca();
  const result = await cca.acquireTokenByCode({
    code,
    scopes: OUTLOOK_SCOPES,
    redirectUri: redirectUriFor("outlook"),
  });
  const email = result.account?.username;
  if (!email) throw new Error("MSAL didn't return an account email.");
  // Serialize after the grant so the refresh token lands in the blob.
  const cacheBlob = await cca.getTokenCache().serialize();
  return {
    email,
    cacheBlob,
    scope: (result.scopes ?? OUTLOOK_SCOPES).join(" "),
    expiresAt: result.expiresOn ?? null,
  };
}

// ─── Token handling per account ────────────────────────────────────

type LiveOutlookContext = {
  accessToken: string;
  rehydratedCca: ConfidentialClientApplication;
  account: AccountInfo;
};

/**
 * Serialize cache rehydrate + refresh + persist per-account so two
 * concurrent syncs on the same CalendarAccount don't race on the blob.
 * In-process only — acceptable because AAD's rotated refresh tokens stay
 * valid for an overlap window, so cross-process races resolve to "last
 * write wins" without breaking auth.
 */
const outlookCacheLocks = new Map<string, Promise<unknown>>();

async function acquireOutlookAccessToken(
  account: CalendarAccount,
): Promise<LiveOutlookContext> {
  const prior = outlookCacheLocks.get(account.id);
  const run = (prior ?? Promise.resolve()).then(() => doAcquireOutlookToken(account));
  outlookCacheLocks.set(account.id, run);
  try {
    return await run;
  } finally {
    if (outlookCacheLocks.get(account.id) === run) {
      outlookCacheLocks.delete(account.id);
    }
  }
}

async function doAcquireOutlookToken(account: CalendarAccount): Promise<LiveOutlookContext> {
  if (account.provider !== "outlook") {
    throw new Error(`Expected provider=outlook, got ${account.provider}.`);
  }
  if (!account.msalCacheCipher) {
    throw new Error(`CalendarAccount ${account.id} has no MSAL cache.`);
  }
  const cca = getOutlookCca();
  const blob = decryptToken(account.msalCacheCipher);
  await cca.getTokenCache().deserialize(blob);

  const accounts = await cca.getTokenCache().getAllAccounts();
  const match =
    accounts.find((a) => a.username.toLowerCase() === account.providerAccountEmail.toLowerCase()) ??
    accounts[0];
  if (!match) {
    throw new Error(`MSAL cache for ${account.id} has no accounts.`);
  }

  const silent = await cca.acquireTokenSilent({
    account: match,
    scopes: OUTLOOK_SCOPES.filter((s) => s !== "openid" && s !== "profile"),
  });

  // MSAL returns `null` rather than throwing when the cache has no usable
  // refresh token — treat that as a hard auth failure, not a silent bearer
  // of "" token that Graph would then 401 on.
  if (!silent || !silent.accessToken) {
    await markDisconnected(account.id);
    throw new Error(
      `MSAL returned no access token for CalendarAccount ${account.id} ` +
        `(${account.providerAccountEmail}) — refresh token likely expired or revoked. ` +
        `Marked disconnected; user needs to Reconnect from Settings → Integrations.`,
    );
  }

  const post = await cca.getTokenCache().serialize();
  if (post !== blob) {
    await persistOutlookCache(account.id, post);
  }

  return {
    accessToken: silent.accessToken,
    rehydratedCca: cca,
    account: match,
  };
}

async function persistOutlookCache(accountId: string, blob: string): Promise<void> {
  await prisma.calendarAccount
    .update({
      where: { id: accountId },
      data: { msalCacheCipher: encryptToken(blob) },
    })
    .catch((e) => console.error(`[calendar] persist outlook cache ${accountId}:`, e));
}

async function markDisconnected(accountId: string): Promise<void> {
  await prisma.calendarAccount
    .update({ where: { id: accountId }, data: { disconnectedAt: new Date() } })
    .catch((e) => console.error(`[calendar] mark disconnected ${accountId}:`, e));
}

// ─── Graph client ──────────────────────────────────────────────────

async function graphClient(account: CalendarAccount): Promise<Client> {
  const { accessToken } = await acquireOutlookAccessToken(account);
  return Client.init({
    authProvider: (done) => done(null, accessToken),
    defaultVersion: "v1.0",
  });
}

function toGraphEvent(payload: EventPayload): Record<string, unknown> {
  // MS Graph accepts IANA zone names when we set the Prefer header below.
  return {
    subject: payload.title,
    body: { contentType: "HTML", content: payload.descriptionHtml },
    location: { displayName: payload.location },
    start: { dateTime: isoNoTz(payload.start), timeZone: payload.timeZone },
    end: { dateTime: isoNoTz(payload.end), timeZone: payload.timeZone },
    isReminderOn: true,
    reminderMinutesBeforeStart: payload.reminderMinutes,
  };
}

/** Graph wants `YYYY-MM-DDTHH:MM:SS` (no trailing Z) paired with `timeZone`. */
function isoNoTz(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "");
}

export async function createOutlookEvent(
  account: CalendarAccount,
  payload: EventPayload,
): Promise<string> {
  try {
    const client = await graphClient(account);
    const res = await client
      .api("/me/events")
      .header("Prefer", PREFERRED_TIMEZONE_HEADER)
      .post({ ...toGraphEvent(payload), transactionId: randomUUID() });
    const id = (res as { id?: string }).id;
    if (!id) throw new Error("Graph create event returned no id.");
    return id;
  } catch (err) {
    if (isAuthBroken(err)) {
      await markDisconnected(account.id);
    }
    throw err;
  }
}

export async function updateOutlookEvent(
  account: CalendarAccount,
  eventId: string,
  payload: EventPayload,
): Promise<string> {
  try {
    const client = await graphClient(account);
    await client
      .api(`/me/events/${encodeURIComponent(eventId)}`)
      .header("Prefer", PREFERRED_TIMEZONE_HEADER)
      .patch(toGraphEvent(payload));
    return eventId;
  } catch (err) {
    if (isNotFound(err)) {
      return createOutlookEvent(account, payload);
    }
    if (isAuthBroken(err)) {
      await markDisconnected(account.id);
    }
    throw err;
  }
}

export async function deleteOutlookEvent(
  account: CalendarAccount,
  eventId: string,
): Promise<void> {
  try {
    const client = await graphClient(account);
    await client.api(`/me/events/${encodeURIComponent(eventId)}`).delete();
  } catch (err) {
    if (isNotFound(err)) return;
    if (isAuthBroken(err)) {
      await markDisconnected(account.id);
      return;
    }
    throw err;
  }
}

export async function revokeOutlook(account: CalendarAccount): Promise<void> {
  // Microsoft doesn't expose a single revoke endpoint for a user refresh
  // token; dropping the MSAL cache + row is effectively the revoke.
  // (Users who want it gone upstream revoke via https://myapps.microsoft.com.)
  void account;
}

// ─── Error classification ──────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  return getStatus(err) === 404;
}

function isAuthBroken(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; errorCode?: unknown; message?: unknown };
  const code = String(e.code ?? e.errorCode ?? "").toLowerCase();
  return (
    code.includes("invalid_grant") ||
    code.includes("interaction_required") ||
    code.includes("invalidauthenticationtoken")
  );
}

function getStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as { statusCode?: unknown; status?: unknown };
  const raw = e.statusCode ?? e.status;
  return typeof raw === "number" ? raw : null;
}
