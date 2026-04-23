import { describe, it, expect } from "vitest";
import { isOnline, ONLINE_WINDOW_MS } from "@/lib/userStatus";

// Platform parity: app/Models/User.php:67-74 — is_online derived from
// last_login_at.diffInMinutes(now()) < 5. Immo uses lastSeenAt (heartbeat)
// but keeps the same strict-< 5-minute window.

describe("isOnline", () => {
  const now = new Date("2026-04-23T12:00:00Z").getTime();

  it("returns false when lastSeenAt is null (user has never signed in)", () => {
    expect(isOnline({ lastSeenAt: null }, now)).toBe(false);
  });

  it("returns true when lastSeenAt was 1 minute ago", () => {
    const seen = new Date(now - 60 * 1000);
    expect(isOnline({ lastSeenAt: seen }, now)).toBe(true);
  });

  it("returns true at 4m59s (just inside the window)", () => {
    const seen = new Date(now - (5 * 60 * 1000 - 1));
    expect(isOnline({ lastSeenAt: seen }, now)).toBe(true);
  });

  it("returns false at exactly 5 minutes (strict <, matches Platform)", () => {
    const seen = new Date(now - 5 * 60 * 1000);
    expect(isOnline({ lastSeenAt: seen }, now)).toBe(false);
  });

  it("returns false for timestamps older than 5 minutes", () => {
    const seen = new Date(now - 6 * 60 * 1000);
    expect(isOnline({ lastSeenAt: seen }, now)).toBe(false);
  });

  it("returns true for a future lastSeenAt (clock-skew-tolerant)", () => {
    // `now - lastSeenAt` is negative when lastSeenAt is in the future;
    // `-x < WINDOW` is trivially true. Not a footgun in practice — but
    // we lock in the behavior so accidental clamping doesn't slip in.
    const seen = new Date(now + 1000);
    expect(isOnline({ lastSeenAt: seen }, now)).toBe(true);
  });

  it("5-minute window is exactly 300_000ms", () => {
    expect(ONLINE_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});
