import type { Role } from "./permissions";

/**
 * Shared lookup table for rendering role badges consistently
 * across users list, user detail, team detail, invite form, etc.
 */
export const ROLE_BADGE: Record<Role, { bg: string; fg: string; label: string }> = {
  admin: { bg: "#fef2f2", fg: "#b91c1c", label: "Admin" },
  staff: { bg: "#f5f3ff", fg: "#6d28d9", label: "Staff" },
  realtor: { bg: "#eff6ff", fg: "#1d4ed8", label: "Realtor" },
  freelancer: { bg: "#ecfdf5", fg: "#047857", label: "Freelancer" },
};

export function roleBadge(role: string): { bg: string; fg: string; label: string } {
  return ROLE_BADGE[role as Role] ?? ROLE_BADGE.freelancer;
}
