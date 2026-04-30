import { describe, expect, it } from "vitest";
import {
  canViewAssignment,
  canEditAssignment,
  canUpdateAssignmentFields,
  canCompleteAssignment,
  canCancelAssignment,
  canDeleteAssignment,
  canReassignFreelancer,
  canViewAssignmentPricing,
  canViewCommission,
  assignmentScope,
  getUserTeamIds,
  hasRole,
} from "@/lib/permissions";
import { prisma, setupTestDb } from "../_helpers/db";
import { makeSession } from "../_helpers/session";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";

// Integration-tier permission coverage — exercises the helpers against a
// seeded DB (team memberships, session rows, etc) rather than mocking the
// lookups. Platform parity:
//   - AssignmentPolicy.php (view, edit, delete, cancel, complete)
//   - RolePermission rules in the blade templates + controller gates
//
// Scoped by role:
//   admin  → all rows
//   staff  → all rows (but can't delete — Platform deviation kept)
//   realtor → creator OR team-owner; can't complete a foreign team's row
//   freelancer → only rows they're assigned to, only field subset

setupTestDb();

const POLICY_INPUT = (overrides: Partial<{
  teamId: string | null;
  freelancerId: string | null;
  createdById: string | null;
}> = {}) => ({
  teamId: null,
  freelancerId: null,
  createdById: null,
  ...overrides,
});

describe("canViewAssignment", () => {
  it("admin sees every row regardless of scope", async () => {
    const { admin } = await seedBaseline();
    expect(
      await canViewAssignment(admin, POLICY_INPUT({ teamId: "stranger-team" })),
    ).toBe(true);
  });

  it("staff sees every row too", async () => {
    const { staff } = await seedBaseline();
    expect(
      await canViewAssignment(staff, POLICY_INPUT({ teamId: "stranger-team" })),
    ).toBe(true);
  });

  it("realtor sees their own team's rows", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(
      await canViewAssignment(realtor, POLICY_INPUT({ teamId: teams.t1.id })),
    ).toBe(true);
  });

  it("realtor sees rows they created, even if team membership changed", async () => {
    const { realtor } = await seedBaseline();
    expect(
      await canViewAssignment(
        realtor,
        POLICY_INPUT({ teamId: "foreign-team", createdById: realtor.user.id }),
      ),
    ).toBe(true);
  });

  it("realtor does NOT see a foreign team's unrelated row", async () => {
    const { realtor } = await seedBaseline();
    expect(
      await canViewAssignment(realtor, POLICY_INPUT({ teamId: "foreign-team" })),
    ).toBe(false);
  });

  it("freelancer sees rows they're assigned to", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canViewAssignment(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(true);
  });

  it("freelancer sees rows for teams they are members of", async () => {
    await seedBaseline();
    const teamedFreelancer = await makeSession({
      role: "freelancer",
      userId: "u_teamed_freelancer",
      membershipTeams: [{ teamId: "t_test_1", teamRole: "member" }],
    });
    expect(
      await canViewAssignment(
        teamedFreelancer,
        POLICY_INPUT({ teamId: "t_test_1" }),
      ),
    ).toBe(true);
  });

  it("freelancer does NOT see unrelated rows", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canViewAssignment(
        freelancer,
        POLICY_INPUT({ teamId: "foreign-team", freelancerId: "u_someone_else" }),
      ),
    ).toBe(false);
  });
});

