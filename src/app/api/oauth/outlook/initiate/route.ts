import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { isOutlookConfigured } from "@/lib/calendar/config";
import { buildOutlookAuthUrl } from "@/lib/calendar/outlook";
import { buildState, setStateCookie } from "@/lib/calendar/oauth";

export async function GET(): Promise<Response> {
  const session = await requireSession();
  if (!isOutlookConfigured()) {
    return new Response("Outlook OAuth is not configured.", { status: 501 });
  }
  const state = buildState(session.user.id);
  await setStateCookie(state);
  const url = await buildOutlookAuthUrl(state);
  redirect(url);
}
