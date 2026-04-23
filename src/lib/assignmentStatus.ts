import type { Status } from "./mockData";
import type { Role } from "./permissions.types";

/**
 * Declarative state machine for assignment status transitions.
 * `TRANSITIONS[from]` lists every legal `to` from that state.
 *
 * `satisfies` ensures TypeScript errors if a new Status is added to the
 * union without a row here — so the compiler enforces the coverage that
 * scattered `status: { in: [...] }` predicates cannot.
 */
export const TRANSITIONS = {
  draft: ["awaiting", "scheduled", "in_progress", "on_hold", "cancelled"],
  awaiting: ["scheduled", "in_progress", "on_hold", "cancelled"],
  scheduled: ["awaiting", "in_progress", "delivered", "on_hold", "cancelled"],
  in_progress: ["delivered", "on_hold", "cancelled"],
  delivered: ["completed", "cancelled"],
  on_hold: ["awaiting", "scheduled", "in_progress", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies Record<Status, readonly Status[]>;

/**
 * Early-lifecycle states — Platform's `autoStatusForDateChange` uses the set
 * { Nieuw, In afwachting, On hold } as the trigger window for bumping to
 * Ingepland when a date is set. Mirror the same set here so the immo edit
 * flow auto-transitions identically.
 */
export const EARLY_STATUSES: ReadonlySet<Status> = new Set([
  "draft",
  "awaiting",
  "on_hold",
]);

export function canTransition(from: Status, to: Status): boolean {
  return (TRANSITIONS[from] as readonly Status[]).includes(to);
}

/** Inverse lookup — all states that can transition into `to`. */
export function sourcesOf(to: Status): Status[] {
  return (Object.keys(TRANSITIONS) as Status[]).filter((from) =>
    canTransition(from, to),
  );
}

/**
 * Role → target-status allowlist. Platform parity: the `role_status` pivot
 * table gates which statuses each role can SET on an assignment
 * (AssignmentController.php:400, `$user->role->statuses()->pluck('id')`).
 *
 * Mapping derived from `database/seeders/StatusSeeder.php` + the
 * 2025_07_29 (freelancer gets "In afwachting") and 2025_10_12 (medewerker
 * gets all statuses) migrations:
 *
 *   admin       → every status
 *   staff       → every status  (Platform: medewerker)
 *   realtor     → on_hold, cancelled   (Platform: makelaar — pause/cancel only)
 *   freelancer  → awaiting, scheduled, in_progress
 *                 (Platform: In afwachting, Ingepland, In verwerking)
 *
 * Note: the `draft` / `delivered` / `completed` targets are NOT listed for
 * realtor or freelancer. The dedicated lifecycle actions (markDelivered,
 * markCompleted, cancel) still apply their own policy gates — this map
 * only controls the inline picker + freelancer restricted-edit path.
 *
 * The CURRENT status is always allowed as a no-op, matching Platform's
 * "add existing status_id to allow list" fallback (AssignmentController.php:402).
 */
const ROLE_ALLOWED_STATUSES = {
  admin: ["draft", "awaiting", "scheduled", "in_progress", "delivered", "completed", "on_hold", "cancelled"],
  staff: ["draft", "awaiting", "scheduled", "in_progress", "delivered", "completed", "on_hold", "cancelled"],
  realtor: ["on_hold", "cancelled"],
  freelancer: ["awaiting", "scheduled", "in_progress"],
} as const satisfies Record<Role, readonly Status[]>;

/**
 * True when `role` is allowed to set the assignment status to `to`, given
 * the current status `from`. A same-state move (from === to) is always a
 * no-op and permitted — prevents false negatives on form resubmits.
 *
 * This is a pure policy helper — the state-machine check (`canTransition`)
 * and the per-row policy gate (canEditAssignment / canCompleteAssignment /
 * canCancelAssignment) still run in the action. Keep all three layers.
 */
export function canRoleTransitionTo(role: Role, from: Status, to: Status): boolean {
  if (from === to) return true;
  return (ROLE_ALLOWED_STATUSES[role] as readonly Status[]).includes(to);
}

/**
 * The set of target statuses a role can set. Used by the StatusPicker to
 * hide options the role can't reach (Platform hides the same in blade).
 * Always includes `current` so the row's own state is visible in the list.
 */
export function allowedTargetsForRole(role: Role, current: Status): readonly Status[] {
  const base = ROLE_ALLOWED_STATUSES[role];
  if ((base as readonly Status[]).includes(current)) return base;
  return [...base, current];
}
