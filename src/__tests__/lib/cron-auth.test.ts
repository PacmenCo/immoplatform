import { describe, it, expect } from "vitest";
import { authorizeBearerToken } from "@/lib/cron-auth";

// Security boundary: every cron route in `src/app/api/cron/*` guards its
// mutations with this single function. A regression that downgrades from
// `timingSafeEqual` to plain `!==` would silently reintroduce a timing-side-
// channel that leaks the CRON_SECRET byte-by-byte.
//
// The integration-side behavior (401 on bad token) is tested via each
// cron route. This file pins the FUNCTION's contract directly.

function reqWith(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("http://localhost/x", { headers });
}

describe("authorizeBearerToken", () => {
  it("correct Bearer header → true", () => {
    expect(authorizeBearerToken(reqWith("Bearer super-secret"), "super-secret")).toBe(true);
  });

  it("missing Authorization header → false (no crash)", () => {
    expect(authorizeBearerToken(reqWith(null), "super-secret")).toBe(false);
  });

  it("empty Authorization header → false", () => {
    expect(authorizeBearerToken(reqWith(""), "super-secret")).toBe(false);
  });

  it("wrong scheme (Basic) → false", () => {
    expect(authorizeBearerToken(reqWith("Basic super-secret"), "super-secret")).toBe(false);
  });

  it("missing Bearer prefix → false", () => {
    expect(authorizeBearerToken(reqWith("super-secret"), "super-secret")).toBe(false);
  });

  it("token with trailing whitespace matches (Fetch Headers API normalizes values by trimming before the function sees them)", () => {
    // This documents a platform invariant: `new Headers().set()` strips
    // leading/trailing whitespace from the stored value, so by the time
    // `authorizeBearerToken` reads it via `.get("authorization")`, the
    // whitespace is gone. Important because a refactor that reads from a
    // raw header string (not via Headers) would regain whitespace
    // sensitivity — and then would need its own trim or constant-time
    // compare handling.
    expect(authorizeBearerToken(reqWith("Bearer super-secret "), "super-secret")).toBe(true);
  });

  it("token differing in ONE character → false", () => {
    expect(authorizeBearerToken(reqWith("Bearer super-secreX"), "super-secret")).toBe(false);
  });

  it("different length → early-returns false before timingSafeEqual (prevents throw)", () => {
    // If length check were skipped, `timingSafeEqual` would throw on mismatched
    // buffer lengths. This test catches a refactor that drops the length guard.
    expect(() => authorizeBearerToken(reqWith("Bearer a"), "much-longer-secret")).not.toThrow();
    expect(authorizeBearerToken(reqWith("Bearer a"), "much-longer-secret")).toBe(false);
  });

  it("token is a PREFIX of expected (shorter) → false", () => {
    expect(authorizeBearerToken(reqWith("Bearer super"), "super-secret")).toBe(false);
  });

  it("token has extra suffix → false", () => {
    expect(authorizeBearerToken(
      reqWith("Bearer super-secret-plus-extra"),
      "super-secret",
    )).toBe(false);
  });

  it("case-sensitive 'Bearer' prefix (bearer lowercase → false)", () => {
    expect(authorizeBearerToken(reqWith("bearer super-secret"), "super-secret")).toBe(false);
  });

  it("empty secret + 'Bearer ' → rejected (doesn't match own stub)", () => {
    // Matches the expected buffer literally — `Bearer ` length 7, actual
    // length 6 — length mismatch drops it.
    expect(authorizeBearerToken(reqWith("Bearer"), "")).toBe(false);
  });
});
