import { describe, expect, it } from "vitest";
import {
  createTeamInner,
  updateTeamInner,
  deleteTeamInner,
  removeTeamMemberInner,
  setTeamServiceOverrideInner,
  transferTeamOwnershipInner,
} from "@/app/actions/teams";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedAssignment, seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — team admin:
//   Platform/app/Http/Controllers/TeamController.php
//   Platform/app/Http/Controllers/TeamServiceOverrideController.php
//
// Covers:
//   1. createTeam — permission gate (freelancers rejected), creator becomes owner
//   2. updateTeam — field update + canEditTeam gate
//   3. deleteTeam — blocked when any assignment still references the team
//   4. removeTeamMember — owners can't be removed; regular members ok
//   5. setTeamServiceOverride — money path: upsert/clear/reject, priceCents rules
//   6. transferTeamOwnership — eligible target, demote old owner, role gate

setupTestDb();

function teamForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: "Updated Team Name",
    logo: "TN",
    logoColor: "#0f172a",
    commissionType: "none",
    commissionValue: "",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

describe("createTeamInner — role gate", () => {
  it("admin can create", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ name: "Admin Team" }),
    );
    expect(res.ok).toBe(true);
  });

  it("realtor can create → they become the owner", async () => {
    const { realtor } = await seedBaseline();
    const res = await createTeamInner(
      realtor,
      undefined,
      teamForm({ name: "Realtor's New Team" }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const membership = await prisma.teamMember.findUniqueOrThrow({
      where: {
        teamId_userId: { teamId: res.data.id, userId: realtor.user.id },
      },
    });
    expect(membership.teamRole).toBe("owner");
  });

  it("freelancer rejected", async () => {
    const { freelancer } = await seedBaseline();
    const res = await createTeamInner(freelancer, undefined, teamForm());
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to create teams.",
    });
  });
});

describe("createTeamInner — validation", () => {
  it("empty name → zod rejects", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ name: "" }),
    );
    expect(res).toEqual({ ok: false, error: "Team name is required." });
  });

  it("invalid hex color → zod rejects", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ logoColor: "not-a-color" }),
    );
    expect(res.ok).toBe(false);
  });

  it("commissionType=none → stored as null (NOT the string 'none')", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ name: "No Commission Team", commissionType: "none" }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { commissionType: true, commissionValue: true },
    });
    expect(team.commissionType).toBeNull();
    expect(team.commissionValue).toBeNull();
  });

  it("percentage commission is stored as bps integer", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({
        name: "15 % Commission Team",
        commissionType: "percentage",
        commissionValue: "1500",
      }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const team = await prisma.team.findUniqueOrThrow({
      where: { id: res.data.id },
      select: { commissionType: true, commissionValue: true },
    });
    expect(team).toEqual({ commissionType: "percentage", commissionValue: 1500 });
  });
});

describe("updateTeamInner", () => {
  it("admin can update any team", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await updateTeamInner(
      admin,
      teams.t1.id,
      undefined,
      teamForm({ name: "Renamed by Admin" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.team.findUniqueOrThrow({
      where: { id: teams.t1.id },
      select: { name: true },
    });
    expect(after.name).toBe("Renamed by Admin");
  });

  it("owner-realtor can update their own team", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await updateTeamInner(
      realtor,
      teams.t1.id,
      undefined,
      teamForm({ name: "Realtor-owned Rename" }),
    );
    expect(res).toEqual({ ok: true });
  });

  it("non-owner realtor → rejected", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_outside_edit",
    });
    const res = await updateTeamInner(
      outsider,
      "t_test_1",
      undefined,
      teamForm(),
    );
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to edit this team.",
    });
  });
});

describe("deleteTeamInner", () => {
  it("admin can delete a team with NO assignments", async () => {
    const { admin } = await seedBaseline();
    await seedTeam("t_empty", "Empty Team");
    const res = await deleteTeamInner(admin, "t_empty");
    expect(res).toEqual({ ok: true });
    const after = await prisma.team.findUnique({ where: { id: "t_empty" } });
    expect(after).toBeNull();
  });

  it("team WITH assignments → rejected with count in the message", async () => {
    const { admin, teams } = await seedBaseline();
    await seedAssignment({ id: "a_blocks_delete_1", teamId: teams.t1.id });
    await seedAssignment({ id: "a_blocks_delete_2", teamId: teams.t1.id });
    const res = await deleteTeamInner(admin, teams.t1.id);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/2 assignments on record/);
      expect(res.error).toMatch(/Delete or reassign/);
    }
    // Team still exists.
    const after = await prisma.team.findUnique({ where: { id: teams.t1.id } });
    expect(after).not.toBeNull();
  });

  it("non-existent team → 'Team not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await deleteTeamInner(admin, "t_missing");
    expect(res).toEqual({ ok: false, error: "Team not found." });
  });

  it("realtor (non-admin) rejected when they don't own the team", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_delete_outsider",
    });
    const res = await deleteTeamInner(outsider, "t_test_1");
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to delete this team.",
    });
  });
});

