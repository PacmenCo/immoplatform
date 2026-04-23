import { STATUS_ORDER, type Status } from "./mockData";
import type { Role } from "./permissions.types";

/**
 * Prisma returns `status: string` and `role: string` because SQLite lacks
 * real enums. Most call-sites `as Status` / `as Role` into typed unions,
 * which silently swallows any drift — e.g. a DB row with `role = "superadmin"`
 * would type-cast cleanly but break downstream policy logic.
 *
 * These helpers add a boundary check. Unknown values fall back to the
 * least-surprising safe default AND emit a `console.warn` so the drift
 * shows up in server logs instead of manifesting as a weird UI bug later.
 *
 * The helpers are pure — no Prisma, no server-only — so client components
 * can reuse them too (currently only the server reads role/status, but
 * keeping the boundary portable costs nothing).
 */

// Role has no existing exported constant tuple — Role is a union type in
// permissions.types.ts. Keep the values local here; if a roles tuple later
// gets exported (e.g. for a role-picker UI) this can switch to importing.
const ROLE_VALUES = ["admin", "staff", "realtor", "freelancer"] as const;

export function isRole(s: string): s is Role {
  return (ROLE_VALUES as readonly string[]).includes(s);
}

// Reuse the single source of truth for status values — mockData.ts owns
// the Status union + ordered tuple; redefining would risk drift.
export function isStatus(s: string): s is Status {
  return (STATUS_ORDER as readonly string[]).includes(s);
}

/**
 * Validate a role string. Unknown values fall back to `"freelancer"` — the
 * least-privileged role — so enum drift can't accidentally grant elevated
 * access. Logs a single-line warning with the offending value + context so
 * the drift is diagnosable from server logs.
 */
export function parseRole(raw: string, context?: string): Role {
  if (isRole(raw)) return raw;
  const where = context ? ` (at ${context})` : "";
  console.warn(`[enum-validation] unexpected role ${JSON.stringify(raw)}${where} — falling back to "freelancer"`);
  return "freelancer";
}

/**
 * Validate a status string. Unknown values fall back to `"draft"` — a
 * non-terminal, non-lifecycle-triggering state — so drift can't accidentally
 * trigger commission / calendar side-effects. Logs a warning.
 */
export function parseStatus(raw: string, context?: string): Status {
  if (isStatus(raw)) return raw;
  const where = context ? ` (at ${context})` : "";
  console.warn(`[enum-validation] unexpected status ${JSON.stringify(raw)}${where} — falling back to "draft"`);
  return "draft";
}
