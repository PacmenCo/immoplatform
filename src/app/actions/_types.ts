import { requireSession, type SessionWithUser } from "@/lib/auth";

export type ActionResult<T = undefined> =
  | {
      ok: true;
      data?: T;
      /**
       * Human-readable note for partial-success outcomes — the action did
       * the primary thing, but a best-effort secondary step failed (e.g. the
       * row was created but a follow-on file upload didn't make it through).
       * Surfaced as a toast / banner so the caller can recover from the UI
       * without rolling back the primary write.
       */
      warning?: string;
    }
  | { ok: false; error: string; formValues?: Record<string, string> };

/**
 * Wraps a server action with session-required plumbing.
 *   const myAction = withSession(async (session, arg1, arg2) => {...});
 * On unauthenticated calls, returns a standard ActionResult error instead of
 * re-throwing. Saves ~6 lines of boilerplate per action and centralizes the copy.
 */
export function withSession<Args extends unknown[], T>(
  handler: (session: SessionWithUser, ...args: Args) => Promise<ActionResult<T>>,
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args) => {
    let session: SessionWithUser;
    try {
      session = await requireSession();
    } catch {
      return { ok: false, error: "You must be signed in." };
    }
    return handler(session, ...args);
  };
}
