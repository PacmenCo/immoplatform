/**
 * Seed the database with realistic sample data. Mirrors src/lib/mockData.ts
 * so existing pages keep rendering identical content, but now with real rows
 * in SQLite so the auth flow has something to query.
 *
 * Run: npx prisma db seed  (configured via package.json "prisma" block)
 * Or:  npm run seed
 */

import {
  PrismaClient,
  AnnouncementType,
  AssignmentStatus,
  ClientType,
  CommissionType,
  DiscountType,
  KeyPickupLocation,
  Role,
  TeamRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "Jordan1234"; // for quick dev login — DO NOT reuse in prod

/**
 * Hard refusal to run in production. The seed creates dummy users with
 * a published password, so running it on the live droplet would mint live
 * accounts anyone could log into. The deploy command in CLAUDE.md does NOT
 * run this script — but `npm run seed` is one ssh-and-typo away. Better to
 * fail closed at the file boundary than rely on operator discipline.
 *
 * Belt-and-suspenders: also bail if DATABASE_URL doesn't look dev-shaped.
 * Local dev URL is `postgresql://...@localhost:5432/immo_dev`; prod is
 * `postgresql://...@127.0.0.1:5432/immo` per CLAUDE.md.
 */
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "prisma/seed.ts refuses to run in production. The dummy users it creates have a published password.",
  );
}
if (
  process.env.DATABASE_URL &&
  !/\b(immo_dev|immo_test|localhost|127\.0\.0\.1)\b/.test(process.env.DATABASE_URL) &&
  !process.env.DATABASE_URL.startsWith("file:")
) {
  throw new Error(
    "prisma/seed.ts refuses: DATABASE_URL doesn't look like a dev/test target.",
  );
}

