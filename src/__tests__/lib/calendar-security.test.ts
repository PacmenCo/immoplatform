import { describe, it, expect, beforeEach } from "vitest";
import { encryptToken, decryptToken } from "@/lib/calendar/crypto";
import {
  buildState,
  verifyState,
  setStateCookie,
  readAndClearStateCookie,
} from "@/lib/calendar/oauth";
import {
  __resetRequestContext,
  __getCookie,
} from "../_helpers/next-headers-stub";

// Platform parity — these helpers protect two CSRF / data-at-rest boundaries:
//   1. encryptToken / decryptToken → AES-256-GCM envelope on stored OAuth
//      refresh tokens. Any tamper / corruption must reject decryption.
//   2. buildState / verifyState → HMAC-signed state param that round-trips
//      through Google / Outlook. Rejects replay after expiry, tamper, or
//      malformed input.

describe("encryptToken / decryptToken — AES-GCM round-trip", () => {
  it("round-trips an ASCII payload", () => {
    const plain = "refresh-token-abc123";
    const cipher = encryptToken(plain);
    expect(cipher).not.toBe(plain);
    expect(decryptToken(cipher)).toBe(plain);
  });

  it("round-trips a unicode payload (multibyte)", () => {
    const plain = "ya29.🔑•tøkeπ";
    expect(decryptToken(encryptToken(plain))).toBe(plain);
  });

  it("empty-string encrypt → decrypt rejects as malformed (explicit behavior)", () => {
    // AES-GCM of an empty plaintext produces an empty ciphertext; the
    // decrypt guard treats the empty third segment as "malformed" and
    // rejects. OAuth refresh tokens are never empty in practice, so this
    // pins the current (defensive) semantics rather than claiming round-trip.
    const cipher = encryptToken("");
    expect(() => decryptToken(cipher)).toThrow(/Malformed/);
  });

  it("produces a DIFFERENT ciphertext on every call (fresh IV per encrypt)", () => {
    const plain = "same-payload";
    const a = encryptToken(plain);
    const b = encryptToken(plain);
    expect(a).not.toBe(b);
    expect(decryptToken(a)).toBe(plain);
    expect(decryptToken(b)).toBe(plain);
  });

  it("ciphertext format is iv.base64:tag.base64:ct.base64 (3 colon-separated base64 parts)", () => {
    const cipher = encryptToken("payload");
    const parts = cipher.split(":");
    expect(parts).toHaveLength(3);
    // Each part is valid base64
    for (const p of parts) {
      expect(() => Buffer.from(p, "base64")).not.toThrow();
    }
  });

  it("tampered auth-tag → decrypt throws", () => {
    const cipher = encryptToken("hello");
    const [iv, tag, ct] = cipher.split(":");
    // Flip one byte in the tag
    const tagBuf = Buffer.from(tag, "base64");
    tagBuf[0] = tagBuf[0] ^ 0xff;
    const tampered = `${iv}:${tagBuf.toString("base64")}:${ct}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("tampered ciphertext → decrypt throws (GCM detects integrity)", () => {
    const cipher = encryptToken("hello");
    const [iv, tag, ct] = cipher.split(":");
    const ctBuf = Buffer.from(ct, "base64");
    ctBuf[0] = ctBuf[0] ^ 0xff;
    const tampered = `${iv}:${tag}:${ctBuf.toString("base64")}`;
    expect(() => decryptToken(tampered)).toThrow();
  });

  it("malformed (not 3 parts) → throws with a clear message", () => {
    expect(() => decryptToken("junk")).toThrow(/Malformed/);
    expect(() => decryptToken("only:two")).toThrow(/Malformed/);
  });
});

describe("buildState / verifyState — HMAC-signed replay defense", () => {
  it("round-trips a fresh state → same userId + future expiresAt", () => {
    const state = buildState("u_alice");
    const v = verifyState(state);
    expect(v).not.toBeNull();
    expect(v?.userId).toBe("u_alice");
    expect(v?.expiresAt).toBeGreaterThan(Date.now());
  });

  it("nil / empty token → null (no exception)", () => {
    expect(verifyState(null)).toBeNull();
    expect(verifyState(undefined)).toBeNull();
    expect(verifyState("")).toBeNull();
  });

  it("malformed token (wrong part count) → null", () => {
    expect(verifyState("one.two")).toBeNull();
    expect(verifyState("one.two.three")).toBeNull();
    expect(verifyState("a.b.c.d.e")).toBeNull();
  });

  it("expired state → null even if signature is valid", () => {
    // Build a state by hand: userId, random, PAST expiry, then valid-ish sig.
    // We can't sign it correctly without the key, but the expiry check runs
    // before the sig check, so any 4-part string with a past expiresAt is rejected.
    const past = Date.now() - 1_000;
    const token = `u_alice.rand.${past}.whatever-sig-doesnt-matter-here`;
    expect(verifyState(token)).toBeNull();
  });

  it("future expiry but tampered signature → null", () => {
    const state = buildState("u_alice");
    const parts = state.split(".");
    // Flip a char in the sig
    const sigChars = parts[3].split("");
    sigChars[0] = sigChars[0] === "a" ? "b" : "a";
    const tampered = [parts[0], parts[1], parts[2], sigChars.join("")].join(".");
    expect(verifyState(tampered)).toBeNull();
  });

  it("future expiry but tampered userId → null (sig covers the body)", () => {
    const state = buildState("u_alice");
    const parts = state.split(".");
    // Replace userId — sig won't match
    const tampered = [`u_mallory`, parts[1], parts[2], parts[3]].join(".");
    expect(verifyState(tampered)).toBeNull();
  });

  it("two states built for the same user are DISTINCT (random component varies)", () => {
    const a = buildState("u_alice");
    const b = buildState("u_alice");
    expect(a).not.toBe(b);
    // Both still valid
    expect(verifyState(a)?.userId).toBe("u_alice");
    expect(verifyState(b)?.userId).toBe("u_alice");
  });
});

describe("setStateCookie / readAndClearStateCookie", () => {
  beforeEach(() => {
    __resetRequestContext();
  });

  it("set → read returns the same value", async () => {
    await setStateCookie("some-opaque-state-token");
    expect(__getCookie("immo_oauth_state")).toBe("some-opaque-state-token");
    const readBack = await readAndClearStateCookie();
    expect(readBack).toBe("some-opaque-state-token");
  });

  it("read CLEARS the cookie (single-use)", async () => {
    await setStateCookie("state-1");
    expect(__getCookie("immo_oauth_state")).toBe("state-1");
    const first = await readAndClearStateCookie();
    expect(first).toBe("state-1");
    expect(__getCookie("immo_oauth_state")).toBeUndefined();
    const second = await readAndClearStateCookie();
    expect(second).toBeNull();
  });

  it("no cookie set → read returns null cleanly", async () => {
    const v = await readAndClearStateCookie();
    expect(v).toBeNull();
  });

  it("state end-to-end: build → cookie → read → verify → userId recovered", async () => {
    const state = buildState("u_alice");
    await setStateCookie(state);
    const cookie = await readAndClearStateCookie();
    expect(cookie).toBe(state);
    const verified = verifyState(cookie);
    expect(verified?.userId).toBe("u_alice");
  });
});