describe("removeTeamMemberInner", () => {
  it("admin removes a regular member → membership deleted + audit", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
    await prisma.teamMember.create({
      data: {
        userId: freelancer.user.id,
        teamId: teams.t1.id,
        teamRole: "member",
      },
    });
    const res = await removeTeamMemberInner(admin, teams.t1.id, freelancer.user.id);
    expect(res).toEqual({ ok: true });
    const after = await prisma.teamMember.findUnique({
      where: {
        teamId_userId: { teamId: teams.t1.id, userId: freelancer.user.id },
      },
    });
    expect(after).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "team.member_removed" },
    });
    expect(audit.objectId).toBe(teams.t1.id);
  });

  it("attempting to remove the owner → blocked with transfer hint", async () => {
    const { admin, teams, realtor } = await seedBaseline();
    // realtor is the seeded owner of t1
    const res = await removeTeamMemberInner(admin, teams.t1.id, realtor.user.id);
    expect(res).toEqual({
      ok: false,
      error: "Transfer ownership to another member before removing the current owner.",
    });
    // Membership still present.
    const ownership = await prisma.teamMember.findUniqueOrThrow({
      where: {
        teamId_userId: { teamId: teams.t1.id, userId: realtor.user.id },
      },
    });
    expect(ownership.teamRole).toBe("owner");
  });

  it("user not on team → 'That user is not on this team.'", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
    const res = await removeTeamMemberInner(admin, teams.t1.id, freelancer.user.id);
    expect(res).toEqual({
      ok: false,
      error: "That user is not on this team.",
    });
  });
});

describe("setTeamServiceOverrideInner — money path", () => {
  it("positive priceCents → upserts the override", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 33_000);
    expect(res).toEqual({ ok: true });
    const override = await prisma.teamServiceOverride.findUniqueOrThrow({
      where: { teamId_serviceKey: { teamId: teams.t1.id, serviceKey: "asbestos" } },
    });
    expect(override.priceCents).toBe(33_000);
  });

  it("updating existing override writes the new priceCents", async () => {
    const { admin, teams } = await seedBaseline();
    await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 30_000);
    await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 35_000);
    const override = await prisma.teamServiceOverride.findUniqueOrThrow({
      where: { teamId_serviceKey: { teamId: teams.t1.id, serviceKey: "asbestos" } },
    });
    expect(override.priceCents).toBe(35_000);
  });

  it("null priceCents → clears the existing override", async () => {
    const { admin, teams } = await seedBaseline();
    await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 33_000);
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", null);
    expect(res).toEqual({ ok: true });
    const override = await prisma.teamServiceOverride.findUnique({
      where: { teamId_serviceKey: { teamId: teams.t1.id, serviceKey: "asbestos" } },
    });
    expect(override).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "team.service_override_removed" },
    });
    expect(audit).toBeTruthy();
  });

  it("clearing a non-existent override is a no-op (ok)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", null);
    expect(res).toEqual({ ok: true });
  });

  it("zero priceCents → rejected with 'use Reset to clear' hint", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 0);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/greater than 0/);
  });

  it("negative priceCents → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", -500);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/greater than 0/);
  });

  it("priceCents > €1M → rejected (typo guard — user probably typed euros not cents)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "asbestos", 2_000_000_00);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/use cents/);
  });

  it("unknown serviceKey → 'Unknown service.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(admin, teams.t1.id, "bogus-key", 10_000);
    expect(res).toEqual({ ok: false, error: "Unknown service." });
  });

  it("permissions — realtor NOT on the team rejected", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_override_outsider",
    });
    const res = await setTeamServiceOverrideInner(
      outsider,
      "t_test_1",
      "asbestos",
      10_000,
    );
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to edit this team's prices.",
    });
  });

  it("emits team.service_override_set audit with serviceKey + priceCents", async () => {
    const { admin, teams } = await seedBaseline();
    await setTeamServiceOverrideInner(admin, teams.t1.id, "epc", 19_999);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "team.service_override_set" },
      select: { metadata: true, objectId: true },
    });
    expect(audit.objectId).toBe(teams.t1.id);
    const meta = auditMeta(audit.metadata);
    expect(meta).toEqual({ serviceKey: "epc", priceCents: 19_999 });
  });
});

