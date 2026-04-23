/**
 * Client-safe role type. `permissions.ts` is server-only (it touches
 * prisma/auth), so client components that need to reason about roles
 * — e.g. the inline StatusPicker filtering its menu by role — import
 * the union from here instead.
 *
 * Keep in lockstep with the `Role` alias re-exported from permissions.ts.
 */
export type Role = "admin" | "staff" | "realtor" | "freelancer";
