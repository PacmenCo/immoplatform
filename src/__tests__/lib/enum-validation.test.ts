import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isRole, isStatus, parseRole, parseStatus } from "@/lib/enum-validation";

// Parity concern: Prisma returns role + status as `string`. Drift in the
// DB (e.g. "superadmin") must not silently grant power. The boundary
// helpers fall back to least-privileged defaults + log a warning.

describe("isRole", () => {
  it("accepts the 4 known roles", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("staff")).toBe(true);
    expect(isRole("realtor")).toBe(true);
    expect(isRole("freelancer")).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(isRole("superadmin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole("Admin")).toBe(false); // case-sensitive
    expect(isRole("anonymous")).toBe(false);
  });
});

describe("isStatus", () => {
  it("accepts all 8 statuses in STATUS_ORDER", () => {
    for (const s of [
      "draft",
      "awaiting",
      "scheduled",
      "in_progress",
      "delivered",
      "completed",
      "on_hold",
      "cancelled",
    ]) {
      expect(isStatus(s)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isStatus("pending")).toBe(false);
    expect(isStatus("IN_PROGRESS")).toBe(false); // case-sensitive
    expect(isStatus("")).toBe(false);
  });
});

describe("parseRole", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns the input when it's a known role, without warning", () => {
    expect(parseRole("admin")).toBe("admin");
    expect(parseRole("freelancer")).toBe("freelancer");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to least-privileged 'freelancer' on drift", () => {
    expect(parseRole("superadmin")).toBe("freelancer");
  });

  it("warns with the offending value + context on drift", () => {
    parseRole("superadmin", "session.user.role");
    expect(warnSpy).toHaveBeenCalledOnce();
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("superadmin");
    expect(msg).toContain("session.user.role");
    expect(msg).toContain("freelancer");
  });

  it("omits context-suffix when no context passed", () => {
    parseRole("superadmin");
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).not.toContain("(at ");
  });
});

describe("parseStatus", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns the input when it's a known status, without warning", () => {
    expect(parseStatus("completed")).toBe("completed");
    expect(parseStatus("scheduled")).toBe("scheduled");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("falls back to non-terminal 'draft' on drift", () => {
    // draft was chosen because it's a pre-lifecycle state — a drifted
    // row can't accidentally fire commission calc or calendar sync,
    // which "scheduled" or later states would.
    expect(parseStatus("pending")).toBe("draft");
  });

  it("warns with the offending value + context on drift", () => {
    parseStatus("pending", "Assignment.status@create");
    expect(warnSpy).toHaveBeenCalledOnce();
    const msg = warnSpy.mock.calls[0][0] as string;
    expect(msg).toContain("pending");
    expect(msg).toContain("Assignment.status@create");
    expect(msg).toContain("draft");
  });
});