describe("transferTeamOwnershipInner", () => {
  async function seedOwnerPlusMember() {
    const { admin, teams, realtor } = await seedBaseline();
    // Seed a second realtor as a team MEMBER to transfer ownership to.
    const newOwner = await makeSession({
      role: "realtor",
      userId: "u_incoming_owner",
      membershipTeams: [{ teamId: teams.t1.id, teamRole: "member" }],
    });
    return { admin, teams, outgoing: realtor, incoming: newOwner };
  }

  it("admin transfers → target becomes owner, previous owner demoted to member", async () => {
    const { admin, teams, outgoing, incoming } = await seedOwnerPlusMember();
    const res = await transferTeamOwnershipInner(
      admin,
      teams.t1.id,
      incoming.user.id,
    );
    expect(res).toEqual({ ok: true });
    const [outgoingMem, incomingMem] = await Promise.all([
      prisma.teamMember.findUniqueOrThrow({
        where: {
          teamId_userId: { teamId: teams.t1.id, userId: outgoing.user.id },
        },
      }),
      prisma.teamMember.findUniqueOrThrow({
        where: {
          teamId_userId: { teamId: teams.t1.id, userId: incoming.user.id },
        },
      }),
    ]);
    expect(outgoingMem.teamRole).toBe("member");
    expect(incomingMem.teamRole).toBe("owner");
  });

  it("current owner-realtor CAN transfer to a member they trust", async () => {
    const { teams, outgoing, incoming } = await seedOwnerPlusMember();
    const res = await transferTeamOwnershipInner(
      outgoing,
      teams.t1.id,
      incoming.user.id,
    );
    expect(res).toEqual({ ok: true });
  });

  it("target not a member → rejected with 'refresh' hint", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await transferTeamOwnershipInner(admin, teams.t1.id, "u_nonmember");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/no longer a member/);
  });

  it("target already is the owner → 'already the team owner'", async () => {
    const { admin, teams, outgoing } = await seedOwnerPlusMember();
    const res = await transferTeamOwnershipInner(
      admin,
      teams.t1.id,
      outgoing.user.id,
    );
    expect(res).toEqual({ ok: false, error: "That user is already the team owner." });
  });

  it("target is a freelancer → rejected (only realtor/admin eligible)", async () => {
    const { admin, teams, freelancer } = await seedBaseline();
    await prisma.teamMember.create({
      data: {
        userId: freelancer.user.id,
        teamId: teams.t1.id,
        teamRole: "member",
      },
    });
    const res = await transferTeamOwnershipInner(
      admin,
      teams.t1.id,
      freelancer.user.id,
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/realtor or admin/);
  });

  it("target is soft-deleted → 'account is deactivated.'", async () => {
    const { admin, teams, incoming } = await seedOwnerPlusMember();
    await prisma.user.update({
      where: { id: incoming.user.id },
      data: { deletedAt: new Date() },
    });
    const res = await transferTeamOwnershipInner(
      admin,
      teams.t1.id,
      incoming.user.id,
    );
    expect(res).toEqual({ ok: false, error: "That account is deactivated." });
  });

  it("outsider realtor (not owner, not admin) → 'no permission'", async () => {
    const { teams, incoming } = await seedOwnerPlusMember();
    await seedTeam("t_outsider_transfer_team", "Outsider Team");
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_transfer_outsider",
      membershipTeams: [
        { teamId: "t_outsider_transfer_team", teamRole: "owner" },
      ],
    });
    const res = await transferTeamOwnershipInner(
      outsider,
      teams.t1.id,
      incoming.user.id,
    );
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to transfer ownership.",
    });
  });

  it("emits team.ownership_transferred audit with new owner metadata", async () => {
    const { admin, teams, incoming } = await seedOwnerPlusMember();
    await transferTeamOwnershipInner(admin, teams.t1.id, incoming.user.id);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "team.ownership_transferred" },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.newOwnerUserId).toBe(incoming.user.id);
    expect(meta.newOwnerName).toBeTruthy();
  });
});
