import { describe, expect, it } from "vitest";
import { uploadAssignmentFilesInner } from "@/app/actions/files";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeUploadFile, uploadForm } from "../_helpers/upload";

// Platform parity — ports behavioral contract from:
//   Platform/app/Http/Controllers/AssignmentController.php::uploadFiles
//   Platform/app/Services/ProcessFilePondUpload.php:260-289
// Freelancer-lane upload on a non-terminal assignment should:
//   1) persist rows in `assignment_files`
//   2) auto-advance `status` to "completed" and stamp `completedAt`
//   3) run `applyCommission` → write an AssignmentCommission row (when eligible)
//   4) emit both `assignment.file_uploaded` + `assignment.completed` audit rows
//
// Realtor-lane upload must NOT auto-complete, and any upload against an
// already-terminal assignment must be rejected with a user-visible error.

setupTestDb();

describe("uploadAssignmentFilesInner — freelancer lane", () => {
  it("writes a file row + auto-completes the assignment + stamps completedAt", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_autocomplete",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("deliverable.pdf")),
    );
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, completedAt: true, deliveredAt: true },
    });
    expect(after.status).toBe("completed");
    expect(after.completedAt).toBeInstanceOf(Date);
    expect(after.deliveredAt).toBeInstanceOf(Date);

    const files = await prisma.assignmentFile.findMany({
      where: { assignmentId: asg.id },
      select: { lane: true, originalName: true, mimeType: true, uploaderId: true },
    });
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      lane: "freelancer",
      originalName: "deliverable.pdf",
      mimeType: "application/pdf",
      uploaderId: freelancer.user.id,
    });
  });

  it("writes an AssignmentCommission row when the team has commission config + eligible services", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_commission",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("final.pdf")),
    );

    const commission = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
      select: {
        commissionType: true,
        commissionValue: true,
        commissionAmountCents: true,
        assignmentTotalCents: true,
      },
    });
    // Team T1: 15 % (1500 bps) × €250 asbestos subtotal = €37.50 → 3_750 cents.
    expect(commission).toEqual({
      commissionType: "percentage",
      commissionValue: 1500,
      commissionAmountCents: 3_750,
      assignmentTotalCents: 25_000,
    });
  });

  it("does NOT write a commission row when the property type is excluded (studio_room)", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_excluded",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "studio_room",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("final.pdf")),
    );
    expect(res.ok).toBe(true);

    // Assignment still auto-completes …
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("completed");

    // … but no commission is written for studio_room property types.
    const commission = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
    });
    expect(commission).toBeNull();
  });

  it("emits assignment.file_uploaded + assignment.completed audit rows", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_audit",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("report.pdf")),
    );

    const audits = await prisma.auditLog.findMany({
      where: { actorId: freelancer.user.id },
      orderBy: { at: "asc" },
      select: { verb: true, objectType: true, objectId: true },
    });
    const verbs = audits.map((a) => a.verb);
    expect(verbs).toContain("assignment.file_uploaded");
    expect(verbs).toContain("assignment.completed");
    // Commission was written (team has config) → audit the commission too.
    expect(verbs).toContain("assignment.commission_applied");

    const completed = audits.find((a) => a.verb === "assignment.completed");
    expect(completed?.objectType).toBe("assignment");
    expect(completed?.objectId).toBe(asg.id);
  });

  it("rejects when the uploader is not the assigned freelancer", async () => {
    const { freelancer, teams } = await seedBaseline();
    // Someone OTHER than our session user holds the `freelancerId` slot.
    const other = await prisma.user.create({
      data: {
        id: "u_other_freelancer",
        email: "other@test.local",
        role: "freelancer",
        firstName: "Other",
        lastName: "Freelancer",
      },
    });
    const asg = await seedAssignment({
      id: "a_upload_not_assigned",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: other.id,
      propertyType: "apartment",
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("interloper.pdf")),
    );
    expect(res).toEqual({
      ok: false,
      error: "Only the assigned freelancer can upload deliverables.",
    });

    // Assignment untouched, no file rows, no audits from the intruder.
    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true },
    });
    expect(after.status).toBe("scheduled");
    const files = await prisma.assignmentFile.count({ where: { assignmentId: asg.id } });
    expect(files).toBe(0);
  });

  it("rejects uploads to a terminal-status assignment", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_terminal",
      status: "completed", // already terminal
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      propertyType: "apartment",
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("too-late.pdf")),
    );
    expect(res).toEqual({
      ok: false,
      error: "This assignment is completed — uploads are closed.",
    });

    const files = await prisma.assignmentFile.count({ where: { assignmentId: asg.id } });
    expect(files).toBe(0);
  });

  it("rejects when the file lane is invalid", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_bad_lane",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      // Intentional invalid value — guards against a future frontend bug
      // slipping a typo through to the action handler.
      "hijacked" as unknown as "freelancer",
      undefined,
      uploadForm(makeUploadFile("x.pdf")),
    );
    expect(res).toEqual({ ok: false, error: "Invalid file lane." });
  });

  it("rejects non-allowlisted MIME types on the freelancer lane", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_mime",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });

    // Freelancer lane accepts PDF + common images (JPEG/PNG/WebP).
    // Anything outside that allowlist (e.g. HTML, video) must still bounce.
    const html = makeUploadFile("malicious.html", "text/html", "<html></html>");
    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(html),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toMatch(/isn't an allowed file type/);
      expect(res.error).toMatch(/malicious\.html/);
    }
  });

  it("rejects empty form submissions", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_empty",
      status: "scheduled",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      new FormData(),
    );
    expect(res).toEqual({ ok: false, error: "Pick a file to upload." });
  });
});

