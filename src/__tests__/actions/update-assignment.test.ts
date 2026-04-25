import { describe, expect, it } from "vitest";
import { updateAssignmentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

// Optimistic-locking suite. Verifies that `updateAssignmentInner` rejects
// stale-snapshot saves (someone else edited the row first) with a distinct
// error from the existing terminal-state guard, while preserving the
// previous behavior for callers that don't yet pass `loaded-at`.

setupTestDb();

// Build a minimal-but-valid FormData matching `updateSchema`.
// `loadedAt` is appended only when set — tests pass a real ISO string for
// the locked path, omit it for the legacy fall-through, and pass an
// intentionally-stale string to exercise the collision branch.
function buildUpdateForm(
  overrides: Record<string, string> = {},
  loadedAt?: string,
): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    address: "1 Teststraat",
    city: "Antwerpen",
    postal: "2000",
    "owner-name": "Test Owner",
    // Zod requires ≥ 1 service; match the seeded assignment's existing one
    // so the delete-and-recreate path doesn't reprice it to 0.
    service_asbestos: "on",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  if (loadedAt !== undefined) fd.set("loaded-at", loadedAt);
  return fd;
}

describe("updateAssignmentInner — optimistic locking", () => {
  it("rejects a stale `loaded-at` with the concurrent-edit error", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_stale",
      status: "scheduled",
      teamId: teams.t1.id,
      preferredDate: new Date("2026-04-01T10:00:00Z"),
    });

    // Simulate another tab winning the race: bump `updatedAt` between the
    // user's page-load and submit. We capture the original snapshot first
    // so we can post it back as the (now stale) `loaded-at`.
    const originalUpdatedAt = asg.updatedAt;
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { address: "Other tab won", updatedAt: new Date() },
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "My pending change" },
        originalUpdatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({
      ok: false,
      error:
        "Someone else just edited this assignment. Reload to see their changes.",
    });

    // The "winning" tab's address should still be in the row — our stale
    // submit must NOT have clobbered it.
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Other tab won");
  });

  it("accepts an up-to-date `loaded-at` and writes the changes", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_fresh",
      status: "scheduled",
      teamId: teams.t1.id,
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Updated address 12" },
        asg.updatedAt.toISOString(),
      ),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Updated address 12");
  });

  it("falls through to last-write-wins when the form omits `loaded-at`", async () => {
    // Defensive default for callers that haven't been migrated yet — the
    // pre-locking behavior should still produce a successful save even if
    // someone else just edited. Verifies we didn't accidentally make the
    // lock mandatory for everyone.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_legacy",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    // Bump updatedAt so a strict lock would fail — a legacy form without
    // `loaded-at` should not care.
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { address: "Other tab", updatedAt: new Date() },
    });

    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ address: "Legacy client save" }),
      // No loaded-at passed — explicit undefined.
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { address: true },
    });
    expect(after.address).toBe("Legacy client save");
  });

  it("does not surface the stale-snapshot copy when the row is terminal", async () => {
    // Guards the discrimination: a cancelled row must hit the terminal
    // path, never the new "Someone else just edited" copy. The early-
    // return at the top of the action wins for an already-cancelled row,
    // which is the most common real-world race shape.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_terminal",
      status: "scheduled",
      teamId: teams.t1.id,
    });

    const originalUpdatedAt = asg.updatedAt;
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { status: "cancelled" },
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm(
        { address: "Trying after cancel" },
        originalUpdatedAt.toISOString(),
      ),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).not.toContain("Someone else just edited");
      expect(res.error).toMatch(/cancelled/i);
    }
  });

  it("rejects a malformed `loaded-at` by treating it as missing (legacy fall-through)", async () => {
    // A garbage value in the hidden field shouldn't poison every save with
    // a permanent stale-snapshot error. parseLoadedAt returns null for
    // unparseable dates, so the action falls through to the pre-lock path.
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_optimistic_garbage",
      status: "scheduled",
      teamId: teams.t1.id,
    });
    const res = await updateAssignmentInner(
      admin,
      asg.id,
      undefined,
      buildUpdateForm({ address: "Garbage loaded-at" }, "not-a-date"),
    );
    expect(res).toEqual({ ok: true });
  });
});