describe("canEditAssignment", () => {
  it("admin + staff always can edit", async () => {
    const { admin, staff } = await seedBaseline();
    expect(await canEditAssignment(admin, POLICY_INPUT())).toBe(true);
    expect(await canEditAssignment(staff, POLICY_INPUT())).toBe(true);
  });

  it("freelancer can edit their own assigned row", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canEditAssignment(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(true);
  });

  it("freelancer CANNOT edit rows they're not assigned to", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canEditAssignment(
        freelancer,
        POLICY_INPUT({ freelancerId: "u_other_freelancer" }),
      ),
    ).toBe(false);
  });

  it("realtor edits rows they own (creator or team-owner)", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(
      await canEditAssignment(realtor, POLICY_INPUT({ teamId: teams.t1.id })),
    ).toBe(true);
  });

  it("realtor with only `member` membership can't edit (owner-only)", async () => {
    await seedBaseline();
    await seedTeam("t_member_only", "Member Only Team");
    const memberRealtor = await makeSession({
      role: "realtor",
      userId: "u_member_realtor",
      membershipTeams: [{ teamId: "t_member_only", teamRole: "member" }],
    });
    expect(
      await canEditAssignment(
        memberRealtor,
        POLICY_INPUT({ teamId: "t_member_only" }),
      ),
    ).toBe(false);
  });
});

describe("canUpdateAssignmentFields (narrow edit)", () => {
  it("freelancer NEVER has field-edit permission (even on their own row)", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canUpdateAssignmentFields(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(false);
  });

  it("admin has field-edit permission (delegates to canEditAssignment)", async () => {
    const { admin } = await seedBaseline();
    expect(await canUpdateAssignmentFields(admin, POLICY_INPUT())).toBe(true);
  });

  it("realtor-owner has field-edit permission", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(
      await canUpdateAssignmentFields(
        realtor,
        POLICY_INPUT({ teamId: teams.t1.id }),
      ),
    ).toBe(true);
  });
});

describe("canCompleteAssignment", () => {
  it("admin + staff can always complete", async () => {
    const { admin, staff } = await seedBaseline();
    expect(await canCompleteAssignment(admin, POLICY_INPUT())).toBe(true);
    expect(await canCompleteAssignment(staff, POLICY_INPUT())).toBe(true);
  });

  it("freelancer can self-complete on assigned rows (Platform markFinished parity)", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canCompleteAssignment(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(true);
  });

  it("realtor-owner can complete their team's rows", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(
      await canCompleteAssignment(
        realtor,
        POLICY_INPUT({ teamId: teams.t1.id }),
      ),
    ).toBe(true);
  });
});

describe("canCancelAssignment", () => {
  it("admin + staff can always cancel", async () => {
    const { admin, staff } = await seedBaseline();
    expect(await canCancelAssignment(admin, POLICY_INPUT())).toBe(true);
    expect(await canCancelAssignment(staff, POLICY_INPUT())).toBe(true);
  });

  it("freelancer CANNOT cancel, even on their own row", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canCancelAssignment(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(false);
  });

  it("realtor-owner can cancel (matches cancel-policy action test)", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(
      await canCancelAssignment(
        realtor,
        POLICY_INPUT({ teamId: teams.t1.id }),
      ),
    ).toBe(true);
  });
});

describe("canDeleteAssignment", () => {
  it("admin can delete any status", async () => {
    const { admin } = await seedBaseline();
    expect(
      await canDeleteAssignment(admin, {
        ...POLICY_INPUT(),
        status: "completed",
      }),
    ).toBe(true);
  });

  it("staff CANNOT delete (explicit Platform exclusion)", async () => {
    const { staff } = await seedBaseline();
    expect(
      await canDeleteAssignment(staff, { ...POLICY_INPUT(), status: "draft" }),
    ).toBe(false);
  });

  it("freelancer CANNOT delete", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canDeleteAssignment(freelancer, {
        ...POLICY_INPUT({ freelancerId: freelancer.user.id }),
        status: "draft",
      }),
    ).toBe(false);
  });

  it("realtor can delete their own row in deletable statuses", async () => {
    const { realtor } = await seedBaseline();
    for (const status of ["draft", "scheduled", "in_progress", "cancelled"]) {
      expect(
        await canDeleteAssignment(realtor, {
          ...POLICY_INPUT({ createdById: realtor.user.id }),
          status,
        }),
      ).toBe(true);
    }
  });

  it("realtor CANNOT delete completed / delivered rows (keep the audit trail)", async () => {
    const { realtor } = await seedBaseline();
    for (const status of ["completed", "delivered"]) {
      expect(
        await canDeleteAssignment(realtor, {
          ...POLICY_INPUT({ createdById: realtor.user.id }),
          status,
        }),
      ).toBe(false);
    }
  });

  it("team-owner realtor CANNOT delete a teammate's row (only the creator can)", async () => {
    const { realtor, teams } = await seedBaseline();
    // realtor owns teams.t1 but did NOT create this assignment (createdById is
    // someone else on the team). Per the tightened gate, owning the team is
    // no longer enough — only the actual creator can delete.
    expect(
      await canDeleteAssignment(realtor, {
        ...POLICY_INPUT({ teamId: teams.t1.id, createdById: "other-teammate-id" }),
        status: "draft",
      }),
    ).toBe(false);
  });
});