describe("uploadAssignmentFilesInner — realtor lane", () => {
  it("accepts PDFs + images WITHOUT auto-completing the assignment", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_realtor_lane",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
      propertyType: "apartment",
    });

    const png = makeUploadFile("floorplan.png", "image/png", "fakepng");
    const pdf = makeUploadFile("notes.pdf");
    const res = await uploadAssignmentFilesInner(
      realtor,
      asg.id,
      "realtor",
      undefined,
      uploadForm(png, pdf),
    );
    expect(res).toEqual({ ok: true });

    const after = await prisma.assignment.findUniqueOrThrow({
      where: { id: asg.id },
      select: { status: true, completedAt: true, deliveredAt: true },
    });
    // Realtor-lane upload must NOT auto-complete.
    expect(after.status).toBe("scheduled");
    expect(after.completedAt).toBeNull();
    expect(after.deliveredAt).toBeNull();

    const files = await prisma.assignmentFile.findMany({
      where: { assignmentId: asg.id },
      orderBy: { originalName: "asc" },
      select: { lane: true, originalName: true },
    });
    expect(files).toEqual([
      { lane: "realtor", originalName: "floorplan.png" },
      { lane: "realtor", originalName: "notes.pdf" },
    ]);
  });

  it("does not write a commission row (realtor-lane doesn't trigger completion)", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_upload_realtor_no_commission",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
      propertyType: "apartment",
      services: [{ serviceKey: "asbestos", unitPriceCents: 25_000 }],
    });

    await uploadAssignmentFilesInner(
      realtor,
      asg.id,
      "realtor",
      undefined,
      uploadForm(makeUploadFile("prelim.pdf")),
    );
    const commission = await prisma.assignmentCommission.findUnique({
      where: { assignmentId: asg.id },
    });
    expect(commission).toBeNull();
  });

  it("rejects when the uploader is not on the assignment's team + not the creator", async () => {
    const { freelancer, teams } = await seedBaseline();
    // Assignment is owned by a DIFFERENT realtor, and our freelancer session
    // isn't a member of the team — canUploadToRealtorLane denies.
    const otherRealtor = await prisma.user.create({
      data: {
        id: "u_random_realtor",
        email: "random@test.local",
        role: "realtor",
        firstName: "Random",
        lastName: "Realtor",
      },
    });
    const asg = await seedAssignment({
      id: "a_upload_realtor_outsider",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: otherRealtor.id,
      propertyType: "apartment",
    });

    const res = await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "realtor",
      undefined,
      uploadForm(makeUploadFile("snoop.pdf")),
    );
    expect(res).toEqual({
      ok: false,
      error: "Only the assignment's agency can upload supporting files.",
    });
  });
});

describe("uploadAssignmentFilesInner — shared paths", () => {
  it("returns a clean error when the assignment doesn't exist", async () => {
    const { freelancer } = await seedBaseline();
    const res = await uploadAssignmentFilesInner(
      freelancer,
      "a_does_not_exist",
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("ghost.pdf")),
    );
    expect(res).toEqual({ ok: false, error: "Assignment not found." });
  });
});
