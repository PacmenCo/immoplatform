import "server-only";
import { randomBytes } from "node:crypto";

/**
 * Application-side id generator used when we need to know the id BEFORE
 * Prisma's `@default(cuid())` fires — e.g. to bake the id into a storage
 * key so the path and the row match without a two-phase dance.
 *
 * Named `generateCuid` (not `cuid`) to disambiguate from Prisma's
 * schema-level `cuid()` directive at call sites.
 */
export function generateCuid(): string {
  return "c" + randomBytes(18).toString("hex");
}
