"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { eventsForRole } from "@/lib/email-events";
import { role as roleOf } from "@/lib/permissions";
import type { SessionWithUser } from "@/lib/auth";
import { withSession, type ActionResult } from "./_types";

/**
 * Persist the user's email-notification opt-outs.
 *
 * The form only renders toggles for the viewer's role (via eventsForRole).
 * On save we write those role-visible keys AND preserve whatever's already
 * stored for other keys — otherwise saving as a freelancer would silently
 * opt the user out of every realtor-only event if they ever get promoted.
 */
/** Session-accepting body — exported for Vitest tests. */
export async function updateNotificationPrefsInner(
  session: SessionWithUser,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const roleKeys = eventsForRole(roleOf(session));

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailPrefs: true },
  });
  // Postgres JSONB column: Prisma returns the already-parsed value as
  // `Prisma.JsonValue`. Object → use as-is; string (legacy/seeded) → try
  // parse; anything else (including corrupt JSON) → start fresh with {}.
  let merged: Record<string, boolean> = {};
  const raw = user?.emailPrefs;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    merged = raw as Record<string, boolean>;
  } else if (typeof raw === "string") {
    try {
      merged = JSON.parse(raw) as Record<string, boolean>;
    } catch {
      merged = {};
    }
  }

  // Only overwrite keys the user actually saw on the form. Everything else
  // (including future additions + other-role events) stays as-is.
  for (const key of roleKeys) {
    merged[key] = !!formData.get(key);
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailPrefs: merged },
  });

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
}

export const updateNotificationPrefs = withSession(updateNotificationPrefsInner);
