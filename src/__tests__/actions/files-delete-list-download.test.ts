import { describe, expect, it } from "vitest";
import {
  deleteAssignmentFileInner,
  getAssignmentFileDownloadUrlInner,
  listAssignmentFilesInner,
  uploadAssignmentFilesInner,
} from "@/app/actions/files";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";
import { makeUploadFile, uploadForm } from "../_helpers/upload";

// Platform parity — file lifecycle read paths:
//   Platform/app/Http/Controllers/AssignmentController.php::downloadFile + deleteFile
//
// Covers:
//   1. deleteAssignmentFile — only uploader can delete, terminal-status blocks,
//      idempotent second delete, enumeration guard (no existence leak)
//   2. listAssignmentFiles — scoped visibility, deleted files excluded
//   3. getAssignmentFileDownloadUrl — visibility gate, returns signed URL
//      that includes the expected query params

setupTestDb();

/** Seed an assignment + a single freelancer-uploaded file. Returns handles. */
async function seedFileUpload(opts: {
  freelancerSession: Awaited<ReturnType<typeof makeSession>>;
  teamId: string;
  assignmentStatus?: "draft" | "awaiting" | "scheduled" | "in_progress" | "delivered" | "completed" | "cancelled" | "on_hold";
  filename?: string;
}) {
  const asg = await seedAssignment({
    teamId: opts.teamId,
    freelancerId: opts.freelancerSession.user.id,
    status: opts.assignmentStatus ?? "scheduled",
    propertyType: "apartment",
  });
  // Upload a freelancer-lane file. The status "scheduled" means the upload
  // will auto-complete the assignment; adjust the assignment back after so
  // file-level tests can exercise the non-terminal path.
  await uploadAssignmentFilesInner(
    opts.freelancerSession,
    asg.id,
    "freelancer",
    undefined,
    uploadForm(makeUploadFile(opts.filename ?? "report.pdf")),
  );
  // Revert the auto-completion so delete/list/download tests can run on a
  // non-terminal assignment.
  await prisma.assignment.update({
    where: { id: asg.id },
    data: { status: "scheduled", completedAt: null, deliveredAt: null },
  });
  const file = await prisma.assignmentFile.findFirstOrThrow({
    where: { assignmentId: asg.id, deletedAt: null },
  });
  return { assignmentId: asg.id, fileId: file.id };
}

describe("deleteAssignmentFileInner — uploader policy", () => {
  it("uploader can delete their own file", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const res = await deleteAssignmentFileInner(freelancer, fileId);
    expect(res).toEqual({ ok: true });
    const after = await prisma.assignmentFile.findUniqueOrThrow({
      where: { id: fileId },
      select: { deletedAt: true },
    });
    expect(after.deletedAt).toBeInstanceOf(Date);
  });

  it("admin can delete anyone's file", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const res = await deleteAssignmentFileInner(admin, fileId);
    expect(res).toEqual({ ok: true });
  });

  it("non-uploader realtor CANNOT delete someone else's file (even if they can view)", async () => {
    const { freelancer, realtor, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    // realtor owns the team so canViewAssignmentFiles passes; canDeleteAssignmentFile rejects.
    const res = await deleteAssignmentFileInner(realtor, fileId);
    expect(res).toEqual({
      ok: false,
      error: "errors.file.cannotDeleteOthers",
    });
  });

  it("outsider (can't view the assignment) → 'File not found.' (no enumeration leak)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_file_outsider",
    });
    const res = await deleteAssignmentFileInner(outsider, fileId);
    expect(res).toEqual({ ok: false, error: "errors.file.notFound" });
  });
});

describe("deleteAssignmentFileInner — state guards", () => {
  it("terminal-status assignment → rejected (file edits closed)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { assignmentId, fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: "completed" },
    });
    const res = await deleteAssignmentFileInner(freelancer, fileId);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("errors.assignment.fileEditsClosed");
  });

  it("missing file → 'File not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await deleteAssignmentFileInner(admin, "f_missing");
    expect(res).toEqual({ ok: false, error: "errors.file.notFound" });
  });

  it("already-deleted file → idempotent ok (no second audit)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    await deleteAssignmentFileInner(freelancer, fileId);
    const second = await deleteAssignmentFileInner(freelancer, fileId);
    expect(second).toEqual({ ok: true });
    const audits = await prisma.auditLog.count({
      where: { verb: "assignment.file_deleted", objectId: fileId },
    });
    expect(audits).toBe(1);
  });

  it("emits assignment.file_deleted audit on success", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { assignmentId, fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      filename: "gonzo.pdf",
    });
    await deleteAssignmentFileInner(freelancer, fileId);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: freelancer.user.id, verb: "assignment.file_deleted" },
      select: { metadata: true, objectId: true },
    });
    expect(audit.objectId).toBe(fileId);
    const meta = auditMeta(audit.metadata);
    expect(meta).toEqual({ assignmentId, originalName: "gonzo.pdf" });
  });
});

