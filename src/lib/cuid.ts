import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Client-side cuid-ish id. Prisma's `@default(cuid())` runs inside the DB
 * engine; when we need to pre-generate an id in application code (so a
 * storage key matches a row id), use this.
 *
 * Collision probability is negligible at our scale — 18 bytes of entropy.
 */
export function cuid(): string {
  return "c" + randomBytes(18).toString("hex");
}
