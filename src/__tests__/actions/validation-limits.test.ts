import { describe, expect, it } from "vitest";
import { createAssignmentInner } from "@/app/actions/assignments";
import { createTeamInner, updateTeamInner } from "@/app/actions/teams";
import { setupTestDb } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";

// Lock-in tests for v2 field-length limits that DIVERGE from Platform's
// validation rules.
//
// The v1-vs-v2 scan flagged 9 fields where v2 is stricter than Platform.
// Deliberate or not, a future refactor that loosens or tightens a bound
// should fail a named test instead of silently shipping. The checks are
// boundary-only: each field asserts (a) the max accepted, (b) the first
// rejected value above it.
//
// Divergences locked here (v2 value, Platform value, source):
//   - teams.name        120 / 255  (stricter)   teams.ts teamSchema
//   - teams.email       200 / 255  (stricter)   teams.ts teamSchema
//   - teams.billingEmail 200 / 255 (stricter)   teams.ts teamSchema
//   - teams.legalName    200 / 255 (stricter)   teams.ts teamSchema
//   - teams.vatNumber     40 / 50  (stricter)   teams.ts teamSchema
//   - teams.kboNumber     40 / 50  (stricter)   teams.ts teamSchema
//   - assignments.address  200 / 255 (stricter) assignments.ts createSchema
//   - assignments.ownerName 200 / 255 (stricter) createSchema
//   - assignments.ownerCity 100 / 255 (stricter) createSchema
//
// Platform's Controllers live at:
//   Platform/app/Http/Controllers/TeamController.php (store + update)
//   Platform/app/Http/Controllers/AssignmentController.php (store)

setupTestDb();

function teamForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    name: "Team Name",
    logo: "TN",
    logoColor: "#0f172a",
    commissionType: "none",
    commissionValue: "",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) fd.set(k, v);
  return fd;
}

function asgForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    address: "Rue Test 1",
    city: "Brussels",
    postal: "1000",
    "owner-name": "Owner Name",
    service_asbestos: "on",
    type: "apartment",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) fd.set(k, v);
  return fd;
}

describe("teams.name — capped at 120 (Platform: 255)", () => {
  it("120 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ name: "x".repeat(120) }),
    );
    expect(res.ok).toBe(true);
  });

  it("121 chars → rejected (stricter than Platform's 255)", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ name: "x".repeat(121) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("teams.email — capped at 200 (Platform: 255)", () => {
  it("200 chars total → accepted", async () => {
    const { admin } = await seedBaseline();
    // Build a 200-char email: "x" × 189 + "@a.com" (6) + "…" adjust.
    // 200 total: local(194) + "@a.test" (7) = 201. Use 193+7=200.
    const email = "x".repeat(193) + "@a.test";
    expect(email.length).toBe(200);
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ email }),
    );
    expect(res.ok).toBe(true);
  });

  it("201 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const email = "x".repeat(194) + "@a.test";
    expect(email.length).toBe(201);
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ email }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("teams.vatNumber — capped at 40 (Platform: 50)", () => {
  it("40 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ vatNumber: "x".repeat(40) }),
    );
    expect(res.ok).toBe(true);
  });

  it("41 chars → rejected (stricter than Platform's 50)", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ vatNumber: "x".repeat(41) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("teams.kboNumber — capped at 40 (Platform: 50)", () => {
  it("40 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ kboNumber: "x".repeat(40) }),
    );
    expect(res.ok).toBe(true);
  });

  it("41 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ kboNumber: "x".repeat(41) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("teams.legalName — capped at 200 (Platform: 255)", () => {
  it("200 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ legalName: "x".repeat(200) }),
    );
    expect(res.ok).toBe(true);
  });

  it("201 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createTeamInner(
      admin,
      undefined,
      teamForm({ legalName: "x".repeat(201) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("teams (update path) uses the same limits", () => {
  it("updateTeam also rejects name > 120 (lock ensures drift is symmetric on create+update)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await updateTeamInner(
      admin,
      teams.t1.id,
      undefined,
      teamForm({ name: "x".repeat(121) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.address — capped at 200 (Platform: 255)", () => {
  it("200 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ address: "x".repeat(200) }),
    );
    expect(res.ok).toBe(true);
  });

  it("201 chars → rejected (stricter than Platform's 255)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ address: "x".repeat(201) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.ownerName — capped at 200 (Platform: 255)", () => {
  it("200 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ "owner-name": "x".repeat(200) }),
    );
    expect(res.ok).toBe(true);
  });

  it("201 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ "owner-name": "x".repeat(201) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.city — capped at 100 (Platform: 100 — aligned)", () => {
  // Sanity: this one matches Platform, but lock the bound so future drift shows.
  it("100 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ city: "x".repeat(100) }),
    );
    expect(res.ok).toBe(true);
  });

  it("101 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ city: "x".repeat(101) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.ownerCity — capped at 100 (Platform: 255)", () => {
  it("100 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ "owner-city": "x".repeat(100) }),
    );
    expect(res.ok).toBe(true);
  });

  it("101 chars → rejected (stricter than Platform's 255)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ "owner-city": "x".repeat(101) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.postal — capped at 10 (Platform: 10 — aligned)", () => {
  it("10 chars → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ postal: "x".repeat(10) }),
    );
    expect(res.ok).toBe(true);
  });

  it("11 chars → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ postal: "x".repeat(11) }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.quantity — 1..10 range (Platform parity)", () => {
  it("quantity=1 (lower bound) → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ quantity: "1" }),
    );
    expect(res.ok).toBe(true);
  });

  it("quantity=10 (upper bound) → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ quantity: "10" }),
    );
    expect(res.ok).toBe(true);
  });

  it("quantity=11 → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ quantity: "11" }),
    );
    expect(res.ok).toBe(false);
  });

  it("quantity=0 → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ quantity: "0" }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.areaM2 — 1..100000 range (Platform parity)", () => {
  it("1 → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ area: "1" }),
    );
    expect(res.ok).toBe(true);
  });

  it("100000 → accepted", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ area: "100000" }),
    );
    expect(res.ok).toBe(true);
  });

  it("100001 → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ area: "100001" }),
    );
    expect(res.ok).toBe(false);
  });
});

describe("assignments.constructionYear — 1800..current+2 (Platform: string/max:20)", () => {
  // Platform stores the year as a loose `string|max:20`; v2 tightens to a
  // real year range. Locks the intentional drift — a future refactor to
  // accept strings must fail a named test.
  it("1800 → accepted (lower bound)", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ year: "1800" }),
    );
    expect(res.ok).toBe(true);
  });

  it("1799 → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ year: "1799" }),
    );
    expect(res.ok).toBe(false);
  });

  it("current year + 2 → accepted (upper bound)", async () => {
    const { admin } = await seedBaseline();
    const thisYear = new Date().getFullYear();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ year: String(thisYear + 2) }),
    );
    expect(res.ok).toBe(true);
  });

  it("current year + 3 → rejected", async () => {
    const { admin } = await seedBaseline();
    const thisYear = new Date().getFullYear();
    const res = await createAssignmentInner(
      admin,
      undefined,
      asgForm({ year: String(thisYear + 3) }),
    );
    expect(res.ok).toBe(false);
  });
});
