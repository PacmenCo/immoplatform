"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { EMAIL_EVENTS, type EmailEventKey } from "@/lib/email-events";
import { withSession, type ActionResult } from "./_types";

const VALID_KEYS = Object.keys(EMAIL_EVENTS) as EmailEventKey[];

const prefsSchema = z.record(
  z.string(),
  z.union([z.literal("on"), z.literal("off")]),
);

/**
 * Persist the user's email-notification opt-outs. Form submits a checkbox
 * per event; absent checkbox = off (opted out). We write the inverse:
 * `{ eventKey: false }` for disabled entries, merged with any unknown keys
 * we leave alone so future events don't get silently reset.
 */
export const updateNotificationPrefs = withSession(async (
  session,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  const raw: Record<string, "on" | "off"> = {};
  for (const key of VALID_KEYS) {
    raw[key] = formData.get(key) ? "on" : "off";
  }
  const parsed = prefsSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Something was off with the form. Try again." };
  }

  // Start from whatever's already stored so we preserve keys we don't render
  // yet (forward-compat if a new event is added after the user's last save).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailPrefs: true },
  });
  let merged: Record<string, boolean> = {};
  if (user?.emailPrefs) {
    try {
      merged = JSON.parse(user.emailPrefs) as Record<string, boolean>;
    } catch {
      merged = {};
    }
  }
  for (const key of VALID_KEYS) {
    merged[key] = parsed.data[key] === "on";
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailPrefs: JSON.stringify(merged) },
  });

  revalidatePath("/dashboard/settings/notifications");
  return { ok: true };
});
