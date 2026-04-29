import { describe, expect, it } from "vitest";
import {
  createTeamInner,
  updateTeamInner,
  deleteTeamInner,
  removeTeamMemberInner,
  setTeamServiceOverrideInner,
  transferTeamOwnershipInner,
} from "@/app/actions/teams";
import { makeTeamBrandingKey, storage } from "@/lib/storage";
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

  it("realtor with an existing owned team rejected — founder grant already used", async () => {
    // seedBaseline's realtor owns t_test_1 → no founder grant remains.
    const { realtor } = await seedBaseline();
    const res = await createTeamInner(
      realtor,
      undefined,
      teamForm({ name: "Realtor's Second Team" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to create teams.",
    });
  });

  it("staff rejected — v1 parity (admin-only)", async () => {
    const { staff } = await seedBaseline();
    const res = await createTeamInner(staff, undefined, teamForm());
    expect(res).toEqual({
      ok: false,
      error: "You don't have permission to create teams.",
    });
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

describe("createTeamInner — realtor founder flow", () => {
  // v1+1 enhancement: a realtor who owns zero teams may bootstrap their
  // own. Mirrors v1's "agency owner contacts admin" path, but self-serve.
  // Capped at one to prevent realtor team proliferation — a realtor with
  // one owned team falls back to admin-only for any subsequent team.

  it("realtor with zero owned teams can create their first", async () => {
    await import("../_helpers/fixtures").then((m) => m.seedServices());
    const founder = await makeSession({
      role: "realtor",
      userId: "u_founder",
      // Deliberately no membershipTeams — they're freshly self-registered.
    });
    const res = await createTeamInner(
      founder,
      undefined,
      teamForm({ name: "Founder's First Office" }),
    );
    expect(res.ok).toBe(true);
  });

  it("realtor on someone else's team (no ownership) can still bootstrap their own", async () => {
    // Mirrors a realtor who freelances at one agency and starts their own
    // on the side. v1's `isInvitee()` lets them pass the team-membership
    // gate; the founder grant lets them ALSO create their own office.
    await import("../_helpers/fixtures").then((m) => m.seedServices());
    const otherTeam = await seedTeam("t_other", "Other Agency");
    const founder = await makeSession({
      role: "realtor",
      userId: "u_invitee_founder",
      membershipTeams: [{ teamId: otherTeam.id, teamRole: "member" }],
    });
    const res = await createTeamInner(
      founder,
      undefined,
      teamForm({ name: "Side Hustle Office" }),
    );
    expect(res.ok).toBe(true);
  });

  it("realtor cannot create a second team after their founder grant is spent", async () => {
    await import("../_helpers/fixtures").then((m) => m.seedServices());
    const founder = await makeSession({
      role: "realtor",
      userId: "u_2x_founder",
    });
    // First create succeeds.
    const first = await createTeamInner(
      founder,
      undefined,
      teamForm({ name: "First Office" }),
    );
    expect(first.ok).toBe(true);
    // Second create rejected — they now own a team, founder grant spent.
    const second = await createTeamInner(
      founder,
      undefined,
      teamForm({ name: "Second Office" }),
    );
    expect(second).toEqual({
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

  it("realtor rejected even when they own the team (admin-only per v1)", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await deleteTeamInner(realtor, teams.t1.id);
    expect(res).toEqual({
      ok: false,
      error: "Only admins can delete teams.",
    });
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
      error: "Only admins can delete teams.",
    });
  });

  it("drops logo + signature bytes from storage on successful delete", async () => {
    const { admin } = await seedBaseline();
    await seedTeam("t_branded", "Branded Team");
    const logoKey = makeTeamBrandingKey({
      teamId: "t_branded",
      kind: "logo",
      version: "v0",
      ext: "png",
    });
    const sigKey = makeTeamBrandingKey({
      teamId: "t_branded",
      kind: "signature",
      version: "v0",
      ext: "png",
    });
    await storage().put(logoKey, Buffer.from("fake-logo"), { mimeType: "image/png" });
    await storage().put(sigKey, Buffer.from("fake-sig"), { mimeType: "image/png" });
    await prisma.team.update({
      where: { id: "t_branded" },
      data: { logoUrl: logoKey, signatureUrl: sigKey },
    });
    expect(await storage().exists(logoKey)).toBe(true);
    expect(await storage().exists(sigKey)).toBe(true);

    const res = await deleteTeamInner(admin, "t_branded");
    expect(res).toEqual({ ok: true });

    expect(await storage().exists(logoKey)).toBe(false);
    expect(await storage().exists(sigKey)).toBe(false);
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

  it("permissions — realtor rejected even when they own the team (admin-only per v1)", async () => {
    const { realtor, teams } = await seedBaseline();
    const res = await setTeamServiceOverrideInner(
      realtor,
      teams.t1.id,
      "asbestos",
      10_000,
    );
    expect(res).toEqual({
      ok: false,
      error: "Only admins can change team price overrides.",
    });
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
      error: "Only admins can change team price overrides.",
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

  it("current owner-realtor REJECTED — v1 parity (no transfer mechanism in v1, admin-only in v2)", async () => {
    const { teams, outgoing, incoming } = await seedOwnerPlusMember();
    const res = await transferTeamOwnershipInner(
      outgoing,
      teams.t1.id,
      incoming.user.id,
    );
    expect(res).toEqual({
      ok: false,
      error: "Only admins can transfer team ownership.",
    });
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
      error: "Only admins can transfer team ownership.",
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

// Gap-fill from flow-parity batch 3 — the realtor-team-branding scenario
// verified via Playwright that every v1-equivalent branding field round-
// trips through updateTeamInner. Existing tests in this file only assert
// `name` persists; the branding fields are a parity contract worth
// pinning down so a future refactor doesn't silently drop one.

describe("updateTeamInner — branding field round-trip", () => {
  it("persists every branding field on a single save (legalName, VAT, KBO, IBAN, billing*, defaultClientType, prefersLogoOnPhotos)", async () => {
    const { admin, teams } = await seedBaseline();
    const fd = teamForm({
      name: "Branded Team",
      description: "A description with newlines\nand stuff.",
      legalName: "Vastgoed Antwerp BV",
      vatNumber: "BE0123456789",
      kboNumber: "0123.456.789",
      iban: "BE68539007547034",
      billingEmail: "billing@example.test",
      billingPhone: "+32 470 12 34 56",
      billingAddress: "Rue de la Loi 1",
      billingPostal: "1000",
      billingCity: "Brussels",
      billingCountry: "Belgium",
      defaultClientType: "firm",
      prefersLogoOnPhotos: "on",
    });
    const res = await updateTeamInner(admin, teams.t1.id, undefined, fd);
    expect(res).toEqual({ ok: true });
    const after = await prisma.team.findUniqueOrThrow({
      where: { id: teams.t1.id },
      select: {
        legalName: true,
        vatNumber: true,
        kboNumber: true,
        iban: true,
        billingEmail: true,
        billingPhone: true,
        billingAddress: true,
        billingPostal: true,
        billingCity: true,
        billingCountry: true,
        defaultClientType: true,
        prefersLogoOnPhotos: true,
        description: true,
      },
    });
    expect(after).toEqual({
      legalName: "Vastgoed Antwerp BV",
      vatNumber: "BE0123456789",
      kboNumber: "0123.456.789",
      iban: "BE68539007547034",
      billingEmail: "billing@example.test",
      billingPhone: "+32 470 12 34 56",
      billingAddress: "Rue de la Loi 1",
      billingPostal: "1000",
      billingCity: "Brussels",
      billingCountry: "Belgium",
      defaultClientType: "firm",
      prefersLogoOnPhotos: true,
      description: "A description with newlines\nand stuff.",
    });
  });

  it("empty branding fields are stored as null (not empty string) for clean optional-field handling", async () => {
    const { admin, teams } = await seedBaseline();
    // First populate, then clear in a second save.
    await updateTeamInner(
      admin,
      teams.t1.id,
      undefined,
      teamForm({ legalName: "Initial", vatNumber: "BE0000" }),
    );
    const cleared = await updateTeamInner(
      admin,
      teams.t1.id,
      undefined,
      teamForm({ legalName: "", vatNumber: "" }),
    );
    expect(cleared).toEqual({ ok: true });
    const after = await prisma.team.findUniqueOrThrow({
      where: { id: teams.t1.id },
      select: { legalName: true, vatNumber: true },
    });
    expect(after).toEqual({ legalName: null, vatNumber: null });
  });
});
