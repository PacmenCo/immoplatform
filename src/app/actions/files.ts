"use server";

import { revalidatePath } from "next/cache";
import { generateCuid } from "@/lib/cuid";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { filesUploadedEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import {
  canDeleteAssignmentFile,
  canUploadToFreelancerLane,
  canUploadToRealtorLane,
  canViewAssignmentFiles,
  type AssignmentPolicyInput,
} from "@/lib/permissions";
import { TERMINAL_STATUSES, isTerminalStatus } from "@/lib/mockData";
import {
  FILE_CONSTRAINTS,
  MAX_FILES_PER_UPLOAD,
  isLane,
  type FileLane,
} from "@/lib/file-constraints";
import { makeAssignmentFileKey, storage } from "@/lib/storage";
import { withSession, type ActionResult } from "./_types";

/** TTL for signed download URLs. Matches Platform's 5-minute window. */
const DOWNLOAD_URL_TTL_SEC = 5 * 60;

type LaneUploadPolicy = (
  s: SessionWithUser,
  a: AssignmentPolicyInput,
) => Promise<boolean>;

const LANE_UPLOAD_POLICY: Record<FileLane, LaneUploadPolicy> = {
  freelancer: canUploadToFreelancerLane,
  realtor: canUploadToRealtorLane,
};

// ─── Upload ────────────────────────────────────────────────────────

export const uploadAssignmentFiles = withSession(async (
  session,
  assignmentId: string,
  lane: FileLane,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> => {
  if (!isLane(lane)) return { ok: false, error: "Invalid file lane." };

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      status: true,
      teamId: true,
      freelancerId: true,
      createdById: true,
    },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (!(await LANE_UPLOAD_POLICY[lane](session, assignment))) {
    return {
      ok: false,
      error:
        lane === "freelancer"
          ? "Only the assigned freelancer can upload deliverables."
          : "Only the assignment's agency can upload supporting files.",
    };
  }
  if (isTerminalStatus(assignment.status)) {
    return {
      ok: false,
      error: `This assignment is ${assignment.status} — uploads are closed.`,
    };
  }

  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return { ok: false, error: "Pick a file to upload." };
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { ok: false, error: `Upload up to ${MAX_FILES_PER_UPLOAD} files at a time.` };
  }

  const { maxMB, allowedMimes } = FILE_CONSTRAINTS[lane];
  const maxBytes = maxMB * 1024 * 1024;
  for (const file of files) {
    const mime = file.type.toLowerCase();
    if (!allowedMimes.includes(mime)) {
      return {
        ok: false,
        error: `"${file.name}" isn't an allowed file type. ${FILE_CONSTRAINTS[lane].acceptHint}.`,
      };
    }
    if (file.size > maxBytes) {
      return {
        ok: false,
        error: `"${file.name}" is larger than the ${maxMB} MB limit.`,
      };
    }
  }

  const store = storage();

  // Pre-generate ids so the storage key reflects the final DB id — lets a
  // future reconcile job pair orphan objects with rows unambiguously.
  //
  // Put phase: if ANY put rejects we must delete already-written bytes
  // before rethrowing. Sequential loop keeps tracking simple and gives
  // deterministic cleanup — parallel puts were a lurking orphan bug.
  const prepared: Array<{ id: string; key: string; sizeBytes: number; file: File }> = [];
  try {
    for (const file of files) {
      const id = generateCuid();
      const key = makeAssignmentFileKey({
        assignmentId,
        lane,
        fileId: id,
        originalName: file.name,
      });
      const buf = Buffer.from(await file.arrayBuffer());
      const { sizeBytes } = await store.put(key, buf, { mimeType: file.type });
      prepared.push({ id, key, sizeBytes, file });
    }
  } catch (err) {
    await Promise.all(prepared.map((p) => store.delete(p.key).catch(() => {})));
    throw err;
  }

  try {
    await prisma.$transaction(async (tx) => {
      // In-tx status re-check via an update predicate — if the assignment
      // went terminal between the outer read and here, bail with a sentinel
      // so the outer catch cleans up the bytes.
      const claim = await tx.assignment.updateMany({
        where: { id: assignmentId, status: { notIn: [...TERMINAL_STATUSES] } },
        data: { updatedAt: new Date() },
      });
      if (claim.count === 0) throw new Error("ASSIGNMENT_TERMINAL");
      await tx.assignmentFile.createMany({
        data: prepared.map((p) => ({
          id: p.id,
          assignmentId,
          uploaderId: session.user.id,
          lane,
          storageKey: p.key,
          originalName: p.file.name,
          mimeType: p.file.type.toLowerCase(),
          sizeBytes: p.sizeBytes,
        })),
      });
    });
  } catch (err) {
    await Promise.all(prepared.map((p) => store.delete(p.key).catch(() => {})));
    if (err instanceof Error && err.message === "ASSIGNMENT_TERMINAL") {
      return {
        ok: false,
        error: "This assignment closed while you were uploading. Reload and try again.",
      };
    }
    throw err;
  }

  for (const { id, file } of prepared) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.file_uploaded",
      objectType: "assignment_file",
      objectId: id,
      metadata: {
        assignmentId,
        lane,
        originalName: file.name,
        sizeBytes: file.size,
      },
    });
  }

  // Notify the opposite side: freelancer uploads → ping the agency; realtor
  // uploads → ping the freelancer. Self-exclude the uploader.
  const meta = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      reference: true,
      address: true,
      city: true,
      postal: true,
      freelancerId: true,
      createdById: true,
      teamId: true,
    },
  });
  if (meta) {
    const notifyRecipients: Array<{
      id: string;
      email: string;
      emailPrefs: string | null;
      firstName: string;
    }> = [];
    if (lane === "freelancer") {
      // Agency side: creator + team owners.
      const users = await prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            meta.createdById ? { id: meta.createdById } : {},
            meta.teamId
              ? {
                  memberships: {
                    some: { teamId: meta.teamId, teamRole: "owner" },
                  },
                }
              : {},
          ].filter((c) => Object.keys(c).length > 0),
        },
        select: { id: true, email: true, emailPrefs: true, firstName: true },
      });
      for (const u of users) {
        if (u.id !== session.user.id && !notifyRecipients.some((r) => r.id === u.id)) {
          notifyRecipients.push(u);
        }
      }
    } else if (lane === "realtor" && meta.freelancerId && meta.freelancerId !== session.user.id) {
      const f = await prisma.user.findUnique({
        where: { id: meta.freelancerId },
        select: { id: true, email: true, emailPrefs: true, firstName: true },
      });
      if (f) notifyRecipients.push(f);
    }
    const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const assignmentUrl = `${baseUrl}/dashboard/assignments/${meta.id}`;
    const uploaderName = `${session.user.firstName} ${session.user.lastName}`;
    for (const r of notifyRecipients) {
      await notify({
        to: r,
        event: "assignment.files_uploaded",
        ...filesUploadedEmail({
          reference: meta.reference,
          address: meta.address,
          city: meta.city,
          postal: meta.postal,
          assignmentUrl,
          recipientName: r.firstName,
          uploaderName,
          lane,
          fileCount: prepared.length,
        }),
      });
    }
  }

  revalidatePath(`/dashboard/assignments/${assignmentId}/files`);
  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { ok: true };
});

