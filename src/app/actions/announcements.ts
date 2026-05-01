"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { canManageAnnouncements } from "@/lib/permissions";
import { ANNOUNCEMENT_TYPES } from "@/lib/announcementTypes";
import { withSession, type ActionResult } from "./_types";

/**
 * Platform-wide banner messages. Admin/staff author them; every logged-in
 * user can view active ones and dismiss them per-user.
 *
 * Dates arrive as `YYYY-MM-DD` from <input type="date"> and are normalised
 * to start-of-day / end-of-day UTC so a same-day window covers the full 24 h.
 */

const announcementSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Keep the title under 200 characters."),
  body: z
    .string()
    .trim()
    .min(1, "Body is required.")
    .max(2000, "Keep the body under 2000 characters."),
  type: z.enum(ANNOUNCEMENT_TYPES),
  startsAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD."),
  endsAt: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD."),
  isActive: z.boolean(),
  isDismissible: z.boolean(),
});

function readAnnouncementFormData(formData: FormData) {
  // Unchecked checkboxes are absent from the payload entirely, so treat any
  // non-empty string as true — matches <input type="checkbox" name="…">.
  return {
    title: (formData.get("title") ?? "").toString(),
    body: (formData.get("body") ?? "").toString(),
    type: (formData.get("type") ?? "info").toString(),
    startsAt: (formData.get("startsAt") ?? "").toString(),
    endsAt: (formData.get("endsAt") ?? "").toString(),
    isActive: formData.get("isActive") != null,
    isDismissible: formData.get("isDismissible") != null,
  };
}

type ParsedDates =
  | { ok: true; start: Date; end: Date }
  | { ok: false; error: string };

function parseDates(startsAt: string, endsAt: string): ParsedDates {
  const start = new Date(`${startsAt}T00:00:00.000Z`);
  const end = new Date(`${endsAt}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "errors.validation.invalidDate" };
  }
  if (end < start) {
    return { ok: false, error: "errors.announcement.endBeforeStart" };
  }
  return { ok: true, start, end };
}

// ─── Create ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `createAnnouncement`. Exported for Vitest tests;
 * returns the new announcement id on success, the wrapped form redirects.
 */
export async function createAnnouncementInner(
  session: SessionWithUser,
  _prev: ActionResult<{ id: string }> | undefined,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  if (!canManageAnnouncements(session)) {
    return { ok: false, error: "errors.announcement.publishAdminsOnly" };
  }
  const parsed = announcementSchema.safeParse(readAnnouncementFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "errors.validation.invalidInput" };
  }
  const dates = parseDates(parsed.data.startsAt, parsed.data.endsAt);
  if (!dates.ok) return { ok: false, error: dates.error };

  const row = await prisma.announcement.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      isActive: parsed.data.isActive,
      isDismissible: parsed.data.isDismissible,
      startsAt: dates.start,
      endsAt: dates.end,
      createdById: session.user.id,
    },
    select: { id: true, title: true },
  });

  await audit({
    actorId: session.user.id,
    verb: "announcement.created",
    objectType: "announcement",
    objectId: row.id,
    metadata: { title: row.title, type: parsed.data.type },
  });

  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: row.id } };
}

export const createAnnouncement = withSession(async (
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await createAnnouncementInner(session, undefined, formData);
  if (result.ok && result.data) redirect(`/dashboard/announcements/${result.data.id}`);
  if (result.ok) return { ok: true };
  return result;
});

// ─── Update ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `updateAnnouncement`. Exported for tests.
 */
export async function updateAnnouncementInner(
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  if (!canManageAnnouncements(session)) {
    return { ok: false, error: "errors.announcement.editAdminsOnly" };
  }
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "errors.announcement.notFound" };

  const parsed = announcementSchema.safeParse(readAnnouncementFormData(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "errors.validation.invalidInput" };
  }
  const dates = parseDates(parsed.data.startsAt, parsed.data.endsAt);
  if (!dates.ok) return { ok: false, error: dates.error };

  await prisma.announcement.update({
    where: { id },
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      isActive: parsed.data.isActive,
      isDismissible: parsed.data.isDismissible,
      startsAt: dates.start,
      endsAt: dates.end,
    },
  });

  await audit({
    actorId: session.user.id,
    verb: "announcement.updated",
    objectType: "announcement",
    objectId: id,
    metadata: { title: parsed.data.title, type: parsed.data.type },
  });

  revalidatePath("/dashboard/announcements");
  revalidatePath(`/dashboard/announcements/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export const updateAnnouncement = withSession(async (
  session: SessionWithUser,
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const result = await updateAnnouncementInner(session, id, _prev, formData);
  if (result.ok) redirect(`/dashboard/announcements/${id}`);
  return result;
});

// ─── Delete ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `deleteAnnouncement`. Exported for tests.
 */
export async function deleteAnnouncementInner(
  session: SessionWithUser,
  id: string,
): Promise<ActionResult> {
  if (!canManageAnnouncements(session)) {
    return { ok: false, error: "errors.announcement.deleteAdminsOnly" };
  }
  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!existing) return { ok: false, error: "errors.announcement.notFound" };

  await prisma.announcement.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    verb: "announcement.deleted",
    objectType: "announcement",
    objectId: id,
    metadata: { title: existing.title },
  });

  revalidatePath("/dashboard/announcements");
  revalidatePath("/dashboard");
  return { ok: true };
}

export const deleteAnnouncement = withSession(deleteAnnouncementInner);

// ─── Dismiss (per-user) ────────────────────────────────────────────

/**
 * Dismiss an announcement for the current user only. Any logged-in user
 * may call this. Idempotent — calling twice returns the existing row.
 * The announcement itself is untouched; other users still see it.
 */
/**
 * Session-accepting body of `dismissAnnouncement`. Exported for tests.
 */
export async function dismissAnnouncementInner(
  session: SessionWithUser,
  id: string,
): Promise<ActionResult> {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true, isDismissible: true },
  });
  if (!announcement) return { ok: false, error: "errors.announcement.notFound" };
  if (!announcement.isDismissible) {
    return { ok: false, error: "errors.announcement.cannotDismiss" };
  }

  await prisma.announcementDismissal.upsert({
    where: { announcementId_userId: { announcementId: id, userId: session.user.id } },
    create: { announcementId: id, userId: session.user.id },
    update: {},
  });

  await audit({
    actorId: session.user.id,
    verb: "announcement.dismissed",
    objectType: "announcement",
    objectId: id,
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

export const dismissAnnouncement = withSession(dismissAnnouncementInner);
