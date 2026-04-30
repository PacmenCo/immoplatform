/**
 * Account-switcher group: the closed set of accounts that can hot-swap into
 * each other for fast UI testing. Anyone outside this list cannot use the
 * switcher; anyone inside can switch to any other member.
 *
 * Membership rules:
 *   - Jordan (the founder) is always in.
 *   - The `@immo.test` test fixtures are the rest. They only exist on dev /
 *     staging seeds — production has no rows with this domain, so the
 *     switcher dropdown is effectively empty in prod even if reached.
 *
 * The group is the security boundary. The session-affecting action that
 * implements the swap (`switchToAccount` in `src/app/actions/account-switcher.ts`)
 * MUST refuse any current-user-or-target email that is not in this list.
 *
 * v1 dev parity: this is a developer-experience tool, not customer-facing
 * support tooling. If we ever want admins to "view as" real customers,
 * that's a different feature with full impersonation infrastructure +
 * privacy disclosure — see the spec under docs/ when that lands.
 */

const RAW_GROUP = [
  // Founder admin.
  "jordan@asbestexperts.be",

  // @immo.test reserves an IANA special-use TLD (RFC 6761) — the domain
  // physically cannot resolve on the public internet, so no attacker can
  // ever receive email at one of these addresses. Combined with the seed's
  // `NODE_ENV !== "production"` hard-gate, these rows only exist in dev.
  // One per non-admin role — Jordan covers admin himself.
  "test-staff@immo.test",
  "test-realtor@immo.test",
  "test-freelancer@immo.test",
] as const;

/**
 * Lowercased copy used for membership checks. We never compare against the
 * raw constant — emails coming in from the DB or a server-action arg can
 * have arbitrary casing, and Postgres `email` is `@unique` but
 * case-sensitive in the schema. Normalizing here keeps both sides honest.
 */
export const SWITCHER_GROUP: readonly string[] = RAW_GROUP.map((e) =>
  e.toLowerCase(),
);

const SWITCHER_SET = new Set(SWITCHER_GROUP);

/** True iff the email (after trim + lowercase) is in the switcher group. */
export function isSwitcherMember(email: string): boolean {
  if (!email) return false;
  return SWITCHER_SET.has(email.trim().toLowerCase());
}
