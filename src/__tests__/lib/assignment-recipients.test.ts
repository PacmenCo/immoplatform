import { describe, expect, it } from "vitest";
import {
  collectAgencyRecipients,
  loadUser,
} from "@/lib/assignment-recipients";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedBaseline, seedTeam } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Recipient-routing logic for assignment-lifecycle emails. A silent drift
// here means notifications go to the wrong user (privacy leak) or
// self-email the actor (spam).
//
// Contract:
//   - Agency side = creator + team OWNERS (NOT members)
//   - Soft-deleted users are filtered out
//   - `exclude` set removes the actor from the output
//   - null teamId or createdById must NOT widen the match to "everyone"

setupTestDb();

describe("collectAgencyRecipients — the core dedupe + scope", () => {
  it("includes team owner + creator; excludes actor id in `exclude`", async () => {
    const { realtor, teams } = await seedBaseline();
    // realtor is owner of t1 (see seedBaseline). creator is a separate user
    // on the same team as member.
    const creator = await makeSession({
      role: "realtor",
      userId: "u_asg_creator",
      membershipTeams: [{ teamId: teams.t1.id, teamRole: "member" }],
    });
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: creator.user.id,
      exclude: [],
    });
    const ids = recipients.map((r) => r.id).sort();
    expect(ids).toContain(realtor.user.id); // owner
    expect(ids).toContain(creator.user.id); // creator
    expect(ids).toHaveLength(2);
  });

  it("`exclude` removes the actor so they don't self-email", async () => {
    const { realtor, teams } = await seedBaseline();
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: realtor.user.id,
      exclude: [realtor.user.id],
    });
    expect(recipients).toEqual([]);
  });

  it("creator who is ALSO the owner appears once (dedupe)", async () => {
    const { realtor, teams } = await seedBaseline();
    // realtor is both owner of t1 AND the creator.
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: realtor.user.id,
      exclude: [],
    });
    expect(recipients.map((r) => r.id)).toEqual([realtor.user.id]);
  });

  it("team MEMBERS (non-owner) are NOT included", async () => {
    const { realtor, teams } = await seedBaseline();
    const plainMember = await makeSession({
      role: "realtor",
      userId: "u_plain_member",
      membershipTeams: [{ teamId: teams.t1.id, teamRole: "member" }],
    });
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: null,
      exclude: [],
    });
    // Only the owner (realtor), not plainMember.
    expect(recipients.map((r) => r.id)).toEqual([realtor.user.id]);
    expect(recipients.map((r) => r.id)).not.toContain(plainMember.user.id);
  });

  it("null teamId + valid createdById → returns just the creator", async () => {
    const { realtor } = await seedBaseline();
    const recipients = await collectAgencyRecipients({
      teamId: null,
      createdById: realtor.user.id,
      exclude: [],
    });
    expect(recipients.map((r) => r.id)).toEqual([realtor.user.id]);
  });

  it("null createdById + valid teamId → returns just the owner(s)", async () => {
    const { realtor, teams } = await seedBaseline();
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: null,
      exclude: [],
    });
    expect(recipients.map((r) => r.id)).toEqual([realtor.user.id]);
  });

  it("null teamId AND null createdById → empty array (never fan out to all users)", async () => {
    await seedBaseline();
    const recipients = await collectAgencyRecipients({
      teamId: null,
      createdById: null,
      exclude: [],
    });
    expect(recipients).toEqual([]);
  });

  it("soft-deleted creator is filtered out", async () => {
    const { realtor, teams } = await seedBaseline();
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { deletedAt: new Date() },
    });
    const recipients = await collectAgencyRecipients({
      teamId: teams.t1.id,
      createdById: realtor.user.id,
      exclude: [],
    });
    expect(recipients).toEqual([]);
  });

  it("multiple owners on the same team all appear", async () => {
    const { teams } = await seedBaseline();
    await seedTeam("t_multi_owner", "Multi Owner Team");
    const a = await makeSession({
      role: "realtor",
      userId: "u_owner_a",
      membershipTeams: [{ teamId: "t_multi_owner", teamRole: "owner" }],
    });
    const b = await makeSession({
      role: "admin",
      userId: "u_owner_b",
      membershipTeams: [{ teamId: "t_multi_owner", teamRole: "owner" }],
    });
    void teams;
    const recipients = await collectAgencyRecipients({
      teamId: "t_multi_owner",
      createdById: null,
      exclude: [],
    });
    expect(recipients.map((r) => r.id).sort()).toEqual(
      [a.user.id, b.user.id].sort(),
    );
  });

  it("returned shape has exactly 6 fields (id/email/emailPrefs/firstName/lastName/locale)", async () => {
    const { realtor } = await seedBaseline();
    const [row] = await collectAgencyRecipients({
      teamId: null,
      createdById: realtor.user.id,
      exclude: [],
    });
    expect(Object.keys(row).sort()).toEqual(
      ["email", "emailPrefs", "firstName", "id", "lastName", "locale"],
    );
    // Don't leak passwordHash, role, timestamps etc into notification payloads.
    expect(row).not.toHaveProperty("passwordHash");
    expect(row).not.toHaveProperty("role");
  });
});

describe("loadUser", () => {
  it("valid id → returns the recipient shape", async () => {
    const { realtor } = await seedBaseline();
    const row = await loadUser(realtor.user.id);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(realtor.user.id);
    expect(row!.email).toBe(realtor.user.email);
    expect(Object.keys(row!).sort()).toEqual(
      ["email", "emailPrefs", "firstName", "id", "lastName", "locale"],
    );
  });

  it("null id → null (no DB query)", async () => {
    await seedBaseline();
    expect(await loadUser(null)).toBeNull();
  });

  it("unknown id → null", async () => {
    await seedBaseline();
    expect(await loadUser("u_ghost")).toBeNull();
  });
});
