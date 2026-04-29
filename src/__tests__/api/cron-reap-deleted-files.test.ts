import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/reap-deleted-files/route";
import { prisma, resetDb, disconnectDb, auditMeta } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeUploadFile, uploadForm } from "../_helpers/upload";
import { uploadAssignmentFilesInner } from "@/app/actions/files";
import { storage } from "@/lib/storage";

// Integration tier — the reap-deleted-files cron route. Covers Bearer
// gate, dry-run, cutoff window, storage + DB delete coupling, and the
// audit row written on success. Real LocalStorage backend so we verify
// that bytes actually disappear (not just `store.delete` was called).

const URL_BASE = "http://localhost/api/cron/reap-deleted-files";
const SECRET = "test-cron-secret";

function makeReq(opts: { bearer?: string | null; query?: string } = {}): Request {
  const url = opts.query ? `${URL_BASE}?${opts.query}` : URL_BASE;
  const headers: Record<string, string> = {};
  if (opts.bearer !== null && opts.bearer !== undefined) {
    headers.authorization = `Bearer ${opts.bearer}`;
  }
  return new Request(url, { headers });
}

/**
 * Seed a soft-deleted file: upload, mark as deleted by setting
 * `deletedAt` to a timestamp older than the reap cutoff.
 */
async function seedSoftDeletedFile(opts: {
  freelancerSession: Awaited<ReturnType<typeof seedBaseline>>["freelancer"];
  teamId: string;
  deletedAt: Date;
}) {
  const asg = await seedAssignment({
    teamId: opts.teamId,
    freelancerId: opts.freelancerSession.user.id,
    status: "scheduled",
    propertyType: "apartment",
  });
  await uploadAssignmentFilesInner(
    opts.freelancerSession,
    asg.id,
    "freelancer",
    undefined,
    uploadForm(makeUploadFile(`report-${Math.random().toString(36).slice(2, 8)}.pdf`)),
  );
  const file = await prisma.assignmentFile.findFirstOrThrow({
    where: { assignmentId: asg.id, deletedAt: null },
  });
  await prisma.assignmentFile.update({
    where: { id: file.id },
    data: { deletedAt: opts.deletedAt },
  });
  return { assignmentId: asg.id, fileId: file.id, storageKey: file.storageKey };
}

describe("GET /api/cron/reap-deleted-files", () => {
  beforeEach(async () => {
    await resetDb();
    vi.stubEnv("CRON_SECRET", SECRET);
  });
  afterAll(async () => {
    vi.unstubAllEnvs();
    await disconnectDb();
  });

  it("401 when Authorization header is missing", async () => {
    const res = await GET(makeReq({ bearer: null }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized." });
  });

  it("401 on wrong Bearer token", async () => {
    const res = await GET(makeReq({ bearer: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("500 when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = await GET(makeReq({ bearer: SECRET }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: "CRON_SECRET is not configured.",
    });
  });

  it("found: 0 when no soft-deletes exist", async () => {
    const res = await GET(makeReq({ bearer: SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 0, reaped: 0 });
  });

  it("?dry=1 lists candidates without deleting", async () => {
    const { freelancer, teams } = await seedBaseline();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { fileId, storageKey } = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: old,
    });

    const res = await GET(makeReq({ bearer: SECRET, query: "dry=1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, dryRun: true, found: 1 });
    expect(body.ids).toEqual([fileId]);

    // Row + bytes still there.
    const row = await prisma.assignmentFile.findUnique({ where: { id: fileId } });
    expect(row).not.toBeNull();
    expect(await storage().exists(storageKey)).toBe(true);
  });

  it("hard-deletes both the row and the storage bytes when past the cutoff", async () => {
    const { freelancer, teams } = await seedBaseline();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const { fileId, storageKey } = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: old,
    });

    expect(await storage().exists(storageKey)).toBe(true);

    const res = await GET(makeReq({ bearer: SECRET }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 1, reaped: 1 });

    const row = await prisma.assignmentFile.findUnique({ where: { id: fileId } });
    expect(row).toBeNull();
    expect(await storage().exists(storageKey)).toBe(false);
  });

  it("respects the 30-day default cutoff (recent soft-deletes stay)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const { fileId, storageKey } = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: recent,
    });

    const res = await GET(makeReq({ bearer: SECRET }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 0, reaped: 0 });

    const row = await prisma.assignmentFile.findUnique({ where: { id: fileId } });
    expect(row).not.toBeNull();
    expect(await storage().exists(storageKey)).toBe(true);
  });

  it("?olderThanDays=1 reaps anything older than 1 day", async () => {
    const { freelancer, teams } = await seedBaseline();
    const twoDays = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const { fileId } = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: twoDays,
    });

    const res = await GET(makeReq({ bearer: SECRET, query: "olderThanDays=1" }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 1, reaped: 1 });

    const row = await prisma.assignmentFile.findUnique({ where: { id: fileId } });
    expect(row).toBeNull();
  });

  it("emits a single assignment.files_reaped audit row with all ids", async () => {
    const { freelancer, teams } = await seedBaseline();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const a = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: old,
    });
    const b = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: old,
    });

    const res = await GET(makeReq({ bearer: SECRET }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 2, reaped: 2 });

    const audits = await prisma.auditLog.findMany({
      where: { verb: "assignment.files_reaped" },
    });
    expect(audits).toHaveLength(1);
    const meta = auditMeta(audits[0].metadata);
    expect(meta.reaped).toBe(2);
    expect((meta.fileIds as string[]).sort()).toEqual([a.fileId, b.fileId].sort());
    expect(meta.trigger).toBe("cron");
  });

  it("only reaps files past the cutoff, leaves recent soft-deletes alone", async () => {
    const { freelancer, teams } = await seedBaseline();
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const recent = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const oldFile = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: old,
    });
    const recentFile = await seedSoftDeletedFile({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      deletedAt: recent,
    });

    const res = await GET(makeReq({ bearer: SECRET }));
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, found: 1, reaped: 1 });

    expect(await prisma.assignmentFile.findUnique({ where: { id: oldFile.fileId } })).toBeNull();
    expect(await prisma.assignmentFile.findUnique({ where: { id: recentFile.fileId } })).not.toBeNull();
  });
});
