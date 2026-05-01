"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { canMarkCommissionPaid } from "@/lib/permissions";
import { quarterRange } from "@/lib/commission";
import { withSession, type ActionResult } from "./_types";

type QuarterInput = {
  teamId: string;
  year: number;
  quarter: number;
};

function validateQuarter(q: QuarterInput): string | null {
  if (!q.teamId) return "errors.commission.missingTeam";
  if (!Number.isInteger(q.year) || q.year < 2020 || q.year > 2100) return "errors.commission.invalidYear";
  if (!Number.isInteger(q.quarter) || q.quarter < 1 || q.quarter > 4) return "errors.commission.invalidQuarter";
  return null;
}

/**
 * Mark a team's quarterly commission accrual as paid. Recomputes the
 * quarter's total at write time so the payout row reflects the amount
 * admin actually paid out — even if commission lines change later.
 *
 * Idempotent per (team, year, quarter) — upsert on the unique constraint.
 */
/**
 * Session-accepting body of `markCommissionQuarterPaid`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Consumers should use the `withSession`-wrapped form below.
 */
export async function markCommissionQuarterPaidInner(
  session: SessionWithUser,
  input: QuarterInput,
): Promise<ActionResult> {
  if (!canMarkCommissionPaid(session)) {
    return { ok: false, error: "errors.commission.markAdminsOnly" };
  }
  const invalid = validateQuarter(input);
  if (invalid) return { ok: false, error: invalid };

  const team = await prisma.team.findUnique({
    where: { id: input.teamId },
    select: { id: true, name: true },
  });
  if (!team) return { ok: false, error: "errors.team.notFound" };

  const { gte, lt } = quarterRange(input.year, input.quarter);
  const sum = await prisma.assignmentCommission.aggregate({
    where: { teamId: input.teamId, computedAt: { gte, lt } },
    _sum: { commissionAmountCents: true },
  });
  const amountCents = sum._sum.commissionAmountCents ?? 0;

  // Block "paid zero" when there's nothing accrued and nothing already on
  // record — the button would otherwise silently flip state for a team
  // that hasn't earned anything this quarter. Re-marking an existing paid
  // row is allowed (that's an intentional refresh).
  if (amountCents === 0) {
    const existing = await prisma.commissionPayout.findUnique({
      where: {
        teamId_year_quarter: {
          teamId: input.teamId,
          year: input.year,
          quarter: input.quarter,
        },
      },
      select: { id: true },
    });
    if (!existing) {
      return {
        ok: false,
        error: "errors.commission.nothingToMarkPaid",
      };
    }
  }

  // Detect whether this is a fresh mark-paid or a no-op re-click. Skip
  // the audit on no-op so a rapid double-click doesn't write two
  // commission.quarter_paid rows for one effective change. The unique
  // constraint on (teamId, year, quarter) makes the upsert itself
  // idempotent for data state.
  //
  // Read + upsert run inside a transaction so two concurrent re-clicks
  // from the same admin can't BOTH read `existing === null` (or the same
  // pre-write snapshot) and BOTH decide they're the fresh write — a
  // serialization gap that would write two audit rows for one effective
  // change.
  const isNoOpReclick = await prisma.$transaction(async (tx) => {
    const existing = await tx.commissionPayout.findUnique({
      where: {
        teamId_year_quarter: {
          teamId: input.teamId,
          year: input.year,
          quarter: input.quarter,
        },
      },
      select: { amountCents: true, paidById: true },
    });
    const noOp =
      existing !== null &&
      existing.amountCents === amountCents &&
      existing.paidById === session.user.id;
    await tx.commissionPayout.upsert({
      where: {
        teamId_year_quarter: {
          teamId: input.teamId,
          year: input.year,
          quarter: input.quarter,
        },
      },
      create: {
        teamId: input.teamId,
        year: input.year,
        quarter: input.quarter,
        amountCents,
        paidById: session.user.id,
      },
      update: {
        amountCents,
        paidById: session.user.id,
        paidAt: new Date(),
      },
    });
    return noOp;
  });

  if (!isNoOpReclick) {
    await audit({
      actorId: session.user.id,
      verb: "commission.quarter_paid",
      objectType: "team",
      objectId: input.teamId,
      metadata: {
        year: input.year,
        quarter: input.quarter,
        amountCents,
        teamName: team.name,
      },
    });
  }

  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard/overview");
  revalidatePath(`/dashboard/teams/${input.teamId}`);
  return { ok: true };
}

export const markCommissionQuarterPaid = withSession(markCommissionQuarterPaidInner);

/**
 * Session-accepting body of `undoCommissionQuarterPaid`. Exported for test
 * symmetry with `markCommissionQuarterPaidInner`.
 */
export async function undoCommissionQuarterPaidInner(
  session: SessionWithUser,
  input: QuarterInput,
): Promise<ActionResult> {
  if (!canMarkCommissionPaid(session)) {
    return { ok: false, error: "errors.commission.undoAdminsOnly" };
  }
  const invalid = validateQuarter(input);
  if (invalid) return { ok: false, error: invalid };

  // deleteMany so we can detect whether a row actually went away — the
  // audit entry + revalidate only make sense if something changed.
  const deleted = await prisma.commissionPayout.deleteMany({
    where: {
      teamId: input.teamId,
      year: input.year,
      quarter: input.quarter,
    },
  });

  if (deleted.count === 0) {
    return { ok: true };
  }

  await audit({
    actorId: session.user.id,
    verb: "commission.quarter_unpaid",
    objectType: "team",
    objectId: input.teamId,
    metadata: { year: input.year, quarter: input.quarter },
  });

  revalidatePath("/dashboard/commissions");
  revalidatePath("/dashboard/overview");
  revalidatePath(`/dashboard/teams/${input.teamId}`);
  return { ok: true };
}

export const undoCommissionQuarterPaid = withSession(undoCommissionQuarterPaidInner);
