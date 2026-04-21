import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireAppUrl, requireEncryptionKey } from "./config";
import type { CalendarProvider } from "./types";

/**
 * CSRF state cookie + redirect-URI helpers shared between the Google and
 * Outlook OAuth route handlers.
 *
 * State shape: `<userId>.<random>.<expMs>` signed with HMAC-SHA256 using
 * the session secret, base64url-encoded as a single token. Cookie is
 * httpOnly + sameSite=lax + path=/api/oauth + 10-minute TTL.
 */

const COOKIE_NAME = "immo_oauth_state";
const TTL_MS = 10 * 60 * 1000;

function sign(body: string): string {
  // Reuse CALENDAR_ENCRYPTION_KEY for the HMAC secret — it's already
  // required for any calendar OAuth path to work at all.
  return createHmac("sha256", requireEncryptionKey()).update(body).digest("base64url");
}

export function buildState(userId: string): string {
  const body = `${userId}.${randomBytes(16).toString("base64url")}.${Date.now() + TTL_MS}`;
  const sig = sign(body);
  return `${body}.${sig}`;
}

export type VerifiedState = { userId: string; expiresAt: number };

export function verifyState(token: string | undefined | null): VerifiedState | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, random, expRaw, sig] = parts;
  if (!userId || !random || !expRaw || !sig) return null;
  const expiresAt = Number.parseInt(expRaw, 10);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;
  const expected = sign(`${userId}.${random}.${expRaw}`);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { userId, expiresAt };
}

export async function setStateCookie(state: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/oauth",
    maxAge: TTL_MS / 1000,
  });
}

export async function readAndClearStateCookie(): Promise<string | null> {
  const jar = await cookies();
  const v = jar.get(COOKIE_NAME)?.value ?? null;
  if (v) jar.delete(COOKIE_NAME);
  return v;
}

export function redirectUriFor(provider: CalendarProvider): string {
  return `${requireAppUrl()}/api/oauth/${provider}/callback`;
}

export function settingsRedirectFor(provider: CalendarProvider, params?: Record<string, string>): string {
  const suffix = params ? "?" + new URLSearchParams(params).toString() : "";
  return `${requireAppUrl()}/dashboard/settings/integrations/${provider}-calendar${suffix}`;
}