// ─── Delete ────────────────────────────────────────────────────────

export const deleteAssignmentFile = withSession(async (
  session,
  fileId: string,
): Promise<ActionResult> => {
  const file = await prisma.assignmentFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      assignmentId: true,
      uploaderId: true,
      deletedAt: true,
      originalName: true,
      assignment: {
        select: {
          id: true,
          status: true,
          teamId: true,
          freelancerId: true,
          createdById: true,
        },
      },
    },
  });
  if (!file) return { ok: false, error: "File not found." };
  if (file.deletedAt) return { ok: true }; // idempotent

  // Must be able to see the assignment first — prevents enumeration.
  if (!(await canViewAssignmentFiles(session, file.assignment))) {
    return { ok: false, error: "File not found." };
  }
  if (!(await canDeleteAssignmentFile(session, file))) {
    return { ok: false, error: "You can only delete files you uploaded." };
  }
  if (isTerminalStatus(file.assignment.status)) {
    return {
      ok: false,
      error: `This assignment is ${file.assignment.status} — file edits are closed.`,
    };
  }

  // Optimistic predicate catches the race where assignment closes or the
  // file is deleted between the read above and our write.
  const claim = await prisma.assignmentFile.updateMany({
    where: {
      id: fileId,
      deletedAt: null,
      assignment: { status: { notIn: [...TERMINAL_STATUSES] } },
    },
    data: { deletedAt: new Date() },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: "File state changed while you were away. Reload and try again.",
    };
  }

  await audit({
    actorId: session.user.id,
    verb: "assignment.file_deleted",
    objectType: "assignment_file",
    objectId: fileId,
    metadata: {
      assignmentId: file.assignmentId,
      originalName: file.originalName,
    },
  });

  revalidatePath(`/dashboard/assignments/${file.assignmentId}/files`);
  revalidatePath(`/dashboard/assignments/${file.assignmentId}`);
  return { ok: true };
});

// ─── Get download URL ──────────────────────────────────────────────

export const getAssignmentFileDownloadUrl = withSession(async (
  session,
  fileId: string,
): Promise<ActionResult<{ url: string; originalName: string }>> => {
  const file = await prisma.assignmentFile.findFirst({
    where: { id: fileId, deletedAt: null },
    select: {
      storageKey: true,
      originalName: true,
      assignment: {
        select: {
          teamId: true,
          freelancerId: true,
          createdById: true,
        },
      },
    },
  });
  if (!file) return { ok: false, error: "File not found." };
  if (!(await canViewAssignmentFiles(session, file.assignment))) {
    return { ok: false, error: "File not found." };
  }

  const url = await storage().getSignedUrl(file.storageKey, DOWNLOAD_URL_TTL_SEC);
  return { ok: true, data: { url, originalName: file.originalName } };
});
