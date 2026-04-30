import { describe, it, expect } from "vitest";
import {
  SWITCHER_GROUP,
  isSwitcherMember,
} from "@/lib/account-switcher";

describe("account-switcher / isSwitcherMember", () => {
  it("returns true for the founder admin email", () => {
    expect(isSwitcherMember("jordan@asbestexperts.be")).toBe(true);
  });

  it("returns true for any seeded @immo.test test account", () => {
    expect(isSwitcherMember("test-staff@immo.test")).toBe(true);
    expect(isSwitcherMember("test-realtor@immo.test")).toBe(true);
    expect(isSwitcherMember("test-freelancer@immo.test")).toBe(true);
  });

  it("returns false for emails outside the group", () => {
    expect(isSwitcherMember("attacker@example.com")).toBe(false);
    expect(isSwitcherMember("els@vastgoedantwerp.be")).toBe(false);
    expect(isSwitcherMember("")).toBe(false);
  });

  it("normalizes case + whitespace before comparing", () => {
    expect(isSwitcherMember("Jordan@Asbestexperts.be")).toBe(true);
    expect(isSwitcherMember("  jordan@asbestexperts.be  ")).toBe(true);
    expect(isSwitcherMember("TEST-REALTOR@IMMO.TEST")).toBe(true);
  });

  it("SWITCHER_GROUP contains Jordan + one test user per non-admin role", () => {
    expect(SWITCHER_GROUP).toContain("jordan@asbestexperts.be");
    const testUsers = SWITCHER_GROUP.filter((e) => e.endsWith("@immo.test"));
    expect(testUsers).toHaveLength(3);
  });

  it("SWITCHER_GROUP entries are stored lowercase", () => {
    for (const email of SWITCHER_GROUP) {
      expect(email).toBe(email.toLowerCase());
    }
  });
});
