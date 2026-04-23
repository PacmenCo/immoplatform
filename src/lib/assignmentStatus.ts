import type { Status } from "./mockData";

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
