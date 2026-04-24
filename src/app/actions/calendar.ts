"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import { hasRole } from "@/lib/permissions";
import {
  createPersonalGoogleEvent,
  deletePersonalGoogleEvent,
  revokePersonalGoogle,
} from "@/lib/calendar/google";
import { revokeOutlook } from "@/lib/calendar/outlook";
import { buildEventPayload } from "@/lib/calendar/payload";
import type { CalendarProvider } from "@/lib/calendar/types";
import { withSession, type ActionResult } from "./_types";

/**
 * Per-user calendar actions. Three handles:
 * - `addAssignmentToPersonalGoogle(id)` — opt-in "Add to my calendar"
 * - `removeAssignmentFromPersonalGoogle(id)` — remove the single user's copy
 * - `disconnectCalendarAccount(provider)` — revoke + drop the account row
 *
 * v1 parity: Platform gates Google Calendar OAuth to `admin,medewerker`
 * (routes/web.php:67-74); realtors and freelancers cannot personally sync.
 * v2 matches that narrow surface — every action below rejects anyone who
 * isn't admin+staff, mirroring the OAuth initiate/callback route gates.
 */

export const addAssignmentToPersonalGoogle = withSession(async (
  session,
  assignmentId: string,
): Promise<ActionResult<{ eventId: string }>> => {
  if (!hasRole(session, "admin", "staff")) {
    return { ok: false, error: "Calendar connection is limited to admin and staff." };
  }
  const account = await prisma.calendarAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "google" } },
  });
  if (!account || account.disconnectedAt) {
    return {
      ok: false,
      error: "Connect your Google calendar first from Settings → Integrations.",
    };
  }
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { team: { select: { name: true, legalName: true } } },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };

  const payload = buildEventPayload({ assignment, team: assignment.team });
  if (!payload) {
    return { ok: false, error: "This assignment has no scheduled date yet." };
  }

  // Idempotent — if we already added it for this (user, assignment), short-circuit.
  const existing = await prisma.assignmentCalendarEvent.findUnique({
    where: {
      assignmentId_calendarAccountId: {
        assignmentId,
        calendarAccountId: account.id,
      },
    },
  });
  if (existing) return { ok: true, data: { eventId: existing.providerEventId } };

  let providerEventId: string;
  try {
    providerEventId = await createPersonalGoogleEvent(account, payload, assignmentId);
  } catch (err) {
    console.error("[calendar] addAssignmentToPersonalGoogle failed:", err);
    return { ok: false, error: "Couldn't add the event to your calendar. Try reconnecting." };
  }

  await prisma.assignmentCalendarEvent.create({
    data: {
      assignmentId,
      calendarAccountId: account.id,
      providerEventId,
    },
  });

  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { ok: true, data: { eventId: providerEventId } };
});

export const removeAssignmentFromPersonalGoogle = withSession(async (
  session,
  assignmentId: string,
): Promise<ActionResult> => {
  if (!hasRole(session, "admin", "staff")) {
    return { ok: false, error: "Calendar connection is limited to admin and staff." };
  }
  const account = await prisma.calendarAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider: "google" } },
  });
  if (!account) return { ok: true };

  const row = await prisma.assignmentCalendarEvent.findUnique({
    where: {
      assignmentId_calendarAccountId: {
        assignmentId,
        calendarAccountId: account.id,
      },
    },
  });
  if (!row) return { ok: true };

  try {
    await deletePersonalGoogleEvent(account, row.providerEventId);
  } catch (err) {
    console.error("[calendar] remove personal google failed:", err);
  }
  await prisma.assignmentCalendarEvent.delete({ where: { id: row.id } });
  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { ok: true };
});

export const disconnectCalendarAccount = withSession(async (
  session,
  provider: CalendarProvider,
): Promise<ActionResult> => {
  if (!hasRole(session, "admin", "staff")) {
    return { ok: false, error: "Calendar connection is limited to admin and staff." };
  }
  const account = await prisma.calendarAccount.findUnique({
    where: { userId_provider: { userId: session.user.id, provider } },
  });
  if (!account) return { ok: true };

  if (provider === "google") {
    await revokePersonalGoogle(account);
  } else {
    await revokeOutlook(account);
  }

  // Deleting the row cascades AssignmentCalendarEvent for that account.
  await prisma.calendarAccount.delete({ where: { id: account.id } });

  await audit({
    actorId: session.user.id,
    verb: "calendar.disconnected",
    objectType: "calendar_account",
    objectId: account.id,
    metadata: { provider, email: account.providerAccountEmail },
  });

  revalidatePath(`/dashboard/settings/integrations/${provider}-calendar`);
  return { ok: true };
});
