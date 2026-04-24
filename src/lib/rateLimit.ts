import "server-only";

/**
 * In-memory sliding-window rate limiter. Fine for single-instance deployments
 * (dev, small self-hosted); swap for Redis/Upstash once we run multiple
 * Next.js workers. The API stays the same across backends.
 *
 * Platform v1 uses Laravel's `RateLimiter::tooManyAttempts()` keyed by
 * `email|ip` — we mirror that shape via the caller's choice of `key`.
 */

type Hit = { count: number; resetAt: number };

// Singleton across Turbopack HMR + Next 16 server-action module reloads.
// Without this, the Map is re-initialized per-call in dev, so the counter
// never increments across requests and the limiter effectively never fires.
// Same pattern the Prisma client uses in src/lib/db.ts.
declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Map<string, Hit> | undefined;
}

const store: Map<string, Hit> =
  globalThis.__rateLimitStore ?? new Map<string, Hit>();

if (process.env.NODE_ENV !== "production") {
  globalThis.__rateLimitStore = store;
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSec: number };

export function checkRateLimit(
  key: string,
  opts: { max: number; windowSec: number },
): RateLimitResult {
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + opts.windowSec * 1000 });
    return { ok: true, remaining: opts.max - 1 };
  }
  if (existing.count >= opts.max) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, remaining: opts.max - existing.count };
}

/**
 * Clear a key's counter — call on successful completion so a user who typed
 * their password wrong 4 times then got it right doesn't stay near the cap.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Best-effort IP from Next's forwarded headers. `x-forwarded-for` can be a
 * comma-separated list when a proxy chain is in front; the leftmost entry is
 * the original client. Falls back to `unknown` so the key is still unique
 * per (email, no-ip) rather than colliding globally.
 */
export function clientIpFromHeaders(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

// ─── Shared policies ─────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Matches Platform: 5 attempts per 60s per (email, IP). */
  login: { max: 5, windowSec: 60 },
  /** Platform relies on Laravel's Password broker default (1/60s per email).
   *  We pick a slightly less aggressive limit that matches common real-world
   *  flows (user mistypes once). */
  forgotPassword: { max: 3, windowSec: 300 },
  /** Guards the token-consume step. High enough that a user with a slow
   *  password manager isn't blocked. */
  resetPassword: { max: 5, windowSec: 900 },
} as const;
