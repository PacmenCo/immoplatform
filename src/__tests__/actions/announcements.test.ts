import { describe, expect, it } from "vitest";
import {
  createAnnouncementInner,
  deleteAnnouncementInner,
  dismissAnnouncementInner,
  updateAnnouncementInner,
} from "@/app/actions/announcements";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Covers:
//   1. createAnnouncement — admin/staff gate, zod, YYYY-MM-DD date normalization
//   2. updateAnnouncement — permission + zod re-validation
//   3. deleteAnnouncement — permission + not-found
//   4. dismissAnnouncement — any logged-in user, idempotent, refuses
//      non-dismissible announcements

setupTestDb();

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    title: "Scheduled maintenance",
    body: "We'll be upgrading the DB on Saturday.",
    type: "info",
    startsAt: "2026-05-01",
    endsAt: "2026-05-07",
    isActive: "on",
    isDismissible: "on",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

describe("createAnnouncementInner — role gate", () => {
  it("admin allowed", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(admin, undefined, form());
    expect(res.ok).toBe(true);
  });

  it("staff rejected", async () => {
    const { staff } = await seedBaseline();
    const res = await createAnnouncementInner(staff, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "Only admins can publish announcements.",
    });
  });

  it("realtor rejected", async () => {
    const { realtor } = await seedBaseline();
    const res = await createAnnouncementInner(realtor, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "Only admins can publish announcements.",
    });
  });

  it("freelancer rejected", async () => {
    const { freelancer } = await seedBaseline();
    const res = await createAnnouncementInner(freelancer, undefined, form());
    expect(res.ok).toBe(false);
  });
});

describe("createAnnouncementInner — validation + persistence", () => {
  it("writes the row + normalizes startsAt to 00:00Z and endsAt to end-of-day UTC", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ startsAt: "2026-05-01", endsAt: "2026-05-01" }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const row = await prisma.announcement.findUniqueOrThrow({
      where: { id: res.data.id },
    });
    expect(row.startsAt.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    // End-of-day lands on :59:59.999 UTC so a same-day window covers 24h.
    expect(row.endsAt.toISOString()).toBe("2026-05-01T23:59:59.999Z");
    expect(row.createdById).toBe(admin.user.id);
  });

  it("endsAt before startsAt → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ startsAt: "2026-05-10", endsAt: "2026-05-01" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "End date must be on or after the start date.",
    });
  });

  it("invalid date shape → rejected by zod", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ startsAt: "05/01/2026" }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/YYYY-MM-DD/);
  });

  it("empty title → 'Title is required.'", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ title: "" }),
    );
    expect(res).toEqual({ ok: false, error: "Title is required." });
  });

  it("unknown type → rejected", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ type: "bogus" }),
    );
    expect(res.ok).toBe(false);
  });

  it("emits announcement.created audit", async () => {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(
      admin,
      undefined,
      form({ title: "New feature: dark mode" }),
    );
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "announcement.created",
        objectId: res.data.id,
      },
      select: { metadata: true },
    });
    expect(auditMeta(audit.metadata).title).toBe("New feature: dark mode");
  });
});

describe("updateAnnouncementInner", () => {
  async function seedRow() {
    const { admin } = await seedBaseline();
    const res = await createAnnouncementInner(admin, undefined, form());
    if (!res.ok || !res.data) throw new Error("expected id");
    return { id: res.data.id, admin };
  }

  it("admin can update an existing row", async () => {
    const { id, admin } = await seedRow();
    const res = await updateAnnouncementInner(
      admin,
      id,
      undefined,
      form({ title: "Updated title" }),
    );
    expect(res).toEqual({ ok: true });
    const row = await prisma.announcement.findUniqueOrThrow({ where: { id } });
    expect(row.title).toBe("Updated title");
  });

  it("realtor rejected", async () => {
    const { id } = await seedRow();
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_ann_update_outsider",
    });
    const res = await updateAnnouncementInner(realtor, id, undefined, form());
    expect(res).toEqual({
      ok: false,
      error: "Only admins can edit announcements.",
    });
  });

  it("missing row → 'Announcement not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await updateAnnouncementInner(admin, "a_missing", undefined, form());
    expect(res).toEqual({ ok: false, error: "Announcement not found." });
  });

  it("emits announcement.updated audit on success", async () => {
    const { id, admin } = await seedRow();
    await updateAnnouncementInner(
      admin,
      id,
      undefined,
      form({ title: "Patch 1", type: "warning" }),
    );
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        actorId: admin.user.id,
        verb: "announcement.updated",
        objectId: id,
      },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta).toEqual({ title: "Patch 1", type: "warning" });
  });
});