describe("canReassignFreelancer", () => {
  it("admin + staff only — realtor + freelancer denied", async () => {
    const { admin, staff, realtor, freelancer } = await seedBaseline();
    expect(canReassignFreelancer(admin)).toBe(true);
    expect(canReassignFreelancer(staff)).toBe(true);
    expect(canReassignFreelancer(realtor)).toBe(false);
    expect(canReassignFreelancer(freelancer)).toBe(false);
  });
});

describe("canViewAssignmentPricing (invoice visibility)", () => {
  it("admin + staff always see pricing", async () => {
    const { admin, staff } = await seedBaseline();
    expect(await canViewAssignmentPricing(admin, POLICY_INPUT())).toBe(true);
    expect(await canViewAssignmentPricing(staff, POLICY_INPUT())).toBe(true);
  });

  it("freelancer NEVER sees pricing (paid via commission, not invoice)", async () => {
    const { freelancer } = await seedBaseline();
    expect(
      await canViewAssignmentPricing(
        freelancer,
        POLICY_INPUT({ freelancerId: freelancer.user.id }),
      ),
    ).toBe(false);
  });

  it("realtor-member (not creator, not owner) can still view via team-scope", async () => {
    // canViewAssignmentPricing uses `all` team ids (any membership),
    // not just `owned` — a realtor who's a member of the team sees prices.
    await seedBaseline();
    await seedTeam("t_member_pricing", "Pricing View Team");
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_member_pricing",
      membershipTeams: [{ teamId: "t_member_pricing", teamRole: "member" }],
    });
    expect(
      await canViewAssignmentPricing(
        realtor,
        POLICY_INPUT({ teamId: "t_member_pricing" }),
      ),
    ).toBe(true);
  });
});

describe("canViewCommission", () => {
  it("admin + staff see any team's commission page", async () => {
    const { admin, staff, teams } = await seedBaseline();
    expect(await canViewCommission(admin, teams.t1.id)).toBe(true);
    expect(await canViewCommission(staff, teams.t2.id)).toBe(true);
  });

  it("realtor OWNER sees their own team's commission", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(await canViewCommission(realtor, teams.t1.id)).toBe(true);
  });

  it("realtor owner does NOT see a foreign team's commission", async () => {
    const { realtor, teams } = await seedBaseline();
    expect(await canViewCommission(realtor, teams.t2.id)).toBe(false);
  });

  it("freelancer NEVER sees commission", async () => {
    const { freelancer, teams } = await seedBaseline();
    expect(await canViewCommission(freelancer, teams.t1.id)).toBe(false);
  });
});

