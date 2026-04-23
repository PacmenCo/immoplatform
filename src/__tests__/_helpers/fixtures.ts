import type { Status } from "@/lib/mockData";
import { prisma } from "./db";
import { makeSession } from "./session";

/**
 * Seed a minimal baseline suitable for most Tier 2 action tests:
 *   - 1 admin, 1 staff, 1 realtor (owns team T1), 1 freelancer (team-less)
 *   - 2 teams: T1 (realtor-owned) + T2 (spare)
 *   - 4 services from the SERVICE_KEYS catalog at their default prices
 *
 * Returns named handles so tests read like English:
 *
 *   const { admin, realtor, freelancer, teams } = await seedBaseline();
 *   const asgId = await seedAssignment({ teamId: teams.t1.id, ... });
 *
 * Each individual seed helper is exported too so tests that want a custom
 * shape can compose without swallowing the whole baseline.
 */

// ─── Teams ────────────────────────────────────────────────────────

export async function seedTeam(
  id: string,
  name: string,
  opts?: { commissionType?: "percentage" | "fixed"; commissionValue?: number | null },
) {
  return prisma.team.create({
    data: {
      id,
      name,
      commissionType: opts?.commissionType ?? null,
      commissionValue: opts?.commissionValue ?? null,
    },
  });
}

// ─── Services (the flat catalog) ─────────────────────────────────

export async function seedServices() {
  // Prices are mock — real prices come from the seed script; tests override
  // via TeamServiceOverride or snapshot at assignment creation.
  const svcs = [
    { key: "epc", label: "Energy Performance Certificate", short: "EPC", color: "var(--color-epc)", description: "EPC", unitPrice: 15000, active: true },
    { key: "asbestos", label: "Asbestos Inventory Attest", short: "AIV", color: "var(--color-asbestos)", description: "AIV", unitPrice: 25000, active: true },
    { key: "electrical", label: "Electrical Inspection", short: "EK", color: "var(--color-electrical)", description: "EK", unitPrice: 20000, active: true },
    { key: "fuel", label: "Fuel Tank Check", short: "TK", color: "var(--color-fuel)", description: "TK", unitPrice: 12000, active: true },
  ];
  await prisma.service.createMany({ data: svcs });
}

// ─── The full baseline ──────────────────────────────────────────

export async function seedBaseline() {
  // Services + teams have no cross-dependency at seed time → parallelize.
  const [, t1, t2] = await Promise.all([
    seedServices(),
    seedTeam("t_test_1", "Test Realtor Team", {
      commissionType: "percentage",
      commissionValue: 1500, // 15% in bps
    }),
    seedTeam("t_test_2", "Spare Team"),
  ]);
  // Sessions reference teams by id only — each insert is independent.
  const [admin, staff, realtor, freelancer] = await Promise.all([
    makeSession({ role: "admin", userId: "u_admin" }),
    makeSession({ role: "staff", userId: "u_staff" }),
    makeSession({
      role: "realtor",
      userId: "u_realtor",
      activeTeamId: t1.id,
      membershipTeams: [{ teamId: t1.id, teamRole: "owner" }],
    }),
    makeSession({ role: "freelancer", userId: "u_freelancer" }),
  ]);

  return {
    admin,
    staff,
    realtor,
    freelancer,
    teams: { t1, t2 },
  };
}

// ─── Assignments ────────────────────────────────────────────────

type AssignmentSeed = {
  id?: string;
  reference?: string;
  status?: Status;
  teamId?: string | null;
  freelancerId?: string | null;
  createdById?: string | null;
  propertyType?: string | null;
  services?: Array<{ serviceKey: string; unitPriceCents: number }>;
  preferredDate?: Date | null;
};

export async function seedAssignment(opts: AssignmentSeed = {}) {
  const id = opts.id ?? `a_${Math.random().toString(36).slice(2, 10)}`;
  return prisma.assignment.create({
    data: {
      id,
      reference: opts.reference ?? `ASG-TEST-${id.slice(-4)}`,
      status: opts.status ?? "scheduled",
      address: "1 Teststraat",
      city: "Antwerpen",
      postal: "2000",
      propertyType: opts.propertyType ?? "apartment",
      ownerName: "Test Owner",
      teamId: opts.teamId ?? null,
      freelancerId: opts.freelancerId ?? null,
      createdById: opts.createdById ?? null,
      preferredDate: opts.preferredDate ?? null,
      services: {
        create: opts.services ?? [
          { serviceKey: "asbestos", unitPriceCents: 25000 },
        ],
      },
    },
  });
}
