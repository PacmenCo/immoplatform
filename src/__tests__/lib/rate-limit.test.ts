import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  checkRateLimit,
  clientIpFromHeaders,
  resetRateLimit,
  RATE_LIMITS,
} from "@/lib/rateLimit";

// In-memory sliding-window limiter shared across login / forgot-password /
// reset-password / invite-resend. Core semantics tested directly here;
// integration through action tests exercises the real keys.

describe("checkRateLimit — window semantics", () => {
  const POLICY = { max: 3, windowSec: 60 };

  beforeEach(() => {
    // Use a unique key per test to isolate from the module-level Map.
    resetRateLimit("test:rl:a");
    resetRateLimit("test:rl:b");
  });

  it("first call → ok + remaining = max-1", () => {
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: 2 });
  });

  it("successive calls decrement `remaining` to 0, then reject", () => {
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: 2 });
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: 1 });
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: 0 });
    const blocked = checkRateLimit("test:rl:a", POLICY);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfterSec).toBeGreaterThan(0);
      expect(blocked.retryAfterSec).toBeLessThanOrEqual(POLICY.windowSec);
    }
  });

  it("window resets when resetAt has passed (fake timers)", () => {
    vi.useFakeTimers();
    const startMs = new Date("2026-05-01T10:00:00Z").getTime();
    vi.setSystemTime(startMs);
    // Exhaust
    for (let i = 0; i < POLICY.max; i++) checkRateLimit("test:rl:a", POLICY);
    expect(checkRateLimit("test:rl:a", POLICY).ok).toBe(false);
    // Advance past window
    vi.setSystemTime(startMs + POLICY.windowSec * 1000 + 1);
    // Fresh counter
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: POLICY.max - 1 });
    vi.useRealTimers();
  });

  it("distinct keys are isolated (key A exhausted doesn't block key B)", () => {
    for (let i = 0; i < POLICY.max; i++) checkRateLimit("test:rl:a", POLICY);
    expect(checkRateLimit("test:rl:a", POLICY).ok).toBe(false);
    expect(checkRateLimit("test:rl:b", POLICY).ok).toBe(true);
  });

  it("resetRateLimit(key) clears the counter → next call fresh", () => {
    for (let i = 0; i < POLICY.max; i++) checkRateLimit("test:rl:a", POLICY);
    expect(checkRateLimit("test:rl:a", POLICY).ok).toBe(false);
    resetRateLimit("test:rl:a");
    expect(checkRateLimit("test:rl:a", POLICY)).toEqual({ ok: true, remaining: POLICY.max - 1 });
  });

  it("resetRateLimit on unknown key → no-op (no throw)", () => {
    expect(() => resetRateLimit("test:rl:never-existed")).not.toThrow();
  });

  it("exactly-at-max returns ok (off-by-one guard)", () => {
    // max=3 means calls 1,2,3 must all be ok; call 4 is blocked.
    const key = "test:rl:edge";
    resetRateLimit(key);
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimit(key, POLICY);
      expect(r.ok).toBe(true);
    }
    expect(checkRateLimit(key, POLICY).ok).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("checkRateLimit — retryAfterSec math", () => {
  it("retryAfterSec rounds UP (Math.ceil) to avoid zero-second loops", () => {
    vi.useFakeTimers();
    const start = new Date("2026-05-01T10:00:00Z").getTime();
    vi.setSystemTime(start);
    const key = "test:rl:ceil";
    resetRateLimit(key);
    const POLICY = { max: 1, windowSec: 10 };
    checkRateLimit(key, POLICY); // exhaust
    // Advance 500ms — retry-after should round up from 9.5 → 10 (or to at
    // least 1 if we'd otherwise report 0).
    vi.setSystemTime(start + 500);
    const r = checkRateLimit(key, POLICY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
    vi.useRealTimers();
  });
});

describe("RATE_LIMITS shared policies", () => {
  it("login policy matches Platform's 5/60s shape", () => {
    expect(RATE_LIMITS.login).toEqual({ max: 5, windowSec: 60 });
  });

  it("loginPerEmail defense-in-depth: 30 per hour", () => {
    expect(RATE_LIMITS.loginPerEmail).toEqual({ max: 30, windowSec: 3600 });
  });

  it("forgotPassword policy: 3 per 5 minutes (less aggressive than Platform)", () => {
    expect(RATE_LIMITS.forgotPassword).toEqual({ max: 3, windowSec: 300 });
  });

  it("forgotPasswordPerIp defense-in-depth: 10 per hour", () => {
    expect(RATE_LIMITS.forgotPasswordPerIp).toEqual({ max: 10, windowSec: 3600 });
  });

  it("resetPassword policy: 5 per 15 minutes", () => {
    expect(RATE_LIMITS.resetPassword).toEqual({ max: 5, windowSec: 900 });
  });
});

describe("clientIpFromHeaders", () => {
  function hdrs(entries: Array<[string, string]>): Headers {
    const h = new Headers();
    for (const [k, v] of entries) h.set(k, v);
    return h;
  }

  it("x-forwarded-for with single IP → that IP", () => {
    expect(clientIpFromHeaders(hdrs([["x-forwarded-for", "203.0.113.42"]]))).toBe("203.0.113.42");
  });

  it("x-forwarded-for with comma-separated chain → leftmost (original client)", () => {
    expect(
      clientIpFromHeaders(hdrs([["x-forwarded-for", "203.0.113.42, 10.0.0.1, 10.0.0.2"]])),
    ).toBe("203.0.113.42");
  });

  it("trims whitespace around the leftmost entry", () => {
    expect(
      clientIpFromHeaders(hdrs([["x-forwarded-for", "  203.0.113.42  , 10.0.0.1"]])),
    ).toBe("203.0.113.42");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    expect(clientIpFromHeaders(hdrs([["x-real-ip", "198.51.100.9"]]))).toBe("198.51.100.9");
  });

  it("x-forwarded-for takes precedence over x-real-ip when both present", () => {
    expect(
      clientIpFromHeaders(
        hdrs([
          ["x-forwarded-for", "203.0.113.42"],
          ["x-real-ip", "198.51.100.9"],
        ]),
      ),
    ).toBe("203.0.113.42");
  });

  it("no proxy headers → 'unknown' sentinel (never null)", () => {
    expect(clientIpFromHeaders(hdrs([]))).toBe("unknown");
  });

  it("empty x-forwarded-for → falls through to x-real-ip", () => {
    expect(
      clientIpFromHeaders(hdrs([
        ["x-forwarded-for", ""],
        ["x-real-ip", "198.51.100.9"],
      ])),
    ).toBe("198.51.100.9");
  });

  it("IPv6 address flows through intact", () => {
    expect(
      clientIpFromHeaders(hdrs([["x-forwarded-for", "2001:db8::1"]])),
    ).toBe("2001:db8::1");
  });

  it("ignores forwarded headers entirely when TRUST_PROXY is unset", () => {
    vi.stubEnv("TRUST_PROXY", "");
    try {
      expect(
        clientIpFromHeaders(
          hdrs([
            ["x-forwarded-for", "203.0.113.42"],
            ["x-real-ip", "198.51.100.9"],
          ]),
        ),
      ).toBe("unknown");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
