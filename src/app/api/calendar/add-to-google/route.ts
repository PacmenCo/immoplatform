import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { canViewAssignment, hasRole } from "@/lib/permissions";
import { buildEventPayload } from "@/lib/calendar/payload";
import { createPersonalGoogleEvent } from "@/lib/calendar/google";
import { requireAppUrl } from "@/lib/calendar/config";

/**
 * One-click "Add to my Google calendar" from an assignment email. Lands
 * here with `?a=<assignmentId>`; admin/staff session that has connected
 * their personal Google account. On success, redirects to the assignment
 * detail page with a success flash.
 *
 * If the user isn't connected yet, we bounce them to the integration
 * settings page with a note about reconnecting, then they can come back
 * via the email link.
 */
export async function GET(req: NextRequest): Promise<Response> {
  const session = await requireSession();
  // Defense-in-depth: mirror the OAuth initiate gate. Today only admin/staff
  // can hold a CalendarAccount row (the OAuth callback enforces it), but if
  // that ever loosens this route would otherwise let any authenticated user
  // push an arbitrary assignment's address/contacts into their personal
  // Google calendar by guessing the id.
  if (!hasRole(session, "admin", "staff")) {
    return new Response("Calendar connection is limited to admin and staff.", { status: 403 });
  }
  const url = new URL(req.url);
  const appUrl = requireAppUrl();
  const assignmentId = url.searchParams.get("a");
  if (!assignmentId) {
    return new Response("Missing assignment id.", { status: 400 });
  }

  const account = await prisma.calendarAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "google" } },
  });
  if (!account || account.disconnectedAt) {
    // Redirect to settings with a banner. The "then" param is a hint for
    // the user what to do after connecting (settings page renders a CTA
    // to click the email link again).
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings/integrations/google-calendar?need-connect=1&then=${encodeURIComponent(
        assignmentId,
      )}`,
    );
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { team: { select: { name: true, legalName: true } } },
  });
  if (!assignment) {
    return new Response("Assignment not found.", { status: 404 });
  }
  // Mirrors getAssignmentFileDownloadUrlInner — same 404 copy on both
  // missing-row and unauthorised so the route can't be used as an existence
  // oracle for assignment ids that belong to other tenants.
  if (!(await canViewAssignment(session, assignment))) {
    return new Response("Assignment not found.", { status: 404 });
  }

  const payload = buildEventPayload({ assignment, team: assignment.team });
  if (!payload) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/assignments/${assignmentId}?calendar-error=no-date`,
    );
  }

  // Idempotent — short-circuit if the viewer already has a personal event.
  const existing = await prisma.assignmentCalendarEvent.findUnique({
    where: {
      assignmentId_calendarAccountId: {
        assignmentId,
        calendarAccountId: account.id,
      },
    },
  });
  if (existing) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/assignments/${assignmentId}?calendar-added=already`,
    );
  }

  let providerEventId: string;
  try {
    providerEventId = await createPersonalGoogleEvent(account, payload, assignmentId);
  } catch (err) {
    console.error("[calendar] add-to-google route failed:", err);
    return NextResponse.redirect(
      `${appUrl}/dashboard/assignments/${assignmentId}?calendar-error=1`,
    );
  }

  await prisma.assignmentCalendarEvent.create({
    data: {
      assignmentId,
      calendarAccountId: account.id,
      providerEventId,
    },
  });

  return NextResponse.redirect(
    `${appUrl}/dashboard/assignments/${assignmentId}?calendar-added=1`,
  );
}