async function main() {
  console.log("🌱 seeding…");

  // ─── Admin-collision safety ─────────────────────────────────────────
  // On a fresh DB the seed creates `u_1` as the admin. On prod the admin
  // already exists (bootstrapped via scripts/bootstrap-admin.ts) with a
  // cuid-style id and the same email — Prisma's email-uniqueness constraint
  // would reject a fresh u_1 create. Look the existing admin up by email,
  // and if found with a different id, fall back to that id everywhere the
  // seed references "u_1" (memberships, assignment.createdById, invites,
  // announcements, comments). The seed's `u_1` row is then skipped — the
  // existing admin keeps its id and password untouched.
  const ADMIN_EMAIL = "jordan@asbestexperts.be";
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  const ADMIN_ID = existingAdmin?.id ?? "u_1";
  const skipSeedAdmin = !!existingAdmin && existingAdmin.id !== "u_1";
  /** Map a seed-time user id to the actual id, substituting u_1 → real admin. */
  const aid = (id: string): string => (id === "u_1" ? ADMIN_ID : id);
  if (skipSeedAdmin) {
    console.log(`  ↳ existing admin found (id=${ADMIN_ID}); skipping u_1 user upsert. Admin password + profile left intact.`);
  }

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
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.percentage,
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
      defaultClientType: ClientType.firm,
      commissionType: CommissionType.percentage,
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
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.percentage,
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
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.fixed,
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
      defaultClientType: ClientType.firm,
      commissionType: CommissionType.percentage,
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
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
    },
    {
      // Account-switcher fixture team. Hosts the two `@immo.test` realtor
      // users so they pass `gateRealtorRequiresTeam` and can render any
      // dashboard page. test-realtor-creator is owner; test-realtor-member
      // is plain member — exercises the readOnly form path.
      id: "t_test", name: "Test Switcher Team", city: "Test City", logo: "TS", logoColor: "#475569",
      legalName: "Test Switcher Team BV",
      defaultClientType: ClientType.owner,
      commissionType: CommissionType.percentage,
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
      role: Role.admin, phone: "+32 474 00 11 22", region: "Belgium (all regions)",
      bio: "Platform admin.",
    },
    {
      id: "u_2", email: "els@vastgoedantwerp.be", firstName: "Els", lastName: "Vermeulen",
      role: Role.realtor, phone: "+32 476 12 34 56", region: "Antwerp",
      bio: "Managing broker at Vastgoed Antwerp.",
    },
    {
      id: "u_3", email: "tim@immo.be", firstName: "Tim", lastName: "De Vos",
      role: Role.freelancer, phone: "+32 478 98 12 33", region: "Antwerp · Mechelen",
      bio: "Certified asbestos inspector (OVAM). 12 years experience.",
    },
    {
      id: "u_4", email: "sofie@immo.be", firstName: "Sofie", lastName: "Janssens",
      role: Role.freelancer, phone: "+32 479 44 55 66", region: "Brussels",
      bio: "Multi-service inspector.",
    },
    {
      id: "u_5", email: "dieter@immo.be", firstName: "Dieter", lastName: "Claes",
      role: Role.freelancer, phone: "+32 475 11 22 33", region: "Gent · East Flanders",
      bio: "EPC specialist.",
    },
    {
      id: "u_6", email: "pierre@immobruxelles.be", firstName: "Pierre", lastName: "Dubois",
      role: Role.realtor, phone: "+32 472 33 44 55", region: "Brussels",
      bio: "Lead broker at Immo Bruxelles.",
    },
    {
      id: "u_7", email: "nele@immo.be", firstName: "Nele", lastName: "Willems",
      role: Role.freelancer, phone: "+32 477 22 33 44", region: "Mechelen · Leuven",
      bio: "Fuel-tank and electrical specialist.",
    },
    {
      id: "u_8", email: "marie@immo.be", firstName: "Marie", lastName: "Lefevre",
      role: Role.staff, phone: "+32 471 99 88 77", region: "Belgium",
      bio: "Customer success.",
    },
    {
      id: "u_9", email: "lucas@vastgoedantwerp.be", firstName: "Lucas", lastName: "Mertens",
      role: Role.realtor, phone: "+32 470 22 88 11", region: "Antwerp",
      bio: "Junior agent at Vastgoed Antwerp.",
    },
    {
      id: "u_10", email: "charlotte@immo-liege.be", firstName: "Charlotte", lastName: "Bertrand",
      role: Role.realtor, phone: "+32 491 55 66 77", region: "Liège",
      bio: "Lead broker — Immo Liège.",
    },
    {
      id: "u_11", email: "bart@immo.be", firstName: "Bart", lastName: "Janssens",
      role: Role.freelancer, phone: "+32 473 88 99 00", region: "Antwerp · Limburg",
      bio: "OVAM-certified asbestos + electrical inspector.",
    },
    {
      id: "u_12", email: "camille@immo.be", firstName: "Camille", lastName: "Devos",
      role: Role.freelancer, phone: "+32 496 11 22 33", region: "Hainaut · Liège",
      bio: "Electrical inspections — AREI-certified since 2014.",
    },
    {
      id: "u_13", email: "hugo@immo.be", firstName: "Hugo", lastName: "Pieters",
      role: Role.freelancer, phone: "+32 497 33 44 55", region: "West Flanders",
      bio: "Multi-service: EPC, AIV, EK, TK.",
    },
    {
      id: "u_14", email: "david@immo.be", firstName: "David", lastName: "Cools",
      role: Role.staff, phone: "+32 472 66 77 88", region: "Belgium",
      bio: "Operations + finance.",
    },
    {
      id: "u_15", email: "anouk@brugge-vastgoed.be", firstName: "Anouk", lastName: "Devos",
      role: Role.realtor, phone: "+32 471 55 66 77", region: "Brugge",
      bio: "Owner — Brugge Vastgoed.",
    },

    // ─── Account-switcher test fixtures ─────────────────────────────────
    // The `@immo.test` TLD is RFC 6761-reserved (no public DNS). These rows
    // exist only in dev/staging seeds; the registration flow blocks the
    // domain so no real user can claim one. Membership in the
    // SWITCHER_GROUP (src/lib/account-switcher.ts) MUST stay in lockstep
    // with this list — both sides reference these emails by hand.
    // One fixture per non-admin role (Jordan covers admin himself).
    {
      id: "u_test_staff", email: "test-staff@immo.test",
      firstName: "Test", lastName: "Staff",
      role: Role.staff, phone: null, region: "Belgium",
      bio: "Switcher fixture — staff role.",
    },
    {
      id: "u_test_realtor", email: "test-realtor@immo.test",
      firstName: "Test", lastName: "Realtor",
      role: Role.realtor, phone: null, region: "Antwerp",
      bio: "Switcher fixture — realtor on the test switcher team.",
    },
    {
      id: "u_test_freelancer", email: "test-freelancer@immo.test",
      firstName: "Test", lastName: "Freelancer",
      role: Role.freelancer, phone: null, region: "Antwerp",
      bio: "Switcher fixture — freelancer role.",
    },
  ];

  for (const u of users) {
    if (u.id === "u_1" && skipSeedAdmin) continue;
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        ...u,
        passwordHash: hash,
        emailVerifiedAt: new Date(),
      },
      update: {
        ...u,
        // Force-rotate the password on every seed so all dummy users line up
        // on the current DEV_PASSWORD. Demo-only; never enable for real users.
        passwordHash: hash,
      },
    });
  }

  // Team memberships
  const memberships: Array<{ teamId: string; userId: string; teamRole: TeamRole }> = [
    { teamId: "t_01", userId: "u_2", teamRole: TeamRole.owner },      // Els — Vastgoed Antwerp owner
    { teamId: "t_02", userId: "u_6", teamRole: TeamRole.owner },      // Pierre — Immo Bruxelles owner
    { teamId: "t_01", userId: "u_1", teamRole: TeamRole.member },     // Jordan (admin) in Antwerp for testing switcher
    { teamId: "t_02", userId: "u_1", teamRole: TeamRole.owner },      // Jordan also in Bruxelles
    { teamId: "t_03", userId: "u_1", teamRole: TeamRole.member },     // Jordan in Gent too
    { teamId: "t_01", userId: "u_9", teamRole: TeamRole.member },     // Lucas — junior at Vastgoed Antwerp
    { teamId: "t_05", userId: "u_10", teamRole: TeamRole.owner },     // Charlotte — Immo Liège owner
    { teamId: "t_06", userId: "u_15", teamRole: TeamRole.owner },     // Anouk — Brugge Vastgoed owner
    { teamId: "t_03", userId: "u_2", teamRole: TeamRole.member },     // Els also runs ops in Gent
    { teamId: "t_04", userId: "u_8", teamRole: TeamRole.member },     // Marie (staff) sits with Mechelen team

    // Account-switcher realtor fixture needs a team so the realtor pages
    // don't bounce via `gateRealtorRequiresTeam`. Make them owner so they
    // can fully edit + delete their own assignments.
    { teamId: "t_test", userId: "u_test_realtor", teamRole: TeamRole.owner },
  ];
  for (const m of memberships) {
    const userId = aid(m.userId);
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: m.teamId, userId } },
      create: { ...m, userId },
      update: { ...m, userId },
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
    {
      key: "photos", label: "Property Photography", short: "PH",
      color: "var(--color-photos)",
      description: "Professional listing photography for sales and rentals.",
      unitPrice: 15000, // €150 — placeholder; per-team overrides expected
    },
    {
      key: "signage", label: "On-site Signage", short: "SG",
      color: "var(--color-signage)",
      description: "Mounted For-Sale / For-Rent signage at the property.",
      unitPrice: 7500, // €75 — placeholder; per-team overrides expected
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

  // Default Odoo product-name mappings (teamId=null). Mirrors v1's hardcoded
  // OdooService::mapPropertyTypeToProduct (asbestos only — v1 has no
  // hardcoded EPC fallback either). Admins extend per-team via
  // /dashboard/admin/odoo-products. v1 had no electrical/fuel — those default
  // to MANUAL_QUOTE. Keep idempotent: upsert by the unique compound key.
  // teamId is part of the unique index; Prisma maps null teamId to a literal
  // NULL in the index, so the upsert key requires a non-null sentinel — use
  // findFirst+create/update for null-team rows.
  const defaultMappings: Array<{ serviceKey: string; propertyType: string; odooProductName: string }> = [
    { serviceKey: "asbestos", propertyType: "apartment",   odooProductName: "Niet-destructieve Asbestinventaris Appartement" },
    { serviceKey: "asbestos", propertyType: "studio",      odooProductName: "Niet-destructieve Asbestinventaris Appartement" },
    { serviceKey: "asbestos", propertyType: "studio_room", odooProductName: "Niet-destructieve Asbestinventaris Appartement" },
    { serviceKey: "asbestos", propertyType: "house",       odooProductName: "Niet-destructieve Asbestinventaris Woning" },
    // commercial → no default (parity: v1 returned MANUAL_QUOTE for unmapped types).
  ];
  for (const m of defaultMappings) {
    const existing = await prisma.odooProductMapping.findFirst({
      where: { teamId: null, serviceKey: m.serviceKey, propertyType: m.propertyType },
      select: { id: true },
    });
    if (existing) {
      await prisma.odooProductMapping.update({
        where: { id: existing.id },
        data: { odooProductName: m.odooProductName },
      });
    } else {
      await prisma.odooProductMapping.create({
        data: { teamId: null, ...m },
      });
    }
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
    { userId: "u_11", serviceKey: "asbestos" },
    { userId: "u_11", serviceKey: "electrical" },
    { userId: "u_12", serviceKey: "electrical" },
    { userId: "u_13", serviceKey: "epc" },
    { userId: "u_13", serviceKey: "asbestos" },
    { userId: "u_13", serviceKey: "electrical" },
    { userId: "u_13", serviceKey: "fuel" },
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
      id: "a_1001", reference: "ASG-2026-1001", status: AssignmentStatus.scheduled,
      address: "Meir 34", city: "Antwerpen", postal: "2000",
      propertyType: "apartment", constructionYear: 1985, areaM2: 120,
      preferredDate: new Date("2026-04-25"),
      requiresKeyPickup: false,
      ownerName: "Els Vermeulen", ownerEmail: "els@example.com", ownerPhone: "+32 476 12 34 56",
      tenantName: "Marc De Smet", tenantEmail: "marc@example.com", tenantPhone: "+32 479 98 76 54",
      teamId: "t_01", freelancerId: "u_3", createdById: "u_2",
      services: ["epc", "asbestos"],
    },
    {
      id: "a_1002", reference: "ASG-2026-1002", status: AssignmentStatus.in_progress,
      address: "Place Sainte-Gudule 12", city: "Brussels", postal: "1000",
      propertyType: "house", constructionYear: 1962, areaM2: 180,
      preferredDate: new Date("2026-04-20"),
      requiresKeyPickup: false,
      ownerName: "Pierre Dubois", ownerEmail: "pierre@example.com", ownerPhone: "+32 472 11 22 33",
      teamId: "t_02", freelancerId: "u_4", createdById: "u_6",
      services: ["asbestos", "electrical", "fuel"],
    },
    {
      id: "a_1003", reference: "ASG-2026-1003", status: AssignmentStatus.in_progress,
      address: "Sint-Pietersnieuwstraat 45", city: "Gent", postal: "9000",
      propertyType: "apartment", constructionYear: 1998, areaM2: 85,
      preferredDate: new Date("2026-04-10"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      ownerName: "Hannah Peeters", ownerEmail: "hannah@example.com", ownerPhone: "+32 478 55 44 33",
      teamId: "t_03", freelancerId: "u_5", createdById: "u_1",
      services: ["epc"],
    },
    {
      id: "a_1004", reference: "ASG-2026-1004", status: AssignmentStatus.completed,
      address: "Grote Markt 7", city: "Mechelen", postal: "2800",
      propertyType: "house", constructionYear: 1920, areaM2: 220,
      preferredDate: new Date("2026-03-28"),
      requiresKeyPickup: false,
      ownerName: "Jef Wouters", ownerEmail: "jef@example.com", ownerPhone: "+32 475 33 22 11",
      tenantName: "Lisa Maes", tenantEmail: "lisa@example.com", tenantPhone: "+32 471 22 11 00",
      teamId: "t_04", freelancerId: "u_7", createdById: "u_1",
      services: ["epc", "asbestos", "electrical", "fuel"],
      completedAt: new Date("2026-03-30"),
    },
    {
      id: "a_1005", reference: "ASG-2026-1005", status: AssignmentStatus.draft,
      address: "Rue Neuve 88", city: "Liège", postal: "4000",
      propertyType: "apartment", constructionYear: 1975, areaM2: 95,
      preferredDate: new Date("2026-05-02"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.other,
      keyPickupAddress: "Lockbox at the front door — code in the confirmation email.",
      ownerName: "Julien Lambert", ownerEmail: "julien@example.com", ownerPhone: "+32 497 44 55 66",
      teamId: "t_05", createdById: "u_1",
      services: ["asbestos"],
    },
    {
      id: "a_1006", reference: "ASG-2026-1006", status: AssignmentStatus.scheduled,
      address: "Vrijdagmarkt 12", city: "Brugge", postal: "8000",
      propertyType: "house", constructionYear: 1965, areaM2: 155,
      preferredDate: new Date("2026-04-28"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      ownerName: "Annelies Martens", ownerEmail: "annelies@example.com", ownerPhone: "+32 478 77 88 99",
      teamId: "t_06", freelancerId: "u_3", createdById: "u_1",
      services: ["epc", "fuel"],
    },
    // ─── Expanded dummy data (a_1007 → a_1020) ────────────────────────
    // Variety: covers every AssignmentStatus value, quantity > 1, large-
    // property surcharge, discount-applied, key-pickup variants, firm vs
    // owner clients, and completed dates spread across recent months for
    // a realistic revenue chart.
    {
      // qty 2 + 360 m² → triggers the 300m² surcharge AND tests the
      // quantity propagation fix (unitPrice × 2 across all lines).
      id: "a_1007", reference: "ASG-2026-2001", status: AssignmentStatus.completed,
      address: "Frankrijklei 88", city: "Antwerpen", postal: "2000",
      propertyType: "apartment_block", constructionYear: 1955, areaM2: 360,
      quantity: 2, isLargeProperty: true,
      preferredDate: new Date("2026-04-08"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      ownerName: "Maxim De Cock", ownerEmail: "maxim@example.com", ownerPhone: "+32 475 12 34 56",
      ownerAddress: "Frankrijklei 88", ownerPostal: "2000", ownerCity: "Antwerpen",
      clientType: ClientType.owner,
      teamId: "t_01", freelancerId: "u_3", createdById: "u_2",
      services: ["epc", "asbestos", "electrical"],
      completedAt: new Date("2026-04-13"),
    },
    {
      // Discount applied — 10% off pre-discount total.
      id: "a_1008", reference: "ASG-2026-2002", status: AssignmentStatus.completed,
      address: "Avenue Louise 145", city: "Brussels", postal: "1050",
      propertyType: "apartment", constructionYear: 1990, areaM2: 110,
      preferredDate: new Date("2026-04-05"),
      requiresKeyPickup: false,
      ownerName: "Sophie Verhaegen", ownerEmail: "sophie@example.com", ownerPhone: "+32 472 88 77 66",
      ownerVatNumber: "BE 0698.123.456",
      clientType: ClientType.firm,
      teamId: "t_02", freelancerId: "u_4", createdById: "u_6",
      services: ["asbestos", "electrical"],
      discountType: DiscountType.percentage, discountValue: 1000, discountReason: "Repeat-customer rebate",
      completedAt: new Date("2026-04-09"),
    },
    {
      id: "a_1009", reference: "ASG-2026-2003", status: AssignmentStatus.cancelled,
      address: "Rue de la Loi 50", city: "Brussels", postal: "1040",
      propertyType: "office", constructionYear: 1978, areaM2: 200,
      preferredDate: new Date("2026-04-15"),
      requiresKeyPickup: false,
      ownerName: "Régis Lafontaine", ownerEmail: "regis@example.com", ownerPhone: "+32 491 22 33 44",
      teamId: "t_02", createdById: "u_6",
      services: ["epc"],
      cancelledAt: new Date("2026-04-14"), cancellationReason: "Owner withdrew the listing — no longer selling.",
    },
    {
      id: "a_1010", reference: "ASG-2026-2004", status: AssignmentStatus.on_hold,
      address: "Korenmarkt 7", city: "Gent", postal: "9000",
      propertyType: "commercial", constructionYear: 1932, areaM2: 280,
      preferredDate: new Date("2026-05-10"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.other,
      keyPickupAddress: "Rear entrance — code 4471 — call before arrival.",
      notes: "On hold pending owner's renovation timeline.",
      ownerName: "Thomas Beirens", ownerEmail: "thomas@example.com", ownerPhone: "+32 479 33 44 55",
      teamId: "t_03", freelancerId: "u_5", createdById: "u_1",
      services: ["asbestos", "electrical"],
    },
    {
      id: "a_1011", reference: "ASG-2026-2005", status: AssignmentStatus.awaiting,
      address: "Rue Léopold 8", city: "Liège", postal: "4000",
      propertyType: "house", constructionYear: 1955, areaM2: 165,
      requiresKeyPickup: false,
      notes: "Awaiting tenant contact details before scheduling.",
      ownerName: "Luc Henrion", ownerEmail: "luc@example.com", ownerPhone: "+32 491 11 22 33",
      teamId: "t_05", createdById: "u_10",
      services: ["epc", "asbestos"],
    },
    {
      id: "a_1012", reference: "ASG-2026-2006", status: AssignmentStatus.draft,
      address: "Steenweg op Brussel 14", city: "Mechelen", postal: "2800",
      propertyType: "house", constructionYear: 1972, areaM2: 140,
      requiresKeyPickup: false,
      ownerName: "Marleen Smet", ownerEmail: "marleen@example.com", ownerPhone: "+32 478 22 33 44",
      teamId: "t_04", createdById: "u_8",
      services: ["epc"],
    },
    {
      id: "a_1013", reference: "ASG-2026-2007", status: AssignmentStatus.scheduled,
      address: "Predikherenrei 22", city: "Brugge", postal: "8000",
      propertyType: "apartment", constructionYear: 1988, areaM2: 78,
      preferredDate: new Date("2026-05-04"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      ownerName: "Anouk Devos", ownerEmail: "anouk@brugge-vastgoed.be", ownerPhone: "+32 471 55 66 77",
      teamId: "t_06", freelancerId: "u_13", createdById: "u_15",
      services: ["epc", "fuel"],
    },
    {
      id: "a_1014", reference: "ASG-2026-2008", status: AssignmentStatus.in_progress,
      address: "Diestsestraat 41", city: "Leuven", postal: "3000",
      propertyType: "apartment", constructionYear: 1995, areaM2: 92,
      preferredDate: new Date("2026-04-22"),
      requiresKeyPickup: false,
      ownerName: "Fien Mertens", ownerEmail: "fien@example.com", ownerPhone: "+32 472 33 44 55",
      tenantName: "Sander Heylen", tenantEmail: "sander@example.com", tenantPhone: "+32 475 66 77 88",
      teamId: "t_01", freelancerId: "u_7", createdById: "u_9",
      services: ["electrical", "fuel"],
    },
    {
      id: "a_1015", reference: "ASG-2026-2009", status: AssignmentStatus.in_progress,
      address: "Place du Marché 3", city: "Liège", postal: "4000",
      propertyType: "apartment", constructionYear: 2001, areaM2: 105,
      preferredDate: new Date("2026-04-18"),
      requiresKeyPickup: false,
      ownerName: "Mathieu Lemaire", ownerEmail: "mathieu@example.com", ownerPhone: "+32 491 99 88 77",
      teamId: "t_05", freelancerId: "u_12", createdById: "u_10",
      services: ["electrical"],
    },
    {
      // Last-month completion for revenue chart trend.
      id: "a_1016", reference: "ASG-2026-2010", status: AssignmentStatus.completed,
      address: "Kammenstraat 17", city: "Antwerpen", postal: "2000",
      propertyType: "apartment", constructionYear: 1980, areaM2: 88,
      preferredDate: new Date("2026-03-12"),
      requiresKeyPickup: false,
      ownerName: "Lien Adriaens", ownerEmail: "lien@example.com", ownerPhone: "+32 477 33 22 11",
      teamId: "t_01", freelancerId: "u_3", createdById: "u_2",
      services: ["epc", "asbestos"],
      completedAt: new Date("2026-03-16"),
    },
    {
      // Two months back, different team, single-service.
      id: "a_1017", reference: "ASG-2026-2011", status: AssignmentStatus.completed,
      address: "Boulevard du Souverain 90", city: "Brussels", postal: "1170",
      propertyType: "house", constructionYear: 1968, areaM2: 175,
      preferredDate: new Date("2026-02-22"),
      requiresKeyPickup: false,
      ownerName: "Camille Renard", ownerEmail: "camille@example.com", ownerPhone: "+32 472 11 22 33",
      teamId: "t_02", freelancerId: "u_11", createdById: "u_6",
      services: ["asbestos"],
      completedAt: new Date("2026-02-27"),
    },
    {
      // qty 3 + firm client + this month — quantity-fix demo.
      id: "a_1018", reference: "ASG-2026-2012", status: AssignmentStatus.completed,
      address: "Industriepark 5", city: "Mechelen", postal: "2800",
      propertyType: "commercial", constructionYear: 1992, areaM2: 250,
      quantity: 3,
      preferredDate: new Date("2026-04-02"),
      requiresKeyPickup: false,
      ownerName: "Logix BV", ownerEmail: "facturen@logix.be", ownerPhone: "+32 472 88 99 00",
      ownerVatNumber: "BE 0712.998.123",
      ownerAddress: "Industriepark 5", ownerPostal: "2800", ownerCity: "Mechelen",
      clientType: ClientType.firm,
      teamId: "t_04", freelancerId: "u_7", createdById: "u_8",
      services: ["epc", "asbestos", "fuel"],
      completedAt: new Date("2026-04-07"),
    },
    {
      id: "a_1019", reference: "ASG-2026-2013", status: AssignmentStatus.cancelled,
      address: "Sint-Annaplein 3", city: "Gent", postal: "9000",
      propertyType: "apartment", constructionYear: 1976, areaM2: 70,
      preferredDate: new Date("2026-04-19"),
      requiresKeyPickup: false,
      ownerName: "Jasper Devos", ownerEmail: "jasper@example.com", ownerPhone: "+32 478 66 55 44",
      teamId: "t_03", createdById: "u_1",
      services: ["epc"],
      cancelledAt: new Date("2026-04-17"), cancellationReason: "Freelancer became unavailable; rescheduling later.",
    },
    {
      id: "a_1020", reference: "ASG-2026-2014", status: AssignmentStatus.scheduled,
      address: "Avenue de la Toison d'Or 56", city: "Brussels", postal: "1060",
      propertyType: "apartment_block", constructionYear: 1948, areaM2: 540,
      isLargeProperty: true,
      preferredDate: new Date("2026-05-12"),
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      notes: "Large pre-war building; allow full-day visit.",
      ownerName: "Alliance Immobilière SA", ownerEmail: "facturation@alliance-immo.be",
      ownerPhone: "+32 491 12 34 56", ownerVatNumber: "BE 0445.667.889",
      ownerAddress: "Avenue de la Toison d'Or 56", ownerPostal: "1060", ownerCity: "Brussels",
      clientType: ClientType.firm,
      teamId: "t_02", freelancerId: "u_4", createdById: "u_6",
      services: ["epc", "asbestos", "electrical", "fuel"],
    },

    // ─── Account-switcher fixtures: shared work between test accounts ────
    // Three assignments owned by `t_test` so the test-realtor (team owner)
    // creates them, the test-freelancer is assigned, and test-staff can
    // see/edit them via the global staff scope. One per workflow state so
    // every UI path is exercised.
    {
      id: "a_test_001", reference: "ASG-2026-9001", status: AssignmentStatus.scheduled,
      address: "Test Street 1", city: "Test City", postal: "1000",
      propertyType: "apartment", constructionYear: 1995, areaM2: 90,
      preferredDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // a week from now
      requiresKeyPickup: false,
      ownerName: "Test Owner Alpha", ownerEmail: "owner-a@example.test", ownerPhone: "+32 470 00 00 01",
      teamId: "t_test", freelancerId: "u_test_freelancer", createdById: "u_test_realtor",
      services: ["epc"],
    },
    {
      id: "a_test_002", reference: "ASG-2026-9002", status: AssignmentStatus.in_progress,
      address: "Test Avenue 2", city: "Test City", postal: "1000",
      propertyType: "house", constructionYear: 1978, areaM2: 140,
      preferredDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // yesterday
      requiresKeyPickup: true, keyPickupLocationType: KeyPickupLocation.office,
      ownerName: "Test Owner Beta", ownerEmail: "owner-b@example.test", ownerPhone: "+32 470 00 00 02",
      tenantName: "Test Tenant Beta", tenantEmail: "tenant-b@example.test", tenantPhone: "+32 470 00 00 22",
      teamId: "t_test", freelancerId: "u_test_freelancer", createdById: "u_test_realtor",
      services: ["asbestos", "electrical"],
    },
    {
      id: "a_test_003", reference: "ASG-2026-9003", status: AssignmentStatus.in_progress,
      address: "Test Square 3", city: "Test City", postal: "1000",
      propertyType: "apartment", constructionYear: 2005, areaM2: 75,
      preferredDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // a week ago
      requiresKeyPickup: false,
      ownerName: "Test Owner Gamma", ownerEmail: "owner-c@example.test", ownerPhone: "+32 470 00 00 03",
      teamId: "t_test", freelancerId: "u_test_freelancer", createdById: "u_test_realtor",
      services: ["epc", "fuel"],
    },
  ];

  for (const a of assignments) {
    const { services: svcKeys, ...rest } = a;
    const data = {
      ...rest,
      ...(rest.createdById ? { createdById: aid(rest.createdById) } : {}),
      ...(rest.freelancerId ? { freelancerId: aid(rest.freelancerId) } : {}),
    };
    await prisma.assignment.upsert({
      where: { id: a.id },
      create: {
        ...data,
        services: {
          create: svcKeys.map((k) => ({ serviceKey: k })),
        },
      },
      update: data,
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

  // Comments on the test-account in_progress assignment so the test
  // realtor + freelancer can see a real conversation when they log in.
  const testCommentCount = await prisma.assignmentComment.count({
    where: { assignmentId: "a_test_002" },
  });
  if (testCommentCount === 0) {
    await prisma.assignmentComment.createMany({
      data: [
        {
          assignmentId: "a_test_002",
          authorId: "u_test_realtor",
          body: "Tenant will be home from 14:00 onwards. Front door bell is broken — please knock.",
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        {
          assignmentId: "a_test_002",
          authorId: "u_test_freelancer",
          body: "Got it. Started the asbestos sampling this morning, electrical inspection scheduled for tomorrow.",
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }

  // A couple of pending invites (for the admin's users list)
  const { generateToken, hashToken } = await import("../src/lib/auth-crypto");
  const pending = [
    {
      email: "lucas.mertens@vastgoedantwerp.be",
      role: Role.realtor,
      teamId: "t_01",
      teamRole: TeamRole.member,
      note: "Hi Lucas — welcome to our Immo workspace.",
    },
    {
      email: "sarah.dewitte@gmail.com",
      role: Role.freelancer,
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
        invitedById: aid("u_1"),
        note: p.note,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log(`  pending invite for ${p.email} → token: ${token}`);
  }

  // Announcements — platform-wide banner messages. Admin-authored.
  const now = new Date();
  const msDay = 24 * 60 * 60 * 1000;
  const announcements = [
    {
      id: "an_01",
      title: "Easter maintenance window — April 20",
      body: "The platform will be offline between 02:00 and 04:00 for routine database maintenance.",
      type: AnnouncementType.info,
      isActive: true,
      isDismissible: true,
      startsAt: new Date(now.getTime() - 4 * msDay),
      endsAt:   new Date(now.getTime() + 3 * msDay),
      createdById: "u_1",
    },
    {
      id: "an_02",
      title: "New electrical inspection service now live",
      body: "You can now request AREI-compliant electrical inspections on any assignment. Pricing starts at €195.",
      type: AnnouncementType.success,
      isActive: true,
      isDismissible: true,
      startsAt: new Date(now.getTime() - 12 * msDay),
      endsAt:   new Date(now.getTime() + 8 * msDay),
      createdById: "u_1",
    },
    {
      id: "an_03",
      title: "Commission payout delayed — March 2026",
      body: "Payouts for March will be processed April 22 due to the Easter bank holiday.",
      type: AnnouncementType.warning,
      isActive: false,
      isDismissible: true,
      startsAt: new Date(now.getTime() - 17 * msDay),
      endsAt:   new Date(now.getTime() - 1 * msDay),
      createdById: "u_1",
    },
  ];
  for (const a of announcements) {
    const data = { ...a, createdById: aid(a.createdById) };
    await prisma.announcement.upsert({
      where: { id: a.id },
      create: data,
      update: data,
    });
  }

  // ─── Commission lines on completed assignments ──────────────────────
  // Hand-rolled (rather than calling applyCommission) because the engine
  // imports `server-only` and won't load in the seed runtime. Math mirrors
  // computeCommission: subtotal = Σ unitPrice × qty, surcharge = ceil((m²-300)/100)
  // × 20% on subtotal, total = (subtotal + surcharge) × (1 - discount), and
  // commission = total × team rate (or fixed amount). Eligible iff at least one
  // line is "asbestos" AND propertyType not in EXCLUDED_PROPERTY_TYPES.
  type CommissionSeed = {
    id: string;
    assignmentId: string;
    teamId: string;
    assignmentTotalCents: number;
    commissionType: CommissionType;
    commissionValue: number;
    commissionAmountCents: number;
    computedAt: Date;
  };
  const commissionLines: CommissionSeed[] = [
    {
      // a_1004 — Mechelen full bundle, qty 1, no surcharge, no discount.
      // subtotal = 165 + 245 + 195 + (override) 125 = 730 → 73 000c
      // team t_04 fixed €25 commission.
      id: "ac_a_1004",
      assignmentId: "a_1004",
      teamId: "t_04",
      assignmentTotalCents: 73000,
      commissionType: CommissionType.fixed,
      commissionValue: 2500,
      commissionAmountCents: 2500,
      computedAt: new Date("2026-03-30"),
    },
    {
      // a_1007 — Antwerp qty 2, 360m² → 1 surcharge block (20%).
      // subtotal: t_01 overrides epc=145, asbestos=225; electrical=195 default.
      // (145 + 225 + 195) × 2 = 1130 → 113 000c
      // surcharge: ceil((360-300)/100) × 20% = 1 × 20% = 22 600c
      // total: 135 600c. team rate 15% → 20 340c.
      id: "ac_a_1007",
      assignmentId: "a_1007",
      teamId: "t_01",
      assignmentTotalCents: 135600,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
      commissionAmountCents: 20340,
      computedAt: new Date("2026-04-13"),
    },
    {
      // a_1008 — Brussels asbestos + electrical (override 185), 10% off.
      // subtotal: 245 + 185 = 430 → 43 000c. 10% discount → 38 700c.
      // team t_02 percentage 15% → 5 805c.
      id: "ac_a_1008",
      assignmentId: "a_1008",
      teamId: "t_02",
      assignmentTotalCents: 38700,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
      commissionAmountCents: 5805,
      computedAt: new Date("2026-04-09"),
    },
    {
      // a_1016 — Antwerp epc + asbestos qty 1.
      // (145 + 225) = 370 → 37 000c. 15% → 5 550c.
      id: "ac_a_1016",
      assignmentId: "a_1016",
      teamId: "t_01",
      assignmentTotalCents: 37000,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
      commissionAmountCents: 5550,
      computedAt: new Date("2026-03-16"),
    },
    {
      // a_1017 — Brussels asbestos solo. 245 → 24 500c. 15% → 3 675c.
      id: "ac_a_1017",
      assignmentId: "a_1017",
      teamId: "t_02",
      assignmentTotalCents: 24500,
      commissionType: CommissionType.percentage,
      commissionValue: 1500,
      commissionAmountCents: 3675,
      computedAt: new Date("2026-02-27"),
    },
    {
      // a_1018 — Mechelen qty 3, firm client.
      // (165 + 245 + (override)125) × 3 = 1605 → 160 500c. team t_04 fixed €25.
      id: "ac_a_1018",
      assignmentId: "a_1018",
      teamId: "t_04",
      assignmentTotalCents: 160500,
      commissionType: CommissionType.fixed,
      commissionValue: 2500,
      commissionAmountCents: 2500,
      computedAt: new Date("2026-04-07"),
    },
  ];
  for (const c of commissionLines) {
    await prisma.assignmentCommission.upsert({
      where: { assignmentId: c.assignmentId },
      create: c,
      update: c,
    });
  }

  // ─── A paid commission payout ───────────────────────────────────────
  // Vastgoed Antwerp Q1 2026 paid out — sum of commission lines computed
  // in Q1 (a_1016 = 5 550c). Demonstrates the payout column on commission
  // pages. Paid by Marie (staff).
  await prisma.commissionPayout.upsert({
    where: { teamId_year_quarter: { teamId: "t_01", year: 2026, quarter: 1 } },
    create: {
      teamId: "t_01",
      year: 2026,
      quarter: 1,
      amountCents: 5550,
      paidAt: new Date("2026-04-04"),
      paidById: "u_8",
    },
    update: {
      amountCents: 5550,
      paidAt: new Date("2026-04-04"),
      paidById: "u_8",
    },
  });

  // ─── Revenue adjustments ────────────────────────────────────────────
  // Manual line items on the financial overview — credits + chargebacks.
  // Idempotent via deterministic ids.
  const adjustments = [
    {
      id: "radj_t_01_2026_03",
      teamId: "t_01",
      year: 2026,
      month: 3,
      description: "Reimbursed test fee for cancelled visit (a_1009 lookup mistake)",
      amountCents: -4500,
      createdById: "u_1",
    },
    {
      id: "radj_t_02_2026_04",
      teamId: "t_02",
      year: 2026,
      month: 4,
      description: "Volume bonus — Q1 milestone",
      amountCents: 25000,
      createdById: "u_8",
    },
  ];
  for (const r of adjustments) {
    const data = { ...r, createdById: r.createdById ? aid(r.createdById) : null };
    await prisma.revenueAdjustment.upsert({
      where: { id: r.id },
      create: data,
      update: data,
    });
  }

  // ─── Contact submissions (admin inbox demo) ─────────────────────────
  // Idempotent via createdAt-keyed lookup.
  const contactSeeds = [
    {
      key: "contact_seed_001",
      name: "Hannelore De Bruyne",
      email: "hannelore@kantoorvermeulen.be",
      phone: "+32 478 22 11 33",
      subject: "Onboarding for our 12-agent office",
      message:
        "Hi — we run a 12-agent residential office in Antwerp and would like to migrate from our current EPC supplier. Can we set up a call this week?",
      createdAt: new Date("2026-04-21T09:14:00Z"),
      handledById: null,
    },
    {
      key: "contact_seed_002",
      name: "Lieven Geerts",
      email: "lieven@example.com",
      phone: null,
      subject: "Bug: assignment list filter empty",
      message:
        "I selected 'in progress' on the assignments list and the page rendered empty even though I have three. Tried Chrome + Firefox.",
      createdAt: new Date("2026-04-23T14:42:00Z"),
      handledById: "u_8",
      handledAt: new Date("2026-04-24T08:11:00Z"),
      notes: "Confirmed — caused by stale browser cache. Replied with Cmd-Shift-R workaround. Closing.",
    },
    {
      key: "contact_seed_003",
      name: "Camille Boucher",
      email: "camille@boucher-vastgoed.be",
      phone: "+32 491 33 22 11",
      subject: null,
      message: "Are EPC certificates issued same-day for urgent listings?",
      createdAt: new Date("2026-04-26T16:08:00Z"),
      handledById: null,
    },
  ];
  for (const c of contactSeeds) {
    const exists = await prisma.contactSubmission.findFirst({
      where: { email: c.email, createdAt: c.createdAt },
    });
    if (exists) continue;
    const { key: _key, ...rest } = c;
    await prisma.contactSubmission.create({ data: rest });
  }

  // ─── Extra comments on a few of the new assignments ────────────────
  const extraComments: Array<{
    assignmentId: string;
    authorId: string | null;
    authorLabel?: string;
    body: string;
    daysAgo: number;
  }> = [
    {
      assignmentId: "a_1007",
      authorId: "u_3",
      body: "Inspection finished — full report uploaded. Asbestos found in two utility-room ceiling panels; flagged in the attest.",
      daysAgo: 16,
    },
    {
      assignmentId: "a_1011",
      authorId: "u_10",
      body: "Tenant phone updated — try +32 478 66 55 44 instead. Owner can be reached after 18:00.",
      daysAgo: 3,
    },
    {
      assignmentId: "a_1014",
      authorId: "u_7",
      body: "On site now — fuel-tank check done, electrical inspection in progress. Expect to deliver tomorrow.",
      daysAgo: 1,
    },
    {
      assignmentId: "a_1014",
      authorId: null,
      authorLabel: "System",
      body: "Calendar event pushed to Nele's Outlook calendar.",
      daysAgo: 1,
    },
    {
      assignmentId: "a_1019",
      authorId: "u_1",
      body: "Cancellation reason recorded. Will offer the slot to a different freelancer when the owner re-lists.",
      daysAgo: 11,
    },
  ];
  for (const c of extraComments) {
    const exists = await prisma.assignmentComment.findFirst({
      where: { assignmentId: c.assignmentId, body: c.body },
    });
    if (exists) continue;
    await prisma.assignmentComment.create({
      data: {
        assignmentId: c.assignmentId,
        authorId: c.authorId ? aid(c.authorId) : null,
        authorLabel: c.authorLabel,
        body: c.body,
        createdAt: new Date(Date.now() - c.daysAgo * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("✅ seed complete");
  console.log(`\n  Login emails:`);
  console.log(`    admin    → jordan@asbestexperts.be`);
  console.log(`    realtor  → els@vastgoedantwerp.be   (owner — Vastgoed Antwerp)`);
  console.log(`    realtor  → pierre@immobruxelles.be  (owner — Immo Bruxelles)`);
  console.log(`    realtor  → charlotte@immo-liege.be  (owner — Immo Liège)`);
  console.log(`    realtor  → anouk@brugge-vastgoed.be (owner — Brugge Vastgoed)`);
  console.log(`    freelancer → tim@immo.be / sofie@immo.be / dieter@immo.be / nele@immo.be / bart@immo.be / camille@immo.be / hugo@immo.be`);
  console.log(`    staff    → marie@immo.be / david@immo.be`);
  console.log(`\n  Password (all): ${DEV_PASSWORD}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
