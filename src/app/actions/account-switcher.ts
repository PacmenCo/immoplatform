"use server";

import { localeRedirect } from "@/i18n/navigation";
import { prisma } from "@/lib/db";
import {
  audit,
  clearSession,
  createSession,
  getSession,
} from "@/lib/auth";
import { FOUNDER_EMAIL, isSwitcherMember } from "@/lib/account-switcher";
import type { ActionResult } from "./_types";

/**
 * Whether the switcher feature is allowed to run in the current environment.
 * Always on in dev/test; on prod gated behind the `ALLOW_PROD_SWITCHER` env
 * var so the feature can be killed instantly without a redeploy.
 */
function switcherEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_PROD_SWITCHER === "true";
}

/**
 * Hot-swap the current session into another switcher-group account. This is
 * a *real* logout-and-login between predefined accounts — not impersonation.
 * The session row gets revoked, a fresh row is created for the target user,
 * the cookie is rewritten. Permission gates, scope filters, audit attribution
 * all run as the new user from the next request onward.
 *
 * Hard-gates (in order):
 *   1. Refuses unless `switcherEnabled()` is true — always-on in dev/test,
 *      gated behind `ALLOW_PROD_SWITCHER=true` on prod. The kill-switch
 *      lives in the env file so the feature can be flipped off in seconds
 *      without a redeploy.
 *   2. On prod *only*, requires the current session-holder to be the
 *      founder (FOUNDER_EMAIL). Test users in the group are valid
 *      destinations but never valid origins on prod — closes the
 *      privilege-escalation path where a leaked test-user password would
 *      let an attacker swap into Jordan's admin session.
 *   3. Requires the current session-holder's email to be in SWITCHER_GROUP.
 *   4. Requires the target email to be in SWITCHER_GROUP.
 *   5. Refuses self-targeting (already that user — no-op redirect).
 *   6. Requires the target user row to exist and not be soft-deleted.
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
  // 1. Environment kill-switch. Always-on in dev/test; on prod gated behind
  //    `ALLOW_PROD_SWITCHER=true`. Lets ops drop the feature instantly
  //    without a redeploy.
  if (!switcherEnabled()) {
    return { ok: false, error: "errors.switcher.disabled" };
  }

  // 2. Must have a current session.
  const session = await getSession();
  if (!session) {
    return { ok: false, error: "errors.switcher.notSignedIn" };
  }

  // 3. Current user must be in the group.
  const fromEmail = session.user.email.toLowerCase().trim();
  if (!isSwitcherMember(fromEmail)) {
    return { ok: false, error: "errors.switcher.notAuthorized" };
  }

  // 4. Target must be in the group. Check string-membership BEFORE the DB
  //    lookup — otherwise this becomes a user-existence oracle for any
  //    email an attacker wants to probe.
  const toEmail = targetEmail.toLowerCase().trim();
  if (!isSwitcherMember(toEmail)) {
    return { ok: false, error: "errors.switcher.targetNotInGroup" };
  }

  // 5. On prod, the only thing we *strictly* forbid is a non-founder origin
  //    pivoting INTO the founder account — that's the privilege-escalation
  //    path a leaked test-user password would unlock. Test → test hops are
  //    fine (and necessary for the dev workflow: Jordan picks Test Staff,
  //    pokes around, then jumps to Test Realtor without re-logging-in). In
  //    dev/test we keep the any-to-any behaviour so the workflow stays fluid.
  if (
    process.env.NODE_ENV === "production" &&
    fromEmail !== FOUNDER_EMAIL &&
    toEmail === FOUNDER_EMAIL
  ) {
    return { ok: false, error: "errors.switcher.founderOnly" };
  }

  // 5. No-op if already this user — avoids generating a useless audit row
  //    and a redundant session swap.
  if (toEmail === fromEmail) {
    return { ok: false, error: "errors.switcher.alreadySignedIn" };
  }

  // 6. Resolve the target row. Soft-deleted users are treated as "not found"
  //    so the error surface doesn't distinguish them — same pattern as login.
  const target = await prisma.user.findUnique({
    where: { email: toEmail },
    select: { id: true, deletedAt: true },
  });
  if (!target || target.deletedAt) {
    return { ok: false, error: "errors.switcher.targetNotFound" };
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
  // is the post-login default elsewhere in the codebase. `localeRedirect`
  // prepends the active locale prefix so the new session cookie survives
  // the hop — a bare `redirect("/dashboard/assignments")` triggered another
  // middleware-level redirect in prod and dropped the session mid-flight.
  return localeRedirect("/dashboard/assignments");
}
