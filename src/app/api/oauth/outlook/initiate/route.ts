import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import { isOutlookConfigured } from "@/lib/calendar/config";
import { buildOutlookAuthUrl } from "@/lib/calendar/outlook";
import { buildState, setStateCookie } from "@/lib/calendar/oauth";

// v1 parity: Platform gates calendar OAuth to admin+medewerker. v2 keeps
// the same narrow surface — realtors and freelancers don't connect their
// own calendar here. See comment on Google initiate route for rationale.
export async function GET(): Promise<Response> {
  const session = await requireSession();
  if (!hasRole(session, "admin", "staff")) {
    return new Response("Calendar connection is limited to admin and staff.", { status: 403 });
  }
  if (!isOutlookConfigured()) {
    return new Response("Outlook OAuth is not configured.", { status: 501 });
  }
  const state = buildState(session.user.id);
  await setStateCookie(state);
  const url = await buildOutlookAuthUrl(state);
  redirect(url);
}
