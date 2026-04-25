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
 * the original client. Only honored when `TRUST_PROXY=1` — otherwise an
 * attacker on a setup without an upstream proxy can rotate XFF freely to
 * bypass per-IP rate limits. Production deployments behind a known proxy
 * (Vercel, Cloudflare, nginx) opt in via the env var; dev / direct-exposed
 * deploys collapse to a single "unknown" bucket so the per-email defense
 * still bounds total attempts.
 */
export function clientIpFromHeaders(h: Headers): string {
  if (process.env.TRUST_PROXY !== "1") return "unknown";
  const fwd = h.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]!.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? "unknown";
}

// ─── Shared policies ─────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Matches Platform: 5 attempts per 60s per (email, IP). */
  login: { max: 5, windowSec: 60 },
  /** Defense-in-depth across IP rotation: hard cap per email regardless of
   *  source IP. An attacker who spoofs/rotates XFF still can't exceed this.
   *  Generous enough that a user with a flaky password manager won't trip. */
  loginPerEmail: { max: 30, windowSec: 3600 },
  /** Platform relies on Laravel's Password broker default (1/60s per email).
   *  We pick a slightly less aggressive limit that matches common real-world
   *  flows (user mistypes once). */
  forgotPassword: { max: 3, windowSec: 300 },
  /** Per-IP cap on forgot-password to bound wordlist abuse — without this an
   *  attacker with N emails could trigger 3N reset emails per window. */
  forgotPasswordPerIp: { max: 10, windowSec: 3600 },
  /** Guards the token-consume step. High enough that a user with a slow
   *  password manager isn't blocked. */
  resetPassword: { max: 5, windowSec: 900 },
} as const;
