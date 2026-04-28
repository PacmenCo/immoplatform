// One-shot fixture seeder for the E2E playwright run.
// Adds:
//   - founder@e2e.local (realtor with NO team) — for the founder-flow test
//   - One assignment in `in_progress` status assigned to Tim (u_3) — for the
//     mark/unmark-delivered toggle test (status flips need a stable starting row)
//
// Idempotent: re-running upserts the user and ensures one matching assignment.

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PASSWORD = "Jordan1234";
const FOUNDER_EMAIL = "founder@e2e.local";

(async () => {
  const hash = await bcrypt.hash(PASSWORD, 12);

  // 1) Team-less realtor for founder-flow test
  await prisma.user.upsert({
    where: { email: FOUNDER_EMAIL },
    create: {
      id: "u_e2e_founder",
      email: FOUNDER_EMAIL,
      passwordHash: hash,
      firstName: "Founder",
      lastName: "Test",
      role: "realtor",
      emailVerifiedAt: new Date(),
    },
    update: { passwordHash: hash, role: "realtor" },
  });
  // Defensive: ensure NO teamMember rows exist for this user (re-runs may
  // accumulate). The founder flow only triggers when memberships === 0.
  await prisma.teamMember.deleteMany({
    where: { userId: "u_e2e_founder" },
  });
  // Also remove any team they might have created on a previous E2E run so
  // canCreateFirstTeam returns true again.
  await prisma.team.deleteMany({
    where: { name: { startsWith: "E2E Founder Office" } },
  });

  // 2) Ensure Tim (u_3) has at least one in_progress E2E-TOGGLE assignment.
  //    Tests advance the status (in_progress → delivered → completed); rather
  //    than create a new row each run, RESET any existing E2E-TOGGLE-* row
  //    for Tim back to in_progress so the helper's selectors stay stable.
  const reset = await prisma.assignment.updateMany({
    where: {
      freelancerId: "u_3",
      reference: { startsWith: "E2E-TOGGLE-" },
    },
    data: { status: "in_progress", deliveredAt: null, completedAt: null },
  });
  if (reset.count > 0) {
    console.log(`✅ Reset ${reset.count} E2E-TOGGLE assignment(s) to in_progress`);
  } else {
    const refSlug = `E2E-TOGGLE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await prisma.assignment.create({
      data: {
        reference: refSlug,
        status: "in_progress",
        address: "1 Toggleweg",
        city: "Antwerpen",
        postal: "2000",
        propertyType: "apartment",
        ownerName: "E2E Toggle Owner",
        teamId: "t_01",
        freelancerId: "u_3",
        createdById: "u_2",   // Els (realtor owner of t_01)
        services: {
          create: [{ serviceKey: "asbestos", unitPriceCents: 25000 }],
        },
      },
    });
    console.log(`✅ Created in_progress assignment ${refSlug} for Tim (u_3)`);
  }

  console.log(`\n✅ E2E fixtures ready`);
  console.log(`   Founder login: ${FOUNDER_EMAIL} / ${PASSWORD}`);
  console.log(`   Freelancer login: tim@immo.be / ${PASSWORD}`);
  console.log(`   Admin login: jordan@asbestexperts.be / ${PASSWORD}\n`);

  await prisma.$disconnect();
})();
