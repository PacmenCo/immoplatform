/**
 * Vitest shim for `next/headers`. The real module reads from Next's request
 * context (set up by the framework dispatcher). Server actions that touch
 * cookies or headers outside a live request throw — so we back them with
 * an in-memory store that tests can manipulate directly.
 *
 * Usage:
 *   import { __resetRequestContext, __setHeader } from "../_helpers/next-headers-stub";
 *   beforeEach(() => { __resetRequestContext(); __setHeader("x-forwarded-for", "10.0.0.1"); });
 *
 * The stub matches Next's API shape closely enough for the call sites we
 * exercise: `.get`, `.set`, `.delete`, `.has` on the cookie jar, and a real
 * `Headers` instance for `await headers()`.
 */

type CookieRecord = { name: string; value: string };

const cookieStore = new Map<string, CookieRecord>();
const headersStore = new Map<string, string>();

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  expires?: Date;
  maxAge?: number;
  domain?: string;
};

export async function cookies() {
  return {
    get(name: string): CookieRecord | undefined {
      return cookieStore.get(name);
    },
    getAll(): CookieRecord[] {
      return [...cookieStore.values()];
    },
    has(name: string): boolean {
      return cookieStore.has(name);
    },
    set(
      nameOrOpts: string | (CookieRecord & CookieOptions),
      value?: string,
      _opts?: CookieOptions,
    ): void {
      void _opts;
      if (typeof nameOrOpts === "string") {
        cookieStore.set(nameOrOpts, { name: nameOrOpts, value: value ?? "" });
      } else {
        cookieStore.set(nameOrOpts.name, {
          name: nameOrOpts.name,
          value: nameOrOpts.value,
        });
      }
    },
    delete(name: string): void {
      cookieStore.delete(name);
    },
  };
}

export async function headers() {
  const h = new Headers();
  for (const [k, v] of headersStore) h.set(k, v);
  return h;
}

// ─── Test-only helpers ─────────────────────────────────────────────

export function __resetRequestContext(): void {
  cookieStore.clear();
  headersStore.clear();
}

export function __setHeader(name: string, value: string): void {
  headersStore.set(name.toLowerCase(), value);
}

export function __getCookie(name: string): string | undefined {
  return cookieStore.get(name)?.value;
}

export function __setCookie(name: string, value: string): void {
  cookieStore.set(name, { name, value });
}