describe("assignmentScope (query filter)", () => {
  it("admin → undefined (unfiltered)", async () => {
    const { admin } = await seedBaseline();
    expect(await assignmentScope(admin)).toBeUndefined();
  });

  it("staff → undefined (unfiltered, same as admin)", async () => {
    const { staff } = await seedBaseline();
    expect(await assignmentScope(staff)).toBeUndefined();
  });

  it("realtor → OR(createdById | teamId in memberships)", async () => {
    const { realtor, teams } = await seedBaseline();
    const scope = await assignmentScope(realtor);
    expect(scope).toEqual({
      OR: [
        { createdById: realtor.user.id },
        { teamId: { in: [teams.t1.id] } },
      ],
    });
  });

  it("freelancer → strictly { freelancerId: self } (v1 parity, no team union)", async () => {
    // Mirrors v1's `where('freelancer_id', $user->id)` in
    // Platform/app/Livewire/AssignmentsList.php:233. Even if a stale
    // teamMember row exists for a freelancer (legacy DB state pre-fix),
    // they shouldn't see team-wide assignments — freelancers are
    // platform-global workers, not team participants.
    const { freelancer } = await seedBaseline();
    const scope = await assignmentScope(freelancer);
    expect(scope).toEqual({ freelancerId: freelancer.user.id });
  });

  it("freelancer with a stale team_member row → STILL strictly assigned-to-me", async () => {
    // Defensive: stale data must not leak scope. Insert a freelancer onto
    // a team manually (bypassing the invite guards) and verify the scope
    // helper still returns strict assigned-to-me.
    const { freelancer, teams } = await seedBaseline();
    await prisma.teamMember.create({
      data: {
        teamId: teams.t1.id,
        userId: freelancer.user.id,
        teamRole: "member",
      },
    });
    const scope = await assignmentScope(freelancer);
    expect(scope).toEqual({ freelancerId: freelancer.user.id });
  });
});

describe("hasRole", () => {
  it("matches the session role exactly", async () => {
    const { admin, freelancer } = await seedBaseline();
    expect(hasRole(admin, "admin")).toBe(true);
    expect(hasRole(admin, "staff")).toBe(false);
    expect(hasRole(freelancer, "freelancer")).toBe(true);
  });

  it("accepts multiple roles (OR semantics)", async () => {
    const { staff } = await seedBaseline();
    expect(hasRole(staff, "admin", "staff")).toBe(true);
    expect(hasRole(staff, "realtor", "freelancer")).toBe(false);
  });
});

// `getUserTeamIds` powers the dashboard layout's realtor-no-team gate
// (`src/app/dashboard/layout.tsx:30-33`). Flow-parity batch 5 exercised the
// gate end-to-end via Playwright; these unit tests cover the underlying
// logic so a regression doesn't silently let a teamless realtor onto the
// dashboard.
describe("getUserTeamIds", () => {
  it("realtor with no team membership → all=[] and owned=[]", async () => {
    await seedBaseline();
    const lone = await makeSession({
      role: "realtor",
      userId: "u_lone_realtor_perm_test",
    });
    const result = await getUserTeamIds(lone.user.id);
    expect(result.all).toEqual([]);
    expect(result.owned).toEqual([]);
  });

  it("realtor-owner gets the team in BOTH all and owned", async () => {
    const { realtor, teams } = await seedBaseline();
    const result = await getUserTeamIds(realtor.user.id);
    expect(result.all).toContain(teams.t1.id);
    expect(result.owned).toContain(teams.t1.id);
  });

  it("realtor-member (not owner) gets the team in `all` but NOT in `owned`", async () => {
    await seedBaseline();
    await seedTeam("t_member_perm_test", "Member-Only Team");
    const memberRealtor = await makeSession({
      role: "realtor",
      userId: "u_member_realtor_perm_test",
      membershipTeams: [{ teamId: "t_member_perm_test", teamRole: "member" }],
    });
    const result = await getUserTeamIds(memberRealtor.user.id);
    expect(result.all).toContain("t_member_perm_test");
    expect(result.owned).not.toContain("t_member_perm_test");
  });

  it("freelancer with no team → all=[] (no-team gate doesn't apply but the helper still works)", async () => {
    const { freelancer } = await seedBaseline();
    // Seed baseline's freelancer is intentionally team-less.
    const result = await getUserTeamIds(freelancer.user.id);
    expect(result.all).toEqual([]);
  });

  it("admin without memberships → all=[] (admins bypass the gate via hasRole, not via memberships)", async () => {
    const { admin } = await seedBaseline();
    const result = await getUserTeamIds(admin.user.id);
    expect(result.all).toEqual([]);
  });
});
