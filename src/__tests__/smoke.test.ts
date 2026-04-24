import { describe, it, expect } from "vitest";

// Smoke test — proves the test runner, tsconfig-paths, and env setup all
// wire together. Delete once Phase 1 suites land real coverage.
describe("smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });

  it("loads the env overrides from setupFiles", () => {
    expect(process.env.EMAIL_PROVIDER).toBe("dev");
    expect(process.env.SKIP_CALENDAR_SYNC).toBe("1");
    expect(process.env.CRON_SECRET).toBe("test-cron-secret");
    expect(process.env.DATABASE_URL).toMatch(/immo_test/);
  });

  it("resolves @/ path aliases", async () => {
    const { STATUS_ORDER } = await import("@/lib/mockData");
    expect(STATUS_ORDER).toContain("scheduled");
    expect(STATUS_ORDER).toContain("awaiting");
  });
});