describe("deleteAnnouncementInner", () => {
  it("admin can delete + audit emitted", async () => {
    const { admin } = await seedBaseline();
    const created = await createAnnouncementInner(admin, undefined, form());
    if (!created.ok || !created.data) throw new Error("expected id");
    const res = await deleteAnnouncementInner(admin, created.data.id);
    expect(res).toEqual({ ok: true });
    const row = await prisma.announcement.findUnique({
      where: { id: created.data.id },
    });
    expect(row).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "announcement.deleted" },
    });
    expect(audit.objectId).toBe(created.data.id);
  });

  it("realtor rejected", async () => {
    const { admin } = await seedBaseline();
    const created = await createAnnouncementInner(admin, undefined, form());
    if (!created.ok || !created.data) throw new Error("expected id");
    const realtor = await makeSession({
      role: "realtor",
      userId: "u_ann_delete_outsider",
    });
    const res = await deleteAnnouncementInner(realtor, created.data.id);
    expect(res).toEqual({
      ok: false,
      error: "Only admins can delete announcements.",
    });
  });

  it("missing row → 'Announcement not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await deleteAnnouncementInner(admin, "a_missing");
    expect(res).toEqual({ ok: false, error: "Announcement not found." });
  });
});

describe("dismissAnnouncementInner", () => {
  async function seedDismissible(isDismissible: boolean) {
    const { admin } = await seedBaseline();
    const fd = form();
    // readAnnouncementFormData checks presence (!= null); to flip the bool
    // to false we have to DELETE the key entirely, not pass an empty string.
    if (!isDismissible) fd.delete("isDismissible");
    const res = await createAnnouncementInner(admin, undefined, fd);
    if (!res.ok || !res.data) throw new Error("expected id");
    return res.data.id;
  }

  it("any logged-in user can dismiss a dismissible announcement", async () => {
    const id = await seedDismissible(true);
    const reader = await makeSession({ role: "freelancer", userId: "u_dismiss_1" });
    const res = await dismissAnnouncementInner(reader, id);
    expect(res).toEqual({ ok: true });
    const row = await prisma.announcementDismissal.findUniqueOrThrow({
      where: {
        announcementId_userId: { announcementId: id, userId: reader.user.id },
      },
    });
    expect(row).toBeTruthy();
  });

  it("dismissing twice is idempotent (upsert, no duplicate rows)", async () => {
    const id = await seedDismissible(true);
    const reader = await makeSession({ role: "freelancer", userId: "u_dismiss_2" });
    await dismissAnnouncementInner(reader, id);
    const second = await dismissAnnouncementInner(reader, id);
    expect(second).toEqual({ ok: true });
    const count = await prisma.announcementDismissal.count({
      where: { announcementId: id, userId: reader.user.id },
    });
    expect(count).toBe(1);
  });

  it("non-dismissible announcement → rejected", async () => {
    const id = await seedDismissible(false);
    const reader = await makeSession({ role: "realtor", userId: "u_dismiss_stuck" });
    const res = await dismissAnnouncementInner(reader, id);
    expect(res).toEqual({
      ok: false,
      error: "This announcement cannot be dismissed.",
    });
  });

  it("missing row → 'Announcement not found.'", async () => {
    const { freelancer } = await seedBaseline();
    const res = await dismissAnnouncementInner(freelancer, "a_missing");
    expect(res).toEqual({ ok: false, error: "Announcement not found." });
  });
});
