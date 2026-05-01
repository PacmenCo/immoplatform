import { describe, expect, it } from "vitest";
import {
  finalizeAssignmentFileUploadInner,
  presignAssignmentFileUploadInner,
} from "@/app/actions/files";
import { storage } from "@/lib/storage";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";

setupTestDb();

// Magic-byte prefix for application/pdf — the finalize action sniffs the
// first 1 KB of stored bytes and rejects anything that doesn't start with
// %PDF inside that window.
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);

function pdfBytes(payload = "test content"): Buffer {
  return Buffer.concat([PDF_HEADER, Buffer.from(payload)]);
}

describe("presign + finalize — happy path", () => {
  it("auto-completes the assignment, writes a row, runs the same bookkeeping", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_presign_happy",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const body = pdfBytes();
    const pres = await presignAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [{ name: "deliverable.pdf", mimeType: "application/pdf", sizeBytes: body.byteLength }],
    );
    expect(pres.ok).toBe(true);
    if (!pres.ok) return;
    expect(pres.data?.uploads).toHaveLength(1);
    const u = pres.data!.uploads[0];

    // Simulate the browser PUT by writing directly through the storage
    // backend — we're testing the action contract, not the route handler.
    await storage().put(u.storageKey, body, { mimeType: u.mimeType });

    const fin = await finalizeAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [
        {
          fileId: u.fileId,
          storageKey: u.storageKey,
          originalName: u.originalName,
          mimeType: u.mimeType,
          sizeBytes: body.byteLength,
        },
      ],
    );
    expect(fin).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, completedAt: true },
    });
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeInstanceOf(Date);

    const file = await prisma.assignmentFile.findUniqueOrThrow({
      where: { id: u.fileId },
      select: { lane: true, originalName: true, sizeBytes: true, uploaderId: true },
    });
    expect(file).toMatchObject({
      lane: "freelancer",
      originalName: "deliverable.pdf",
      sizeBytes: body.byteLength,
      uploaderId: freelancer.user.id,
    });
  });
});

describe("presign + finalize — rejection paths", () => {
  it("rejects finalize when the stored bytes don't match the declared MIME (magic-byte sniff)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_presign_polyglot",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
    });

    const pres = await presignAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [{ name: "fake.pdf", mimeType: "application/pdf", sizeBytes: 64 }],
    );
    expect(pres.ok).toBe(true);
    if (!pres.ok) return;
    const u = pres.data!.uploads[0];

    // 64 bytes of HTML — no %PDF anywhere in the first 1 KB.
    const evilBytes = Buffer.from("<html><body>not a pdf</body></html>".padEnd(64, " "));
    await storage().put(u.storageKey, evilBytes, { mimeType: u.mimeType });

    const fin = await finalizeAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [
        {
          fileId: u.fileId,
          storageKey: u.storageKey,
          originalName: u.originalName,
          mimeType: u.mimeType,
          sizeBytes: evilBytes.byteLength,
        },
      ],
    );
    expect(fin.ok).toBe(false);
    if (!fin.ok) {
      expect(fin.error).toBe("errors.file.typeMismatch");
    }

    // No row written, status untouched, bytes deleted from storage.
    const rows = await prisma.assignmentFile.count({ where: { assignmentId: asg.id } });
    expect(rows).toBe(0);
    expect(await storage().exists(u.storageKey)).toBe(false);
  });

  it("rejects finalize when the actual stored size differs from what the client claimed", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_presign_size",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
    });

    const body = pdfBytes("real content");
    const pres = await presignAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [{ name: "swap.pdf", mimeType: "application/pdf", sizeBytes: body.byteLength }],
    );
    expect(pres.ok).toBe(true);
    if (!pres.ok) return;
    const u = pres.data!.uploads[0];
    await storage().put(u.storageKey, body, { mimeType: u.mimeType });

    // Lie about the size by ~1 MB — well past the 8-byte tolerance.
    const fin = await finalizeAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [
        {
          fileId: u.fileId,
          storageKey: u.storageKey,
          originalName: u.originalName,
          mimeType: u.mimeType,
          sizeBytes: body.byteLength + 1024 * 1024,
        },
      ],
    );
    expect(fin.ok).toBe(false);
    if (!fin.ok) {
      expect(fin.error).toBe("errors.file.sizeMismatch");
    }
    expect(await storage().exists(u.storageKey)).toBe(false);
  });

  it("rejects presign when the lane policy fails (non-assigned freelancer)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const other = await prisma.user.create({
      data: {
        id: "u_other_freelancer_presign",
        email: "other-presign@test.local",
        role: "freelancer",
        firstName: "Other",
        lastName: "Freelancer",
      },
    });
    const asg = await seedAssignment({
      id: "a_presign_intruder",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: other.id,
      propertyType: "apartment",
    });

    const pres = await presignAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [{ name: "x.pdf", mimeType: "application/pdf", sizeBytes: 32 }],
    );
    expect(pres).toEqual({
      ok: false,
      error: "errors.file.freelancerOnlyDeliverables",
    });
  });

  it("rejects presign on a terminal assignment", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_presign_terminal",
      status: "completed",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
    });

    const pres = await presignAssignmentFileUploadInner(
      freelancer,
      asg.id,
      "freelancer",
      [{ name: "x.pdf", mimeType: "application/pdf", sizeBytes: 32 }],
    );
    expect(pres).toEqual({
      ok: false,
      error: "errors.assignment.uploadsClosed",
    });
  });
});
