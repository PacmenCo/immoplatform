import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { updateNotificationPrefsInner } from "@/app/actions/preferences";
import { eventsForRole } from "@/lib/email-events";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";

// Covers:
//   1. Only overwrites keys the viewer's role can see; preserves other-role
//      keys already stored (Platform doesn't have role-gated merging).
//   2. Missing checkbox → written as `false` (opt-out).
//   3. Checked checkbox → written as `true`.
//   4. Corrupt existing JSON → falls back to empty object, doesn't throw.
//   5. First-time save (no emailPrefs row) → writes fresh JSON.

setupTestDb();

function form(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

describe("updateNotificationPrefsInner — role-gated merge", () => {
  it("freelancer save preserves realtor-only keys already stored", async () => {
    const { freelancer } = await seedBaseline();
    // Pre-seed a mix: a realtor-only key + a freelancer-visible key.
    const realtorOnlyKey = eventsForRole("realtor").find(
      (k) => !eventsForRole("freelancer").includes(k),
    );
    if (!realtorOnlyKey) throw new Error("expected realtor-only key in the registry");
    await prisma.user.update({
      where: { id: freelancer.user.id },
      data: {
        emailPrefs: JSON.stringify({
          [realtorOnlyKey]: false, // pre-existing opt-out — must survive
          "assignment.files_uploaded": false, // freelancer-visible
        }),
      },
    });
    // Submit with the freelancer-visible event checked on.
    await updateNotificationPrefsInner(
      freelancer,
      undefined,
      form({ "assignment.files_uploaded": "on" }),
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: freelancer.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    // Realtor-only key preserved as-is.
    expect(stored[realtorOnlyKey]).toBe(false);
    // Freelancer-visible key flipped to true (was false, is now checked).
    expect(stored["assignment.files_uploaded"]).toBe(true);
  });

  it("unchecked box for a role-visible key → stored as false (explicit opt-out)", async () => {
    const { freelancer } = await seedBaseline();
    const visible = eventsForRole("freelancer");
    if (visible.length === 0) throw new Error("expected freelancer to have visible events");
    // Submit empty form — every role-visible key should be written as false.
    await updateNotificationPrefsInner(freelancer, undefined, new FormData());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: freelancer.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    for (const key of visible) {
      expect(stored[key]).toBe(false);
    }
  });

  it("checked box writes true", async () => {
    const { freelancer } = await seedBaseline();
    const visible = eventsForRole("freelancer");
    const checkedAll: Record<string, string> = {};
    for (const key of visible) checkedAll[key] = "on";
    await updateNotificationPrefsInner(freelancer, undefined, form(checkedAll));
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: freelancer.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    for (const key of visible) {
      expect(stored[key]).toBe(true);
    }
  });
});

describe("updateNotificationPrefsInner — edge cases", () => {
  it("corrupt existing JSON → falls back to {} (no throw) + writes fresh", async () => {
    const { realtor } = await seedBaseline();
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { emailPrefs: "{not-valid-json" },
    });
    const visible = eventsForRole("realtor");
    if (visible.length === 0) throw new Error("expected realtor visible events");
    const res = await updateNotificationPrefsInner(
      realtor,
      undefined,
      form({ [visible[0]]: "on" }),
    );
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    expect(stored[visible[0]]).toBe(true);
  });

  it("null existing emailPrefs (first-time save) → writes a fresh JSON blob", async () => {
    const { realtor } = await seedBaseline();
    await prisma.user.update({
      where: { id: realtor.user.id },
      // `emailPrefs` is `Json?` — `Prisma.JsonNull` sentinel for explicit null.
      data: { emailPrefs: Prisma.JsonNull },
    });
    const visible = eventsForRole("realtor");
    const res = await updateNotificationPrefsInner(
      realtor,
      undefined,
      form({ [visible[0]]: "on" }),
    );
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
      select: { emailPrefs: true },
    });
    expect(user.emailPrefs).not.toBeNull();
    const stored = auditMeta(user.emailPrefs);
    expect(stored[visible[0]]).toBe(true);
  });

  it("stored JSON with non-boolean values is preserved unmodified (don't mutate other keys)", async () => {
    const { freelancer } = await seedBaseline();
    await prisma.user.update({
      where: { id: freelancer.user.id },
      data: {
        emailPrefs: JSON.stringify({
          "some.legacy_key": "maybe",
          "another.stray": 42,
        }),
      },
    });
    await updateNotificationPrefsInner(freelancer, undefined, new FormData());
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: freelancer.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    // Legacy keys survive regardless of type.
    expect(stored["some.legacy_key"]).toBe("maybe");
    expect(stored["another.stray"]).toBe(42);
  });

  it("form keys for events the user's role CANNOT see → silently dropped", async () => {
    const { freelancer } = await seedBaseline();
    const realtorOnly = eventsForRole("realtor").find(
      (k) => !eventsForRole("freelancer").includes(k),
    );
    if (!realtorOnly) throw new Error("need a realtor-only key");
    // Freelancer tries to write a realtor-only key — must be ignored.
    await updateNotificationPrefsInner(
      freelancer,
      undefined,
      form({ [realtorOnly]: "on" }),
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: freelancer.user.id },
      select: { emailPrefs: true },
    });
    const stored = auditMeta(user.emailPrefs);
    expect(stored).not.toHaveProperty(realtorOnly);
  });
});
