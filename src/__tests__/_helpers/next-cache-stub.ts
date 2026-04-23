// Vitest shim for `next/cache`. The real module reads from Next's async
// storage (set up by the framework's request dispatcher); calling it outside
// a live request throws "Invariant: static generation store missing".
//
// Server actions invoked from integration tests don't need cache invalidation
// to run — the assertions read straight from the DB. No-ops here keep the
// action bodies unchanged.

export function revalidatePath(_path: string, _type?: "layout" | "page"): void {
  void _path;
  void _type;
}

export function revalidateTag(_tag: string): void {
  void _tag;
}

export const unstable_cache = <T extends (...args: unknown[]) => unknown>(fn: T) => fn;
