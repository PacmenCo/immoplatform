/**
 * v1 parity audit for role-permission helpers. Mirrors Platform's policy
 * rules (Platform/app/Policies/{Assignment,Team,User}Policy.php) — each
 * `describe` block names the v1 policy method it parallels, and each `it`
 * case encodes a specific rule line.
 *
 * v1 ↔ immo role mapping:
 *   admin       ↔ admin
 *   medewerker  ↔ staff
 *   makelaar    ↔ realtor
 *   freelancer  ↔ freelancer
 *
 * What's covered (v1 policy lines NOT already exercised by permissions.test.ts):
 *   - canCreateAssignment           — v1 AssignmentPolicy::create
 *   - canCreateTeam                 — v1 TeamPolicy::create
 *   - canCreateFirstTeam            — immo founder extension
 *   - canEditTeam                   — v1 TeamPolicy::edit / update
 *   - canViewUser                   — v1 UserPolicy::view
 *   - canAdminUsers                 — v1 UserPolicy::create/update/delete
 *   - userListRoleFilter            — derived from canViewUser
 */

import { describe, expect, it } from "vitest";
import {
  canAdminUsers,
  canCreateAssignment,
  canCreateFirstTeam,
  canCreateTeam,
  canEditTeam,
  canViewUser,
  userListRoleFilter,
} from "@/lib/permissions";
import { setupTestDb } from "../_helpers/db";
import { makeSession } from "../_helpers/session";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";

setupTestDb();

// ─── canCreateAssignment (v1 AssignmentPolicy::create line 79) ────────
//   `in_array($user->role->name, ['admin', 'medewerker', 'makelaar'])`
describe("canCreateAssignment — v1 AssignmentPolicy::create", () => {
  it("admin can create", async () => {
    const { admin } = await seedBaseline();
    expect(canCreateAssignment(admin)).toBe(true);
  });

  it("staff can create (= v1 medewerker)", async () => {
    const { staff } = await seedBaseline();
    expect(canCreateAssignment(staff)).toBe(true);
  });

  it("realtor can create (= v1 makelaar)", async () => {
    const { realtor } = await seedBaseline();
    expect(canCreateAssignment(realtor)).toBe(true);
  });

  it("freelancer CANNOT create — v1 explicit exclusion", async () => {
    const { freelancer } = await seedBaseline();
    expect(canCreateAssignment(freelancer)).toBe(false);
  });
});

// ─── canCreateTeam (v1 TeamPolicy::create line 33) ────────────────────
//   `$user->hasRole('admin')` — admin only
describe("canCreateTeam — v1 TeamPolicy::create (admin only)", () => {
  it("admin can create", async () => {
    const { admin } = await seedBaseline();
    expect(canCreateTeam(admin)).toBe(true);
  });

  it("staff CANNOT create — v1 admin-only", async () => {
    const { staff } = await seedBaseline();
    expect(canCreateTeam(staff)).toBe(false);
  });

  it("realtor CANNOT create (general path — see canCreateFirstTeam for founder)", async () => {
    const { realtor } = await seedBaseline();
    expect(canCreateTeam(realtor)).toBe(false);
  });

  it("freelancer CANNOT create", async () => {
    const { freelancer } = await seedBaseline();
    expect(canCreateTeam(freelancer)).toBe(false);
  });
});

// ─── canCreateFirstTeam (immo founder-flow extension) ─────────────────
//   v1 has no equivalent — admins manually bootstrapped agencies. Immo
//   lets a realtor with zero owned teams self-found exactly one.
describe("canCreateFirstTeam — immo founder extension (no v1 counterpart)", () => {
  it("realtor with 0 owned teams → can found first team", async () => {
    const realtor = await makeSession({ role: "realtor", userId: "u_solo" });
    expect(await canCreateFirstTeam(realtor)).toBe(true);
  });

  it("realtor who already owns a team → CANNOT found another", async () => {
    // seedBaseline's realtor is owner of t_test_1
    const { realtor } = await seedBaseline();
    expect(await canCreateFirstTeam(realtor)).toBe(false);
  });

  it("realtor who is only a MEMBER of a team → can still found their own", async () => {
    const team = await seedTeam("t_member_only", "Other agency");
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_member",
      membershipTeams: [{ teamId: team.id, teamRole: "member" }],
    });
    expect(await canCreateFirstTeam(realtor)).toBe(true);
  });

  it("admin → false (admins use canCreateTeam, not the founder path)", async () => {
    const { admin } = await seedBaseline();
    expect(await canCreateFirstTeam(admin)).toBe(false);
  });

  it("staff → false", async () => {
    const { staff } = await seedBaseline();
    expect(await canCreateFirstTeam(staff)).toBe(false);
  });

  it("freelancer → false", async () => {
    const { freelancer } = await seedBaseline();
    expect(await canCreateFirstTeam(freelancer)).toBe(false);
  });
});

