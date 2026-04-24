import { google } from "googleapis";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { encryptToken } from "@/lib/calendar/crypto";
import {
  readAndClearStateCookie,
  redirectUriFor,
  settingsRedirectFor,
  verifyState,
} from "@/lib/calendar/oauth";
import { isGooglePersonalConfigured } from "@/lib/calendar/config";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    return new Response("Calendar connection is limited to admin and staff.", { status: 403 });
  }
  if (!isGooglePersonalConfigured()) {
    return new Response("Personal Google OAuth is not configured.", { status: 501 });
  }

  const cookie = await readAndClearStateCookie();
  const state = req.nextUrl.searchParams.get("state");
  const verified = verifyState(cookie ?? null);
  if (!verified || !state || state !== cookie || verified.userId !== session.user.id) {
    return new Response("State mismatch.", { status: 400 });
  }

  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return new Response("Missing authorization code.", { status: 400 });
  }

  const oauth2 = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirectUri: redirectUriFor("google"),
  });

  let tokens;
  try {
    const r = await oauth2.getToken(code);
    tokens = r.tokens;
  } catch (err) {
    console.error("[calendar] google code exchange failed:", err);
    return NextResponse.redirect(
      settingsRedirectFor("google", { error: "exchange_failed" }),
    );
  }

  if (!tokens.access_token) {
    return NextResponse.redirect(
      settingsRedirectFor("google", { error: "no_token" }),
    );
  }
  oauth2.setCredentials(tokens);

  let email: string | null = null;
  try {
    const info = await oauth2.getTokenInfo(tokens.access_token);
    email = info.email ?? null;
  } catch (err) {
    console.error("[calendar] google tokeninfo failed:", err);
  }
  if (!email) {
    return NextResponse.redirect(
      settingsRedirectFor("google", { error: "no_email" }),
    );
  }

  await prisma.calendarAccount.upsert({
    where: { userId_provider: { userId: session.user.id, provider: "google" } },
    create: {
      userId: session.user.id,
      provider: "google",
      providerAccountEmail: email,
      accessTokenCipher: encryptToken(tokens.access_token),
      refreshTokenCipher: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: (tokens.scope ?? "").toString(),
    },
    update: {
      providerAccountEmail: email,
      accessTokenCipher: encryptToken(tokens.access_token),
      // Google only returns a refresh token when `prompt=consent` was used,
      // which we do — but be defensive and only overwrite when present.
      ...(tokens.refresh_token
        ? { refreshTokenCipher: encryptToken(tokens.refresh_token) }
        : {}),
      expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: (tokens.scope ?? "").toString(),
      disconnectedAt: null,
    },
  });

  return NextResponse.redirect(settingsRedirectFor("google", { connected: "1" }));
}
