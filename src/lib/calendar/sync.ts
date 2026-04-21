import "server-only";
import { prisma } from "../db";
import {
  isGoogleAgencyConfigured,
  isGooglePersonalConfigured,
  isOutlookConfigured,
} from "./config";
import {
  createAgencyGoogleEvent,
  deleteAgencyGoogleEvent,
  updateAgencyGoogleEvent,
  deletePersonalGoogleEvent,
  updatePersonalGoogleEvent,
} from "./google";
import {
  createOutlookEvent,
  deleteOutlookEvent,
  updateOutlookEvent,
} from "./outlook";
import { buildEventPayload } from "./payload";
import type { CalendarAction } from "./types";

/**
 * Fan-out orchestrator. Called (best-effort, never throws) from each
 * relevant assignment lifecycle action after the DB commit.
 *
 * Three paths, each independent so one provider failing doesn't abort the
 * other:
 *   - Agency Google (service account, one shared calendar)
 *   - Outlook (creator's personal mailbox, if connected)
 *   - Personal Google (every AssignmentCalendarEvent row belonging to a
 *     user who pressed "Add to my calendar")
 */
export async function syncAssignmentToCalendars(
  assignmentId: string,
  action: CalendarAction,
): Promise<void> {
  try {
    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        team: { select: { name: true, legalName: true } },
        outlookCalendarAccount: true,
        createdBy: {
          include: {
            calendarAccounts: {
              where: { provider: "outlook", disconnectedAt: null },
            },
          },
        },
        personalCalendarEvents: { include: { calendarAccount: true } },
        comments: {
          orderBy: { createdAt: "asc" },
          take: 10,
          select: {
            createdAt: true,
            body: true,
            author: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!assignment) return;

    const payload =
      action === "cancel"
        ? null
        : buildEventPayload({
            assignment,
            team: assignment.team,
          });

    // Create / update both require preferredDate → payload; skip cleanly.
    if (action !== "cancel" && !payload) return;

    await Promise.all([
      syncAgency(assignment, action, payload),
      syncOutlook(assignment, action, payload),
      syncPersonalGoogle(assignment, action, payload),
    ]);
  } catch (err) {
    console.error(`[calendar] sync ${action} ${assignmentId} failed:`, err);
  }
}

// ─── Agency Google ─────────────────────────────────────────────────

async function syncAgency(
  a: { id: string; googleCalendarEventId: string | null },
  action: CalendarAction,
  payload: ReturnType<typeof buildEventPayload>,
): Promise<void> {
  if (!isGoogleAgencyConfigured()) return;
  try {
    if (action === "cancel") {
      if (!a.googleCalendarEventId) return;
      await deleteAgencyGoogleEvent(a.googleCalendarEventId);
      await prisma.assignment.update({
        where: { id: a.id },
        data: { googleCalendarEventId: null },
      });
      return;
    }
    if (!payload) return;
    const id = a.googleCalendarEventId
      ? await updateAgencyGoogleEvent(a.googleCalendarEventId, payload)
      : await createAgencyGoogleEvent(payload);
    if (id !== a.googleCalendarEventId) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: { googleCalendarEventId: id },
      });
    }
  } catch (err) {
    console.error(`[calendar] agency google ${action} ${a.id} failed:`, err);
  }
}

// ─── Outlook (creator's mailbox) ───────────────────────────────────

async function syncOutlook(
  a: {
    id: string;
    outlookCalendarEventId: string | null;
    outlookCalendarAccountId: string | null;
    outlookCalendarAccount: Parameters<typeof updateOutlookEvent>[0] | null;
    createdBy: {
      calendarAccounts: Parameters<typeof updateOutlookEvent>[0][];
    } | null;
  },
  action: CalendarAction,
  payload: ReturnType<typeof buildEventPayload>,
): Promise<void> {
  if (!isOutlookConfigured()) return;
  try {
    if (action === "cancel") {
      if (!a.outlookCalendarEventId || !a.outlookCalendarAccount) return;
      await deleteOutlookEvent(a.outlookCalendarAccount, a.outlookCalendarEventId);
      await prisma.assignment.update({
        where: { id: a.id },
        data: { outlookCalendarEventId: null, outlookCalendarAccountId: null },
      });
      return;
    }
    if (!payload) return;

    const creatorAccount = a.createdBy?.calendarAccounts[0];
    if (!creatorAccount) {
      // Creator hasn't connected Outlook — drop any stale event if the
      // account was disconnected after the last sync.
      return;
    }

    // Creator reconnected with a different email → delete old, create new.
    if (
      a.outlookCalendarEventId &&
      a.outlookCalendarAccount &&
      a.outlookCalendarAccount.id !== creatorAccount.id
    ) {
      await deleteOutlookEvent(a.outlookCalendarAccount, a.outlookCalendarEventId).catch(() => {});
      a.outlookCalendarEventId = null;
    }

    const id = a.outlookCalendarEventId
      ? await updateOutlookEvent(creatorAccount, a.outlookCalendarEventId, payload)
      : await createOutlookEvent(creatorAccount, payload);

    if (id !== a.outlookCalendarEventId || creatorAccount.id !== a.outlookCalendarAccountId) {
      await prisma.assignment.update({
        where: { id: a.id },
        data: {
          outlookCalendarEventId: id,
          outlookCalendarAccountId: creatorAccount.id,
        },
      });
    }
  } catch (err) {
    console.error(`[calendar] outlook ${action} ${a.id} failed:`, err);
  }
}

// ─── Personal Google events (opt-in "Add to my calendar") ──────────

async function syncPersonalGoogle(
  a: {
    id: string;
    personalCalendarEvents: Array<{
      id: string;
      providerEventId: string;
      calendarAccount: Parameters<typeof updatePersonalGoogleEvent>[0];
    }>;
  },
  action: CalendarAction,
  payload: ReturnType<typeof buildEventPayload>,
): Promise<void> {
  if (!isGooglePersonalConfigured()) return;
  if (a.personalCalendarEvents.length === 0) return;

  await Promise.all(
    a.personalCalendarEvents.map(async (row) => {
      try {
        if (row.calendarAccount.disconnectedAt) return;
        if (action === "cancel") {
          await deletePersonalGoogleEvent(row.calendarAccount, row.providerEventId);
          await prisma.assignmentCalendarEvent.delete({ where: { id: row.id } });
          return;
        }
        if (!payload) return;
        const id = await updatePersonalGoogleEvent(
          row.calendarAccount,
          row.providerEventId,
          payload,
        );
        if (id !== row.providerEventId) {
          await prisma.assignmentCalendarEvent.update({
            where: { id: row.id },
            data: { providerEventId: id, lastSyncedAt: new Date() },
          });
        } else {
          await prisma.assignmentCalendarEvent.update({
            where: { id: row.id },
            data: { lastSyncedAt: new Date() },
          });
        }
      } catch (err) {
        console.error(
          `[calendar] personal google ${action} acct=${row.calendarAccount.id} assignment=${a.id} failed:`,
          err,
        );
      }
    }),
  );
}