// ─── canEditTeam (v1 TeamPolicy::edit line 41-48 / update line 53-60) ─
//   admin OR `$user->id === $team->realtor_id` — staff explicitly excluded
describe("canEditTeam — v1 TeamPolicy::edit/update", () => {
  it("admin can edit any team", async () => {
    const { admin, teams } = await seedBaseline();
    expect(await canEditTeam(admin, teams.t1.id)).toBe(true);
    expect(await canEditTeam(admin, teams.t2.id)).toBe(true);
  });

  it("realtor can edit a team they OWN — v1: $user->id === $team->realtor_id", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(await canEditTeam(realtor, teams.t1.id)).toBe(true);
  });

  it("realtor CANNOT edit a team they don't own (even as a member)", async () => {
    const otherTeam = await seedTeam("t_foreign", "Foreign agency");
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_realtor_member",
      membershipTeams: [{ teamId: otherTeam.id, teamRole: "member" }],
    });
    expect(await canEditTeam(realtor, otherTeam.id)).toBe(false);
  });

  it("staff CANNOT edit teams — v1 explicit (medewerker absent from TeamPolicy::edit)", async () => {
    const { staff, teams } = await seedBaseline();
    expect(await canEditTeam(staff, teams.t1.id)).toBe(false);
  });

  it("freelancer CANNOT edit teams", async () => {
    const { freelancer, teams } = await seedBaseline();
    expect(await canEditTeam(freelancer, teams.t1.id)).toBe(false);
  });
});

// ─── canViewUser (v1 UserPolicy::view line 21-34) ─────────────────────
//   admin = all; medewerker = makelaar/freelancer (NOT admin/medewerker);
//   else nobody. Immo extension: self always visible.
describe("canViewUser — v1 UserPolicy::view", () => {
  it("admin sees every role", async () => {
    const { admin } = await seedBaseline();
    for (const role of ["admin", "staff", "realtor", "freelancer"] as const) {
      expect(canViewUser(admin, { id: `u_other_${role}`, role })).toBe(true);
    }
  });

  it("staff sees realtors — v1: in_array($model->role->name, ['makelaar','freelancer'])", async () => {
    const { staff } = await seedBaseline();
    expect(canViewUser(staff, { id: "u_other_r", role: "realtor" })).toBe(true);
  });

  it("staff sees freelancers", async () => {
    const { staff } = await seedBaseline();
    expect(canViewUser(staff, { id: "u_other_f", role: "freelancer" })).toBe(true);
  });

  it("staff CANNOT see admins — v1 explicit exclusion", async () => {
    const { staff } = await seedBaseline();
    expect(canViewUser(staff, { id: "u_other_a", role: "admin" })).toBe(false);
  });

  it("staff CANNOT see other staff — v1 explicit exclusion", async () => {
    const { staff } = await seedBaseline();
    expect(canViewUser(staff, { id: "u_other_s", role: "staff" })).toBe(false);
  });

  it("realtor CANNOT see arbitrary users — v1 falls through to false", async () => {
    const { realtor } = await seedBaseline();
    expect(canViewUser(realtor, { id: "u_other_r2", role: "realtor" })).toBe(false);
    expect(canViewUser(realtor, { id: "u_other_f", role: "freelancer" })).toBe(false);
  });

  it("freelancer CANNOT see arbitrary users", async () => {
    const { freelancer } = await seedBaseline();
    expect(canViewUser(freelancer, { id: "u_other_r", role: "realtor" })).toBe(false);
    expect(canViewUser(freelancer, { id: "u_other_f", role: "freelancer" })).toBe(false);
  });

  it("self always visible (immo extension over v1)", async () => {
    const { realtor, freelancer } = await seedBaseline();
    expect(canViewUser(realtor, { id: realtor.user.id, role: "realtor" })).toBe(true);
    expect(canViewUser(freelancer, { id: freelancer.user.id, role: "freelancer" })).toBe(true);
  });
});

// ─── canAdminUsers (v1 UserPolicy::{create,update,delete}) ────────────
//   admin only. Staff can VIEW realtors/freelancers but not CRUD them.
describe("canAdminUsers — v1 UserPolicy::{create,update,delete} (admin only)", () => {
  it("admin yes", async () => {
    const { admin } = await seedBaseline();
    expect(canAdminUsers(admin)).toBe(true);
  });

  it("staff NO — v1: medewerker can VIEW but not CRUD users", async () => {
    const { staff } = await seedBaseline();
    expect(canAdminUsers(staff)).toBe(false);
  });

  it("realtor NO", async () => {
    const { realtor } = await seedBaseline();
    expect(canAdminUsers(realtor)).toBe(false);
  });

  it("freelancer NO", async () => {
    const { freelancer } = await seedBaseline();
    expect(canAdminUsers(freelancer)).toBe(false);
  });
});

// ─── userListRoleFilter (derived from canViewUser) ────────────────────
//   Used by /dashboard/users to filter the visible list. Mirrors v1
//   UserPolicy::view with a Prisma where-clause shape.
describe("userListRoleFilter — query filter mirroring canViewUser", () => {
  it("admin → undefined (no filter, sees all)", async () => {
    const { admin } = await seedBaseline();
    expect(userListRoleFilter(admin)).toBeUndefined();
  });

  it("staff → excludes admin + staff", async () => {
    const { staff } = await seedBaseline();
    expect(userListRoleFilter(staff)).toEqual({
      role: { notIn: ["admin", "staff"] },
    });
  });

  it("realtor → excludes ALL roles (effectively empty list)", async () => {
    const { realtor } = await seedBaseline();
    expect(userListRoleFilter(realtor)).toEqual({
      role: { notIn: ["admin", "staff", "realtor", "freelancer"] },
    });
  });

  it("freelancer → excludes ALL roles (effectively empty list)", async () => {
    const { freelancer } = await seedBaseline();
    expect(userListRoleFilter(freelancer)).toEqual({
      role: { notIn: ["admin", "staff", "realtor", "freelancer"] },
    });
  });
});
