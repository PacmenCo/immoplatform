"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { canManageRevenueAdjustments } from "@/lib/permissions";
import { withSession, type ActionResult } from "./_types";

/**
 * Manual revenue adjustments on the financial overview. Admin/staff only.
 * Stored as signed integer cents so deductions are first-class (negative
 * values); the overview folds them into team revenue + monthly totals.
 */

const createSchema = z.object({
  teamId: z.string().min(1, "Pick a team."),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  description: z
    .string()
    .trim()
    .min(1, "Description is required.")
    .max(500, "Keep the description under 500 characters."),
  // Accept euros as a decimal string and convert to cents. Sign preserved.
  amountEuros: z
    .string()
    .trim()
    .min(1, "Amount is required.")
    .regex(/^-?\d+([.,]\d{1,2})?$/, "Use a number like 125 or -50.00."),
});

export type CreateRevenueAdjustmentInput = z.input<typeof createSchema>;

/**
 * Session-accepting body of `createRevenueAdjustment`. Exported for tests.
 */
export async function createRevenueAdjustmentInner(
  session: SessionWithUser,
  input: CreateRevenueAdjustmentInput,
): Promise<ActionResult<{ id: string }>> {
  if (!canManageRevenueAdjustments(session)) {
    return { ok: false, error: "Only admins can add revenue adjustments." };
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const team = await prisma.team.findUnique({
    where: { id: parsed.data.teamId },
    select: { id: true, name: true },
  });
  if (!team) return { ok: false, error: "Team not found." };

  const normalized = parsed.data.amountEuros.replace(",", ".");
  const amountCents = Math.round(Number.parseFloat(normalized) * 100);
  if (!Number.isFinite(amountCents) || amountCents === 0) {
    return { ok: false, error: "Amount must be a non-zero number." };
  }

  const row = await prisma.revenueAdjustment.create({
    data: {
      teamId: parsed.data.teamId,
      year: parsed.data.year,
      month: parsed.data.month,
      description: parsed.data.description,
      amountCents,
      createdById: session.user.id,
    },
    select: { id: true },
  });

  await audit({
    actorId: session.user.id,
    verb: "revenue_adjustment.created",
    objectType: "revenue_adjustment",
    objectId: row.id,
    metadata: {
      teamId: parsed.data.teamId,
      teamName: team.name,
      year: parsed.data.year,
      month: parsed.data.month,
      amountCents,
    },
  });

  revalidatePath("/dashboard/overview");
  return { ok: true, data: { id: row.id } };
}

export const createRevenueAdjustment = withSession(createRevenueAdjustmentInner);

/**
 * Session-accepting body of `deleteRevenueAdjustment`. Exported for tests.
 */
export async function deleteRevenueAdjustmentInner(
  session: SessionWithUser,
  id: string,
): Promise<ActionResult> {
  if (!canManageRevenueAdjustments(session)) {
    return { ok: false, error: "Only admins can remove revenue adjustments." };
  }
  const existing = await prisma.revenueAdjustment.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      year: true,
      month: true,
      amountCents: true,
      description: true,
    },
  });
  if (!existing) return { ok: false, error: "Adjustment not found." };

  await prisma.revenueAdjustment.delete({ where: { id } });

  await audit({
    actorId: session.user.id,
    verb: "revenue_adjustment.deleted",
    objectType: "revenue_adjustment",
    objectId: id,
    metadata: {
      teamId: existing.teamId,
      year: existing.year,
      month: existing.month,
      amountCents: existing.amountCents,
      description: existing.description,
    },
  });

  revalidatePath("/dashboard/overview");
  return { ok: true };
}

export const deleteRevenueAdjustment = withSession(deleteRevenueAdjustmentInner);
