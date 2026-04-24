import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { isOutlookConfigured } from "@/lib/calendar/config";
import { encryptToken } from "@/lib/calendar/crypto";
import { redeemOutlookAuthCode, OUTLOOK_SCOPES } from "@/lib/calendar/outlook";
import {
  readAndClearStateCookie,
  settingsRedirectFor,
  verifyState,
} from "@/lib/calendar/oauth";

export async function GET(req: NextRequest): Promise<Response> {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    return new Response("Calendar connection is limited to admin and staff.", { status: 403 });
  }
  if (!isOutlookConfigured()) {
    return new Response("Outlook OAuth is not configured.", { status: 501 });
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

  let result;
  try {
    result = await redeemOutlookAuthCode(code);
  } catch (err) {
    console.error("[calendar] outlook code exchange failed:", err);
    return NextResponse.redirect(
      settingsRedirectFor("outlook", { error: "exchange_failed" }),
    );
  }

  await prisma.calendarAccount.upsert({
    where: { userId_provider: { userId: session.user.id, provider: "outlook" } },
    create: {
      userId: session.user.id,
      provider: "outlook",
      providerAccountEmail: result.email,
      msalCacheCipher: encryptToken(result.cacheBlob),
      scope: result.scope || OUTLOOK_SCOPES.join(" "),
      expiresAt: result.expiresAt,
    },
    update: {
      providerAccountEmail: result.email,
      msalCacheCipher: encryptToken(result.cacheBlob),
      scope: result.scope || OUTLOOK_SCOPES.join(" "),
      expiresAt: result.expiresAt,
      disconnectedAt: null,
    },
  });

  return NextResponse.redirect(settingsRedirectFor("outlook", { connected: "1" }));
}
