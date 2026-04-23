import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time Bearer-token check for cron routes. Plain `!==` leaks the
 * length and prefix of the provided secret through response-time timing.
 *
 * Used by every `src/app/api/cron/*` handler — keep the implementation in
 * one place so a typo can't quietly break auth on one route.
 */
export function authorizeBearerToken(req: Request, secret: string): boolean {
  const header = req.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