describe("listAssignmentFilesInner", () => {
  it("returns non-deleted files scoped by canViewAssignmentFiles", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { assignmentId, fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      filename: "one.pdf",
    });
    void fileId;
    // Upload a second file on the same assignment
    await uploadAssignmentFilesInner(
      freelancer,
      assignmentId,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("two.pdf")),
    );
    await prisma.assignment.update({
      where: { id: assignmentId },
      data: { status: "scheduled", completedAt: null, deliveredAt: null },
    });
    const res = await listAssignmentFilesInner(freelancer, assignmentId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data?.files).toHaveLength(2);
    expect(res.data?.files.map((f) => f.originalName).sort()).toEqual([
      "one.pdf",
      "two.pdf",
    ]);
  });

  it("excludes soft-deleted files", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { assignmentId, fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    await deleteAssignmentFileInner(freelancer, fileId);
    const res = await listAssignmentFilesInner(freelancer, assignmentId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data?.files).toEqual([]);
  });

  it("missing assignment → 'Assignment not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await listAssignmentFilesInner(admin, "a_missing");
    expect(res).toEqual({ ok: false, error: "errors.assignment.notFound" });
  });

  it("outsider realtor rejected with 'no permission' error", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { assignmentId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_list_outsider",
    });
    const res = await listAssignmentFilesInner(outsider, assignmentId);
    expect(res).toEqual({
      ok: false,
      error: "errors.file.cannotViewAssignmentFiles",
    });
  });

  it("admin sees files on any assignment", async () => {
    const { admin, freelancer, teams } = await seedBaseline();
    const { assignmentId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const res = await listAssignmentFilesInner(admin, assignmentId);
    expect(res.ok).toBe(true);
  });
});

describe("getAssignmentFileDownloadUrlInner", () => {
  it("uploader gets a signed URL", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
      filename: "download-me.pdf",
    });
    const res = await getAssignmentFileDownloadUrlInner(freelancer, fileId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    expect(res.data?.originalName).toBe("download-me.pdf");
    // LocalStorage URL shape: /api/files/{key}?exp=...&sig=...
    expect(res.data?.url).toMatch(/\/api\/files\//);
    expect(res.data?.url).toMatch(/[?&]exp=\d+/);
    expect(res.data?.url).toMatch(/[?&]sig=[0-9a-f]+/);
  });

  it("URL exp timestamp is ~1 hour in the future (DOWNLOAD_URL_TTL_SEC)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const nowSec = Math.floor(Date.now() / 1000);
    const res = await getAssignmentFileDownloadUrlInner(freelancer, fileId);
    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error("expected ok");
    const expMatch = res.data?.url.match(/[?&]exp=(\d+)/);
    const exp = Number(expMatch?.[1]);
    // Window: 3540..3660 seconds (1h ± 1min margin).
    expect(exp - nowSec).toBeGreaterThan(60 * 59);
    expect(exp - nowSec).toBeLessThan(60 * 61);
  });

  it("deleted file → 'File not found.'", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    await deleteAssignmentFileInner(freelancer, fileId);
    const res = await getAssignmentFileDownloadUrlInner(freelancer, fileId);
    expect(res).toEqual({ ok: false, error: "errors.file.notFound" });
  });

  it("outsider → 'File not found.' (no enumeration leak)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const { fileId } = await seedFileUpload({
      freelancerSession: freelancer,
      teamId: teams.t1.id,
    });
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_download_outsider",
    });
    const res = await getAssignmentFileDownloadUrlInner(outsider, fileId);
    expect(res).toEqual({ ok: false, error: "errors.file.notFound" });
  });

  it("missing file → 'File not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await getAssignmentFileDownloadUrlInner(admin, "f_missing");
    expect(res).toEqual({ ok: false, error: "errors.file.notFound" });
  });
});
