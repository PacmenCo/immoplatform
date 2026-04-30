/**
 * Idempotent bootstrap of the 3 `@immo.test` switcher fixtures + their
 * hosting team. Used to enable the production account switcher (see
 * CLAUDE.md → "Account switcher").
 *
 * Each test user is given a freshly-generated random bcrypt hash that no
 * input can match, then the plaintext is discarded. Combined with
 * `loginInner`'s `@immo.test`-domain refusal on prod, these accounts are
 * reachable only via `switchToAccount` from the founder's session.
 *
 * Why not just run `prisma db seed` on prod?
 *   The full seed creates demo teams, assignments, comments, calendar
 *   fixtures, etc. (1100+ lines of data). This script touches only what
 *   the switcher actually needs: 3 users + 1 team + 1 membership. Safe to
 *   re-run — every row is upserted by primary key.
 *
 * Usage on the droplet:
 *   cd /opt/immoplatform/app
 *   sudo -u immo bash -c 'set -a; source .env.production; set +a; \
 *     npx tsx scripts/bootstrap-test-users.ts'
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import {
  ClientType,
  CommissionType,
  PrismaClient,
  Role,
  TeamRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function unguessableHash(): Promise<string> {
  // 384 bits of entropy → bcrypt-compare against any user input is
  // computationally indistinguishable from impossible.
  const random = randomBytes(48).toString("base64");
  return bcrypt.hash(random, 12);
}

async function main() {
  console.log("Bootstrapping account-switcher test users…");

  await prisma.team.upsert({
    where: { id: "t_test" },
    create: {
      id: "t_test",
      name: "Test Switcher Team",
      city: "Test City",
      logo: "TS",
      logoColor: "#475569",
      legalName: "Test Switcher Team BV",
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
    },
    update: {},
  });
  console.log("  ✓ team t_test");

  const users = [
    {
      id: "u_test_staff",
      email: "test-staff@immo.test",
      firstName: "Test",
      lastName: "Staff",
      role: Role.staff,
      region: "Belgium",
      bio: "Switcher fixture — staff role.",
    },
    {
      id: "u_test_realtor",
      email: "test-realtor@immo.test",
      firstName: "Test",
      lastName: "Realtor",
      role: Role.realtor,
      region: "Antwerp",
      bio: "Switcher fixture — realtor on the test switcher team.",
    },
    {
      id: "u_test_freelancer",
      email: "test-freelancer@immo.test",
      firstName: "Test",
      lastName: "Freelancer",
      role: Role.freelancer,
      region: "Antwerp",
      bio: "Switcher fixture — freelancer role.",
    },
  ];

  for (const u of users) {
    const passwordHash = await unguessableHash();
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        ...u,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      // Rotate the unguessable hash on every run AND keep the profile in
      // sync with this script's source of truth (role, region, bio). Email
      // is never updated to avoid colliding with a hypothetical real user
      // who happened to claim the same id (defensive — shouldn't happen).
      update: {
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        region: u.region,
        bio: u.bio,
      },
    });
    console.log(`  ✓ ${u.email}`);
  }

  await prisma.teamMember.upsert({
    where: {
      teamId_userId: { teamId: "t_test", userId: "u_test_realtor" },
    },
    create: {
      teamId: "t_test",
      userId: "u_test_realtor",
      teamRole: TeamRole.owner,
    },
    update: {},
  });
  console.log("  ✓ test-realtor membership in t_test");

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
