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
  draft: ["scheduled", "in_progress", "cancelled"],
  scheduled: ["in_progress", "delivered", "cancelled"],
  in_progress: ["delivered", "cancelled"],
  delivered: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies Record<Status, readonly Status[]>;

export function canTransition(from: Status, to: Status): boolean {
  return (TRANSITIONS[from] as readonly Status[]).includes(to);
}

/** Inverse lookup — all states that can transition into `to`. */
export function sourcesOf(to: Status): Status[] {
  return (Object.keys(TRANSITIONS) as Status[]).filter((from) =>
    canTransition(from, to),
  );
}
