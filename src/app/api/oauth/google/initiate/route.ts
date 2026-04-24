import { redirect } from "next/navigation";
import { google } from "googleapis";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { isGooglePersonalConfigured } from "@/lib/calendar/config";
import { buildState, redirectUriFor, setStateCookie } from "@/lib/calendar/oauth";

/**
 * Kick off the personal Google OAuth "Add to my calendar" flow.
 * Agency Google (service account) does not go through here.
 *
 * v1 parity: gated to admin + staff (= Platform's admin + medewerker per
 * routes/web.php:67-74). Realtors and freelancers do not get personal
 * calendar OAuth in v1.
 */
export async function GET(): Promise<Response> {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    return new Response("Calendar connection is limited to admin and staff.", { status: 403 });
  }
  if (!isGooglePersonalConfigured()) {
    return new Response("Personal Google OAuth is not configured.", { status: 501 });
  }
  const state = buildState(session.user.id);
  await setStateCookie(state);

  const oauth2 = new google.auth.OAuth2({
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirectUri: redirectUriFor("google"),
  });
  const url = oauth2.generateAuthUrl({
    access_type: "offline",      // needed to get a refresh token
    prompt: "consent",           // force refresh token on every grant
    include_granted_scopes: true,
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar.events",
    ],
    state,
  });
  redirect(url);
}
