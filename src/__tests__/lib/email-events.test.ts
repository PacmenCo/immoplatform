import { describe, it, expect } from "vitest";
import {
  EMAIL_CATEGORIES,
  EMAIL_EVENTS,
  eventsForRole,
  shouldSendEmail,
} from "@/lib/email-events";

// Platform parity:
// - EmailTypesSeeder + EmailPreferences Livewire — categories
//   opdrachten/kantoren/gebruikers/overig map to assignment/team/user/system
// - DisabledEmailPreference — opt-out model: absent/null/malformed prefs
//   → receive by default
// - forRoles per event gates who sees the toggle

describe("EMAIL_CATEGORIES", () => {
  it("ordered: assignment → team → user (Platform Livewire order, no system since 2026-04-29)", () => {
    // The "system" category was dropped along with the three system.* events
    // (invoice-reminder, odoo_sync_failed, error) — none had a real per-user
    // gate. Re-add when a system event grows real notify()-driven fan-out.
    expect(EMAIL_CATEGORIES.map((c) => c.key)).toEqual([
      "assignment",
      "team",
      "user",
    ]);
  });

  it("every category has label + description for the prefs UI", () => {
    for (const c of EMAIL_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.description.length).toBeGreaterThan(0);
    }
  });
});

describe("EMAIL_EVENTS registry", () => {
  it("every event has label, description, forRoles, category", () => {
    for (const [key, ev] of Object.entries(EMAIL_EVENTS)) {
      expect(ev.label, `${key}.label`).toBeTruthy();
      expect(ev.description, `${key}.description`).toBeTruthy();
      expect(ev.forRoles.length, `${key}.forRoles`).toBeGreaterThan(0);
      expect(["assignment", "team", "user"]).toContain(ev.category);
    }
  });

  it("key convention: object.action (dot-separated)", () => {
    for (const key of Object.keys(EMAIL_EVENTS)) {
      expect(key).toMatch(/^[a-z_]+\.[a-z_]+$/);
    }
  });

  // Platform parity — these events must exist (ported from EmailTypesSeeder):
  it.each([
    "assignment.scheduled",
    "assignment.date_updated",
    "assignment.files_uploaded",
    "assignment.completed",
    "assignment.cancelled",
    "assignment.comment_posted",
    "team.member_added",
    "user.registered",
  ])("contains %s", (k) => {
    expect(EMAIL_EVENTS).toHaveProperty(k);
  });

  // The three system.* events were removed: none had a real per-user gate.
  it.each([
    "billing.monthly_invoice_reminder",
    "system.odoo_sync_failed",
    "system.error",
  ])("does NOT contain decorative event %s", (k) => {
    expect(EMAIL_EVENTS).not.toHaveProperty(k);
  });
});

describe("eventsForRole", () => {
  it("admin sees admin-scoped events", () => {
    const adminEvents = eventsForRole("admin");
    expect(adminEvents).toContain("user.registered");
    expect(adminEvents).toContain("assignment.created");
  });

  it("freelancer does NOT see admin-only events", () => {
    const freelancerEvents = eventsForRole("freelancer");
    expect(freelancerEvents).not.toContain("user.registered");
    // team.member_added is hidden from freelancers — they're platform-global
    // and can't be team members (v1 parity, enforced in invites schema).
    expect(freelancerEvents).not.toContain("team.member_added");
  });

  it("freelancer sees assignment-lifecycle events relevant to them", () => {
    const freelancerEvents = eventsForRole("freelancer");
    expect(freelancerEvents).toContain("assignment.freelancer_assigned");
    expect(freelancerEvents).toContain("assignment.files_uploaded");
  });

  it("realtor sees scheduled/completed but not freelancer-only events", () => {
    const realtorEvents = eventsForRole("realtor");
    expect(realtorEvents).toContain("assignment.scheduled");
    expect(realtorEvents).not.toContain("assignment.freelancer_assigned");
  });
});

describe("shouldSendEmail — opt-out semantics", () => {
  // Uses the event 'assignment.completed' throughout; the contract is
  // event-agnostic.
  const EV = "assignment.completed" as const;

  it("null emailPrefs → send (default-enabled)", () => {
    expect(shouldSendEmail({ emailPrefs: null }, EV)).toBe(true);
  });

  it("empty-string prefs → send (treated as unset)", () => {
    expect(shouldSendEmail({ emailPrefs: "" }, EV)).toBe(true);
  });

  it("valid JSON missing this event key → send (default-enabled)", () => {
    expect(
      shouldSendEmail(
        { emailPrefs: JSON.stringify({ "assignment.scheduled": false }) },
        EV,
      ),
    ).toBe(true);
  });

  it("explicit `false` for this event → do NOT send", () => {
    expect(
      shouldSendEmail({ emailPrefs: JSON.stringify({ [EV]: false }) }, EV),
    ).toBe(false);
  });

  it("explicit `true` for this event → send", () => {
    expect(
      shouldSendEmail({ emailPrefs: JSON.stringify({ [EV]: true }) }, EV),
    ).toBe(true);
  });

  it("non-boolean value for this event (null) → send (only strict `false` opts out)", () => {
    expect(
      shouldSendEmail({ emailPrefs: JSON.stringify({ [EV]: null }) }, EV),
    ).toBe(true);
  });

  it("malformed JSON → send (fail-open to avoid silent-mute bugs)", () => {
    expect(shouldSendEmail({ emailPrefs: "not-json" }, EV)).toBe(true);
    expect(shouldSendEmail({ emailPrefs: "{incomplete" }, EV)).toBe(true);
  });
});
