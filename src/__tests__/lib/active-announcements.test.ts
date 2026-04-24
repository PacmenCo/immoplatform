import { describe, expect, it } from "vitest";
import { loadActiveAnnouncements } from "@/lib/announcements";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";

// Platform parity — Announcement::scopeActive + scopeCurrent combined with
// the per-user dismissal filter. The equivalent in v2 is this one helper
// that feeds every banner slot in the dashboard layout.
//
// Contract:
//   1. Must NOT return anything where isActive = false
//   2. Must NOT return anything outside the [startsAt, endsAt] window
//   3. Must NOT return anything the given user has already dismissed
//   4. MUST return the rest, sorted startsAt DESC
//   5. Other users' dismissals must not affect this user's view

setupTestDb();

async function seedAnn(opts: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  isActive?: boolean;
  type?: "info" | "success" | "warning" | "danger";
  isDismissible?: boolean;
  title?: string;
}) {
  return prisma.announcement.create({
    data: {
      id: opts.id,
      title: opts.title ?? `ann-${opts.id}`,
      body: "body",
      type: opts.type ?? "info",
      isActive: opts.isActive ?? true,
      isDismissible: opts.isDismissible ?? true,
      startsAt: opts.startsAt,
      endsAt: opts.endsAt,
    },
  });
}

describe("loadActiveAnnouncements — time window", () => {
  it("includes announcements whose window covers `now`", async () => {
    const { freelancer } = await seedBaseline();
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await seedAnn({
      id: "a_in_window",
      startsAt: yesterday,
      endsAt: tomorrow,
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).toContain("a_in_window");
  });

  it("EXCLUDES future announcements (startsAt > now)", async () => {
    const { freelancer } = await seedBaseline();
    const tomorrow = new Date(Date.now() + 86_400_000);
    const nextWeek = new Date(Date.now() + 7 * 86_400_000);
    await seedAnn({
      id: "a_future",
      startsAt: tomorrow,
      endsAt: nextWeek,
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).not.toContain("a_future");
  });

  it("EXCLUDES past announcements (endsAt < now)", async () => {
    const { freelancer } = await seedBaseline();
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
    const yesterday = new Date(Date.now() - 86_400_000);
    await seedAnn({
      id: "a_past",
      startsAt: twoDaysAgo,
      endsAt: yesterday,
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).not.toContain("a_past");
  });

  it("boundary: endsAt exactly now → included (inclusive upper bound)", async () => {
    const { freelancer } = await seedBaseline();
    // Use `new Date()` just before calling the helper — it samples `now` once.
    // A tight margin keeps this deterministic: seed endsAt one second ahead
    // so the helper's `lte/gte` treats it as in-window.
    const startsAt = new Date(Date.now() - 86_400_000);
    const endsAt = new Date(Date.now() + 1000);
    await seedAnn({ id: "a_boundary_end", startsAt, endsAt });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).toContain("a_boundary_end");
  });
});

describe("loadActiveAnnouncements — isActive flag", () => {
  it("EXCLUDES announcements where isActive = false", async () => {
    const { freelancer } = await seedBaseline();
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await seedAnn({
      id: "a_disabled",
      startsAt: yesterday,
      endsAt: tomorrow,
      isActive: false,
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).not.toContain("a_disabled");
  });
});

describe("loadActiveAnnouncements — per-user dismissal", () => {
  it("EXCLUDES announcements the user has dismissed", async () => {
    const { freelancer } = await seedBaseline();
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await seedAnn({
      id: "a_dismissed",
      startsAt: yesterday,
      endsAt: tomorrow,
    });
    await prisma.announcementDismissal.create({
      data: { announcementId: "a_dismissed", userId: freelancer.user.id },
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.id)).not.toContain("a_dismissed");
  });

  it("another user's dismissal does NOT affect this user's view", async () => {
    const { freelancer, realtor } = await seedBaseline();
    const yesterday = new Date(Date.now() - 86_400_000);
    const tomorrow = new Date(Date.now() + 86_400_000);
    await seedAnn({
      id: "a_dismissed_by_other",
      startsAt: yesterday,
      endsAt: tomorrow,
    });
    // realtor dismissed; freelancer should still see it.
    await prisma.announcementDismissal.create({
      data: { announcementId: "a_dismissed_by_other", userId: realtor.user.id },
    });
    const freelancerRows = await loadActiveAnnouncements(freelancer.user.id);
    expect(freelancerRows.map((r) => r.id)).toContain("a_dismissed_by_other");
    const realtorRows = await loadActiveAnnouncements(realtor.user.id);
    expect(realtorRows.map((r) => r.id)).not.toContain("a_dismissed_by_other");
  });
});

describe("loadActiveAnnouncements — sorting + shape", () => {
  it("sorts by startsAt DESC (newest window first)", async () => {
    const { freelancer } = await seedBaseline();
    const now = Date.now();
    await seedAnn({
      id: "a_oldest_start",
      startsAt: new Date(now - 3 * 86_400_000),
      endsAt: new Date(now + 86_400_000),
    });
    await seedAnn({
      id: "a_middle_start",
      startsAt: new Date(now - 86_400_000),
      endsAt: new Date(now + 86_400_000),
    });
    await seedAnn({
      id: "a_newest_start",
      startsAt: new Date(now - 3600_000),
      endsAt: new Date(now + 86_400_000),
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    const ids = rows.map((r) => r.id);
    expect(ids).toEqual(["a_newest_start", "a_middle_start", "a_oldest_start"]);
  });

  it("returned shape has id/title/body/type/isDismissible — no extra fields leak", async () => {
    const { freelancer } = await seedBaseline();
    await seedAnn({
      id: "a_shape_check",
      startsAt: new Date(Date.now() - 3600_000),
      endsAt: new Date(Date.now() + 3600_000),
      title: "Heads up",
      type: "warning",
      isDismissible: false,
    });
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    const row = rows.find((r) => r.id === "a_shape_check");
    expect(row).toBeDefined();
    expect(row).toEqual({
      id: "a_shape_check",
      title: "Heads up",
      body: "body",
      type: "warning",
      isDismissible: false,
    });
    // No startsAt / endsAt / createdById etc leak into the client-shape DTO.
    expect(row).not.toHaveProperty("startsAt");
    expect(row).not.toHaveProperty("endsAt");
  });

  it("type values 'info' / 'success' / 'warning' / 'danger' all pass through", async () => {
    const { freelancer } = await seedBaseline();
    const now = Date.now();
    const types = ["info", "success", "warning", "danger"] as const;
    for (const type of types) {
      await seedAnn({
        id: `a_type_${type}`,
        type,
        startsAt: new Date(now - 3600_000),
        endsAt: new Date(now + 3600_000),
      });
    }
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows.map((r) => r.type).sort()).toEqual(
      [...types].sort(),
    );
  });

  it("empty DB → empty array (no nulls, no throw)", async () => {
    const { freelancer } = await seedBaseline();
    const rows = await loadActiveAnnouncements(freelancer.user.id);
    expect(rows).toEqual([]);
  });
});
