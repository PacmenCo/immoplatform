import { describe, it, expect } from "vitest";
import {
  TRANSITIONS,
  EARLY_STATUSES,
  canTransition,
  sourcesOf,
  canRoleTransitionTo,
  allowedTargetsForRole,
} from "@/lib/assignmentStatus";
import { STATUS_ORDER, type Status } from "@/lib/mockData";
import type { Role } from "@/lib/permissions.types";

// Platform parity:
// - TRANSITIONS mirrors Platform's informal state machine
// - ROLE_ALLOWED_STATUSES derived from StatusSeeder.php's role_status pivot:
//     admin/medewerker → all
//     makelaar → on_hold + cancelled
//     freelancer → In afwachting + Ingepland + In verwerking
// - EARLY_STATUSES = autoStatusForDateChange trigger window { Nieuw, In afwachting, On hold }
//     → immo { draft, awaiting, on_hold }

describe("TRANSITIONS table — exhaustive over STATUS_ORDER", () => {
  it("covers every Status as a key", () => {
    for (const s of STATUS_ORDER) {
      expect(TRANSITIONS).toHaveProperty(s);
    }
  });

  it("terminal states (completed, cancelled) have empty outbound edges", () => {
    expect(TRANSITIONS.completed).toEqual([]);
    expect(TRANSITIONS.cancelled).toEqual([]);
  });

  it("cancelled is reachable from every non-terminal state", () => {
    for (const s of STATUS_ORDER) {
      if (s === "completed" || s === "cancelled") continue;
      expect((TRANSITIONS[s] as readonly Status[]).includes("cancelled")).toBe(true);
    }
  });

  it("completed is reachable from scheduled and in_progress", () => {
    expect(sourcesOf("completed").sort()).toEqual(["in_progress", "scheduled"].sort());
  });

  it("no transitions out of terminal states", () => {
    expect(canTransition("completed", "scheduled")).toBe(false);
    expect(canTransition("cancelled", "scheduled")).toBe(false);
    expect(canTransition("completed", "draft")).toBe(false);
  });
});

describe("canTransition — spot checks", () => {
  it.each([
    ["draft", "awaiting", true],
    ["draft", "scheduled", true],
    ["draft", "completed", false], // can't skip in_progress
    ["awaiting", "scheduled", true],
    ["scheduled", "awaiting", true], // date cleared → revert
    ["scheduled", "in_progress", true],
    ["scheduled", "completed", true],
    ["in_progress", "completed", true],
    ["on_hold", "awaiting", true],
    ["on_hold", "in_progress", true],
  ] as Array<[Status, Status, boolean]>)(
    "canTransition(%s → %s) === %s",
    (from, to, expected) => {
      expect(canTransition(from, to)).toBe(expected);
    },
  );
});

describe("EARLY_STATUSES", () => {
  it("contains exactly {draft, awaiting, on_hold} — Platform autoStatusForDateChange trigger window", () => {
    expect(EARLY_STATUSES.has("draft")).toBe(true);
    expect(EARLY_STATUSES.has("awaiting")).toBe(true);
    expect(EARLY_STATUSES.has("on_hold")).toBe(true);
    expect(EARLY_STATUSES.size).toBe(3);
  });

  it("does NOT include scheduled / in_progress / completed / cancelled", () => {
    expect(EARLY_STATUSES.has("scheduled")).toBe(false);
    expect(EARLY_STATUSES.has("in_progress")).toBe(false);
    expect(EARLY_STATUSES.has("completed")).toBe(false);
    expect(EARLY_STATUSES.has("cancelled")).toBe(false);
  });
});

describe("canRoleTransitionTo — Platform role_status pivot parity", () => {
  // Admin + staff get everything.
  it.each([
    ["admin", "draft"],
    ["admin", "awaiting"],
    ["admin", "scheduled"],
    ["admin", "in_progress"],
    ["admin", "completed"],
    ["admin", "on_hold"],
    ["admin", "cancelled"],
    ["staff", "completed"],
    ["staff", "cancelled"],
  ] as Array<[Role, Status]>)(
    "%s can set %s",
    (role, to) => {
      expect(canRoleTransitionTo(role, "draft", to)).toBe(true);
    },
  );

  // Realtor (makelaar) can only set on_hold or cancelled as distinct targets.
  it("realtor can set on_hold and cancelled only", () => {
    expect(canRoleTransitionTo("realtor", "scheduled", "on_hold")).toBe(true);
    expect(canRoleTransitionTo("realtor", "scheduled", "cancelled")).toBe(true);
  });

  it("realtor cannot set draft / awaiting / scheduled / in_progress / completed (different-from-current)", () => {
    const banned: Status[] = ["draft", "awaiting", "scheduled", "in_progress", "completed"];
    for (const to of banned) {
      expect(canRoleTransitionTo("realtor", "on_hold", to)).toBe(false);
    }
  });

  // Freelancer gets the three lifecycle states matching Platform seeder.
  it("freelancer can set awaiting / scheduled / in_progress", () => {
    expect(canRoleTransitionTo("freelancer", "draft", "awaiting")).toBe(true);
    expect(canRoleTransitionTo("freelancer", "draft", "scheduled")).toBe(true);
    expect(canRoleTransitionTo("freelancer", "draft", "in_progress")).toBe(true);
  });

  it("freelancer CANNOT set cancelled — enforces Platform's 'only medewerker/admin/makelaar can cancel'", () => {
    expect(canRoleTransitionTo("freelancer", "scheduled", "cancelled")).toBe(false);
  });

  it("freelancer cannot set draft / completed / on_hold", () => {
    const banned: Status[] = ["draft", "completed", "on_hold"];
    for (const to of banned) {
      expect(canRoleTransitionTo("freelancer", "scheduled", to)).toBe(false);
    }
  });

  it("same-state is always allowed (noop — form resubmit safety)", () => {
    for (const role of ["admin", "staff", "realtor", "freelancer"] as Role[]) {
      for (const s of STATUS_ORDER) {
        expect(canRoleTransitionTo(role, s, s)).toBe(true);
      }
    }
  });
});

describe("allowedTargetsForRole", () => {
  it("admin gets all 7 statuses regardless of current", () => {
    const targets = allowedTargetsForRole("admin", "draft");
    expect(targets.length).toBe(7);
    for (const s of STATUS_ORDER) {
      expect(targets).toContain(s);
    }
  });

  it("realtor gets {on_hold, cancelled} when current is outside that set", () => {
    const targets = allowedTargetsForRole("realtor", "scheduled");
    // current state always included even when out-of-allowlist
    expect(targets).toContain("on_hold");
    expect(targets).toContain("cancelled");
    expect(targets).toContain("scheduled");
  });

  it("realtor: current inside the allowlist — no duplicate appended", () => {
    const targets = allowedTargetsForRole("realtor", "on_hold");
    // only 2 allowed + no-op already covered by "on_hold" being in base
    expect(targets.length).toBe(2);
  });

  it("freelancer gets role allowlist + current (which may be outside)", () => {
    const targets = allowedTargetsForRole("freelancer", "completed");
    expect(targets).toContain("completed");
    expect(targets).toContain("awaiting");
    expect(targets).toContain("scheduled");
    expect(targets).toContain("in_progress");
    expect(targets.length).toBe(4);
  });
});
