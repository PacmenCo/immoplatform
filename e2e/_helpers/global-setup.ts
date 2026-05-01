import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

/**
 * Playwright globalSetup — runs once before any test in the session.
 *
 * Mirrors `scripts/seed-e2e-fixtures.ts` but runs in-process so we don't
 * shell out. Ensures every test session starts with:
 *  - founder@e2e.local (realtor with NO team)
 *  - Tim's E2E-TOGGLE assignment reset to `in_progress`
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash("Jordan1234", 12);

    await prisma.user.upsert({
      where: { email: "founder@e2e.local" },
      create: {
        id: "u_e2e_founder",
        email: "founder@e2e.local",
        passwordHash: hash,
        firstName: "Founder",
        lastName: "Test",
        role: "realtor",
        emailVerifiedAt: new Date(),
      },
      update: { passwordHash: hash, role: "realtor" },
    });
    await prisma.teamMember.deleteMany({ where: { userId: "u_e2e_founder" } });
    await prisma.team.deleteMany({
      where: { name: { startsWith: "E2E Founder Office" } },
    });

    const reset = await prisma.assignment.updateMany({
      where: {
        freelancerId: "u_3",
        reference: { startsWith: "E2E-TOGGLE-" },
      },
      data: { status: "in_progress", completedAt: null },
    });
    if (reset.count === 0) {
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
          createdById: "u_2",
          services: {
            create: [{ serviceKey: "asbestos", unitPriceCents: 25000 }],
          },
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}
