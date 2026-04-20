/**
 * Seed the database with realistic sample data. Mirrors src/lib/mockData.ts
 * so existing pages keep rendering identical content, but now with real rows
 * in SQLite so the auth flow has something to query.
 *
 * Run: npx prisma db seed  (configured via package.json "prisma" block)
 * Or:  npm run seed
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "baldr123bp"; // for quick dev login — DO NOT reuse in prod

async function main() {
  console.log("🌱 seeding…");

  // Teams — full business detail
  const teamData = [
    {
      id: "t_01", name: "Vastgoed Antwerp", city: "Antwerpen", logo: "VA", logoColor: "#0f172a",
      email: "contact@vastgoedantwerp.be",
      description: "Our lead agency in Flanders — over 400 active residential listings.",
      legalName: "Vastgoed Antwerp BVBA",
      vatNumber: "BE 0712.345.678",
      kboNumber: "0712345678",
      iban: "BE68 5390 0754 7034",
      billingEmail: "billing@vastgoedantwerp.be",
      billingPhone: "+32 3 234 56 78",
      billingAddress: "Meir 42",
      billingPostal: "2000",
      billingCity: "Antwerpen",
      billingCountry: "Belgium",
      prefersLogoOnPhotos: true,
      defaultClientType: "owner",
      commissionType: "percentage",
      commissionValue: 1500, // 15%
    },
    {
      id: "t_02", name: "Immo Bruxelles", city: "Brussels", logo: "IB", logoColor: "#1e40af",
      email: "info@immobruxelles.be",
      description: "Brussels-based agency — mixed use and commercial specialists.",
      legalName: "Immo Bruxelles SA",
      vatNumber: "BE 0823.456.789",
      kboNumber: "0823456789",
      iban: "BE89 7800 0023 4567",
      billingEmail: "facturen@immobruxelles.be",
      billingPhone: "+32 2 123 45 67",
      billingAddress: "Avenue Louise 200",
      billingPostal: "1050",
      billingCity: "Bruxelles",
      billingCountry: "Belgium",
      defaultClientType: "firm",
      commissionType: "percentage",
      commissionValue: 1500,
    },
    {
      id: "t_03", name: "Gent Huizen", city: "Gent", logo: "GH", logoColor: "#0d9488",
      email: "hallo@genthuizen.be",
      legalName: "Gent Huizen BV",
      vatNumber: "BE 0934.567.890",
      billingAddress: "Sint-Pietersnieuwstraat 45",
      billingPostal: "9000",
      billingCity: "Gent",
      billingCountry: "Belgium",
      defaultClientType: "owner",
      commissionType: "percentage",
      commissionValue: 1500,
    },
    {
      id: "t_04", name: "Mechelen Makelaars", city: "Mechelen", logo: "MM", logoColor: "#9f1239",
      email: "team@mechelenmakelaars.be",
      legalName: "Mechelen Makelaars BV",
      vatNumber: "BE 0645.678.901",
      billingAddress: "Grote Markt 7",
      billingPostal: "2800",
      billingCity: "Mechelen",
      billingCountry: "Belgium",
      defaultClientType: "owner",
      commissionType: "fixed",
      commissionValue: 2500, // €25.00 flat
    },
    {
      id: "t_05", name: "Immo Liège", city: "Liège", logo: "IL", logoColor: "#b45309",
      email: "contact@immo-liege.be",
      legalName: "Immo Liège SPRL",
      vatNumber: "BE 0756.789.012",
      billingAddress: "Rue Léopold 15",
      billingPostal: "4000",
      billingCity: "Liège",
      billingCountry: "Belgium",
      defaultClientType: "firm",
      commissionType: "percentage",
      commissionValue: 1200,
    },
    {
      id: "t_06", name: "Brugge Vastgoed", city: "Brugge", logo: "BV", logoColor: "#6d28d9",
      legalName: "Brugge Vastgoed BV",
      vatNumber: "BE 0867.890.123",
      billingAddress: "Vrijdagmarkt 12",
      billingPostal: "8000",
      billingCity: "Brugge",
      billingCountry: "Belgium",
      defaultClientType: "owner",
      commissionType: "percentage",
      commissionValue: 1500,
    },
  ];
  for (const t of teamData) {
    await prisma.team.upsert({
      where: { id: t.id },
      create: t,
      update: t,
    });
  }

  const hash = await bcrypt.hash(DEV_PASSWORD, 12);

  // Users
  const users = [
    {
      id: "u_1", email: "jordan@asbestexperts.be", firstName: "Jordan", lastName: "Remy",
      role: "admin", phone: "+32 474 00 11 22", region: "Belgium (all regions)",
      bio: "Platform admin.",
    },
    {
      id: "u_2", email: "els@vastgoedantwerp.be", firstName: "Els", lastName: "Vermeulen",
      role: "realtor", phone: "+32 476 12 34 56", region: "Antwerp",
      bio: "Managing broker at Vastgoed Antwerp.",
    },
    {
      id: "u_3", email: "tim@immo.be", firstName: "Tim", lastName: "De Vos",
      role: "freelancer", phone: "+32 478 98 12 33", region: "Antwerp · Mechelen",
      bio: "Certified asbestos inspector (OVAM). 12 years experience.",
    },
    {
      id: "u_4", email: "sofie@immo.be", firstName: "Sofie", lastName: "Janssens",
      role: "freelancer", phone: "+32 479 44 55 66", region: "Brussels",
      bio: "Multi-service inspector.",
    },
    {
      id: "u_5", email: "dieter@immo.be", firstName: "Dieter", lastName: "Claes",
      role: "freelancer", phone: "+32 475 11 22 33", region: "Gent · East Flanders",
      bio: "EPC specialist.",
    },
    {
      id: "u_6", email: "pierre@immobruxelles.be", firstName: "Pierre", lastName: "Dubois",
      role: "realtor", phone: "+32 472 33 44 55", region: "Brussels",
      bio: "Lead broker at Immo Bruxelles.",
    },
    {
      id: "u_7", email: "nele@immo.be", firstName: "Nele", lastName: "Willems",
      role: "freelancer", phone: "+32 477 22 33 44", region: "Mechelen · Leuven",
      bio: "Fuel-tank and electrical specialist.",
    },
    {
      id: "u_8", email: "marie@immo.be", firstName: "Marie", lastName: "Lefevre",
      role: "staff", phone: "+32 471 99 88 77", region: "Belgium",
      bio: "Customer success.",
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        ...u,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
      },
      update: {
        ...u,
        // keep existing passwordHash if already set
      },
    });
  }

  // Team memberships
  const memberships: Array<{ teamId: string; userId: string; teamRole: string }> = [
    { teamId: "t_01", userId: "u_2", teamRole: "owner" },      // Els — Vastgoed Antwerp owner
    { teamId: "t_02", userId: "u_6", teamRole: "owner" },      // Pierre — Immo Bruxelles owner
    { teamId: "t_01", userId: "u_1", teamRole: "member" },     // Jordan (admin) in Antwerp for testing switcher
    { teamId: "t_02", userId: "u_1", teamRole: "owner" },      // Jordan also in Bruxelles
    { teamId: "t_03", userId: "u_1", teamRole: "member" },     // Jordan in Gent too
  ];
  for (const m of memberships) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: m.teamId, userId: m.userId } },
      create: m,
      update: m,
    });
  }

  // Services catalog (EPC / AIV / EK / TK)
  const services = [
    {
      key: "epc", label: "Energy Performance Certificate", short: "EPC",
      color: "var(--color-epc)",
      description: "Legally required energy rating for every sale or rental.",
      unitPrice: 16500, // €165.00
    },
    {
      key: "asbestos", label: "Asbestos Inventory Attest", short: "AIV",
      color: "var(--color-asbestos)",
      description: "Mandatory asbestos inventory for buildings from before 2001.",
      unitPrice: 24500,
    },
    {
      key: "electrical", label: "Electrical Inspection", short: "EK",
      color: "var(--color-electrical)",
      description: "AREI installation inspection for safe electrical systems.",
      unitPrice: 19500,
    },
    {
      key: "fuel", label: "Fuel Tank Check", short: "TK",
      color: "var(--color-fuel)",
      description: "Periodic inspection for above-ground and buried fuel tanks.",
      unitPrice: 13500,
    },
  ];
  for (const s of services) {
    await prisma.service.upsert({
      where: { key: s.key },
      create: s,
      update: s,
    });
  }

  // Per-team service price overrides — FK → Service, so this MUST run after
  // services are seeded.
  const overrides: Array<{ teamId: string; serviceKey: string; priceCents: number }> = [
    { teamId: "t_01", serviceKey: "asbestos", priceCents: 22500 }, // €225 (vs €245 default)
    { teamId: "t_01", serviceKey: "epc",      priceCents: 14500 }, // €145
    { teamId: "t_02", serviceKey: "electrical", priceCents: 18500 },
    { teamId: "t_04", serviceKey: "fuel",       priceCents: 12500 },
  ];
  for (const o of overrides) {
    await prisma.teamServiceOverride.upsert({
      where: { teamId_serviceKey: { teamId: o.teamId, serviceKey: o.serviceKey } },
      create: o,
      update: { priceCents: o.priceCents },
    });
  }

  // Freelancer specialties
  const specialties: Array<{ userId: string; serviceKey: string }> = [
    { userId: "u_3", serviceKey: "asbestos" },
    { userId: "u_3", serviceKey: "epc" },
    { userId: "u_4", serviceKey: "asbestos" },
    { userId: "u_4", serviceKey: "electrical" },
    { userId: "u_4", serviceKey: "fuel" },
    { userId: "u_5", serviceKey: "epc" },
    { userId: "u_7", serviceKey: "fuel" },
    { userId: "u_7", serviceKey: "electrical" },
  ];
  for (const sp of specialties) {
    await prisma.userSpecialty.upsert({
      where: { userId_serviceKey: { userId: sp.userId, serviceKey: sp.serviceKey } },
      create: sp,
      update: {},
    });
  }

  // Assignments
  const assignments = [
    {
      id: "a_1001", reference: "ASG-2026-1001", status: "scheduled",
      address: "Meir 34", city: "Antwerpen", postal: "2000",
      propertyType: "apartment", constructionYear: 1985, areaM2: 120,
      preferredDate: new Date("2026-04-25"), keyPickup: "owner",
      ownerName: "Els Vermeulen", ownerEmail: "els@example.com", ownerPhone: "+32 476 12 34 56",
      tenantName: "Marc De Smet", tenantEmail: "marc@example.com", tenantPhone: "+32 479 98 76 54",
      teamId: "t_01", freelancerId: "u_3", createdById: "u_2",
      services: ["epc", "asbestos"],
    },
    {
      id: "a_1002", reference: "ASG-2026-1002", status: "in_progress",
      address: "Place Sainte-Gudule 12", city: "Brussels", postal: "1000",
      propertyType: "house", constructionYear: 1962, areaM2: 180,
      preferredDate: new Date("2026-04-20"), keyPickup: "owner",
      ownerName: "Pierre Dubois", ownerEmail: "pierre@example.com", ownerPhone: "+32 472 11 22 33",
      teamId: "t_02", freelancerId: "u_4", createdById: "u_6",
      services: ["asbestos", "electrical", "fuel"],
    },
    {
      id: "a_1003", reference: "ASG-2026-1003", status: "delivered",
      address: "Sint-Pietersnieuwstraat 45", city: "Gent", postal: "9000",
      propertyType: "apartment", constructionYear: 1998, areaM2: 85,
      preferredDate: new Date("2026-04-10"), keyPickup: "office",
      ownerName: "Hannah Peeters", ownerEmail: "hannah@example.com", ownerPhone: "+32 478 55 44 33",
      teamId: "t_03", freelancerId: "u_5", createdById: "u_1",
      services: ["epc"],
      deliveredAt: new Date("2026-04-12"),
    },
    {
      id: "a_1004", reference: "ASG-2026-1004", status: "completed",
      address: "Grote Markt 7", city: "Mechelen", postal: "2800",
      propertyType: "house", constructionYear: 1920, areaM2: 220,
      preferredDate: new Date("2026-03-28"), keyPickup: "tenant",
      ownerName: "Jef Wouters", ownerEmail: "jef@example.com", ownerPhone: "+32 475 33 22 11",
      tenantName: "Lisa Maes", tenantEmail: "lisa@example.com", tenantPhone: "+32 471 22 11 00",
      teamId: "t_04", freelancerId: "u_7", createdById: "u_1",
      services: ["epc", "asbestos", "electrical", "fuel"],
      deliveredAt: new Date("2026-03-29"),
      completedAt: new Date("2026-03-30"),
    },
    {
      id: "a_1005", reference: "ASG-2026-1005", status: "draft",
      address: "Rue Neuve 88", city: "Liège", postal: "4000",
      propertyType: "apartment", constructionYear: 1975, areaM2: 95,
      preferredDate: new Date("2026-05-02"), keyPickup: "lockbox",
      ownerName: "Julien Lambert", ownerEmail: "julien@example.com", ownerPhone: "+32 497 44 55 66",
      teamId: "t_05", createdById: "u_1",
      services: ["asbestos"],
    },
    {
      id: "a_1006", reference: "ASG-2026-1006", status: "scheduled",
      address: "Vrijdagmarkt 12", city: "Brugge", postal: "8000",
      propertyType: "house", constructionYear: 1965, areaM2: 155,
      preferredDate: new Date("2026-04-28"), keyPickup: "owner",
      ownerName: "Annelies Martens", ownerEmail: "annelies@example.com", ownerPhone: "+32 478 77 88 99",
      teamId: "t_06", freelancerId: "u_3", createdById: "u_1",
      services: ["epc", "fuel"],
    },
  ];

  for (const a of assignments) {
    const { services: svcKeys, ...rest } = a;
    await prisma.assignment.upsert({
      where: { id: a.id },
      create: {
        ...rest,
        services: {
          create: svcKeys.map((k) => ({ serviceKey: k })),
        },
      },
      update: rest,
    });
  }

  // Some sample comments on the in_progress assignment
  const commentCount = await prisma.assignmentComment.count({
    where: { assignmentId: "a_1002" },
  });
  if (commentCount === 0) {
    await prisma.assignmentComment.createMany({
      data: [
        {
          assignmentId: "a_1002",
          authorId: "u_2",
          body: "Tenant prefers morning visit. Key is at the reception desk on the ground floor.",
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          assignmentId: "a_1002",
          authorId: "u_4",
          body: "Noted. I'll bring the extended sampling kit since the building is pre-1985.",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
        {
          assignmentId: "a_1002",
          authorId: null,
          authorLabel: "System",
          body: "Calendar event pushed to Sofie's Google Calendar.",
          createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
        },
      ],
    });
  }

  // A couple of pending invites (for the admin's users list)
  const { generateToken, hashToken } = await import("../src/lib/auth-crypto");
  const pending = [
    {
      email: "lucas.mertens@vastgoedantwerp.be",
      role: "realtor",
      teamId: "t_01",
      teamRole: "member",
      note: "Hi Lucas — welcome to our Immo workspace.",
    },
    {
      email: "sarah.dewitte@gmail.com",
      role: "freelancer",
      teamId: null,
      teamRole: null,
      note: null,
    },
  ];
  for (const p of pending) {
    const exists = await prisma.invite.findFirst({
      where: { email: p.email, acceptedAt: null, revokedAt: null },
    });
    if (exists) continue;
    const token = generateToken();
    await prisma.invite.create({
      data: {
        email: p.email,
        role: p.role,
        teamId: p.teamId,
        teamRole: p.teamRole,
        tokenHash: hashToken(token),
        invitedById: "u_1",
        note: p.note,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`  pending invite for ${p.email} → token: ${token}`);
  }

  console.log("✅ seed complete");
  console.log(`\n  Login:   jordan@asbestexperts.be`);
  console.log(`  Password: ${DEV_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
