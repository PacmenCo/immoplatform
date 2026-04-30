"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  audit,
  clearSession,
  createSession,
  getSession,
} from "@/lib/auth";
import { isSwitcherMember } from "@/lib/account-switcher";
import type { ActionResult } from "./_types";

/**
 * Hot-swap the current session into another switcher-group account. This is
 * a *real* logout-and-login between predefined accounts — not impersonation.
 * The session row gets revoked, a fresh row is created for the target user,
 * the cookie is rewritten. Permission gates, scope filters, audit attribution
 * all run as the new user from the next request onward.
 *
 * Hard-gates (in order):
 *   1. Refuses in `NODE_ENV === "production"`. The seed that creates the
 *      `@immo.test` test users has its own production refusal, so prod has
 *      nothing to switch *to* — but defense in depth at the action layer
 *      means even an accidentally-seeded prod row is unreachable.
 *   2. Requires the current session-holder's email to be in SWITCHER_GROUP.
 *   3. Requires the target email to be in SWITCHER_GROUP.
 *   4. Refuses self-targeting (already that user — no-op redirect).
 *   5. Requires the target user row to exist and not be soft-deleted.
 *
 * Audit: writes `user.account_switched` with `actorId` = the *original*
 * (pre-switch) user, plus metadata `{ fromEmail, toEmail }`. Keeps the
 * causal trail readable as a single event instead of a `signed_out` +
 * orphan-`signed_in` pair.
 *
 * Skips `withSession` deliberately — that wrapper requires a session that
 * this action will destroy. Same pattern as `logout` and `resetPassword`
 * in `src/app/actions/auth.ts`.
 */
export async function switchToAccount(
  targetEmail: string,
): Promise<ActionResult> {
  // 1. Production hard-gate. Single source of truth for "this is a dev
  //    tool only." Prefer a positive allowlist over `!== "production"`
  //    so an unset NODE_ENV (rare but possible) fails closed.
  if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") {
    return { ok: false, error: "Account switching is disabled outside of development." };
  }

  // 2. Must have a current session.
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "You must be signed in to switch accounts." };
  }

  // 3. Current user must be in the group.
  const fromEmail = session.user.email.toLowerCase().trim();
  if (!isSwitcherMember(fromEmail)) {
    return { ok: false, error: "Your account is not authorised to switch." };
  }

  // 4. Target must be in the group. Check string-membership BEFORE the DB
  //    lookup — otherwise this becomes a user-existence oracle for any
  //    email an attacker wants to probe.
  const toEmail = targetEmail.toLowerCase().trim();
  if (!isSwitcherMember(toEmail)) {
    return { ok: false, error: "Target account is not in the switcher group." };
  }

  // 5. No-op if already this user — avoids generating a useless audit row
  //    and a redundant session swap.
  if (toEmail === fromEmail) {
    return { ok: false, error: "You are already signed in as that account." };
  }

  // 6. Resolve the target row. Soft-deleted users are treated as "not found"
  //    so the error surface doesn't distinguish them — same pattern as login.
  const target = await prisma.user.findUnique({
    where: { email: toEmail },
    select: { id: true, deletedAt: true },
  });
  if (!target || target.deletedAt) {
    return { ok: false, error: "Target account not found." };
  }

  // 7. Do the swap. Order: audit BEFORE clearSession so the original session
  //    is still resolvable for any side-effects of audit(). Then clear, then
  //    create fresh.
  await audit({
    actorId: session.user.id,
    verb: "user.account_switched",
    objectType: "user",
    objectId: target.id,
    metadata: { fromEmail, toEmail },
  });

  await clearSession();
  await createSession({ userId: target.id });

  // Land on a known-good page for the new identity. /dashboard/assignments
  // is the post-login default elsewhere in the codebase.
  redirect("/dashboard/assignments");
}
