"use server";

import { revalidatePath } from "next/cache";
import { cuid } from "@/lib/cuid";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import {
  canDeleteAssignmentFile,
  canUploadToFreelancerLane,
  canUploadToRealtorLane,
  canViewAssignmentFiles,
} from "@/lib/permissions";
import { isTerminalStatus } from "@/lib/mockData";
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

async function canUploadToLane(
  session: Parameters<typeof canUploadToFreelancerLane>[0],
  lane: FileLane,
  assignment: Parameters<typeof canUploadToFreelancerLane>[1],
): Promise<boolean> {
  return lane === "freelancer"
    ? canUploadToFreelancerLane(session, assignment)
    : canUploadToRealtorLane(session, assignment);
}

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
  if (!(await canUploadToLane(session, lane, assignment))) {
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
    if (!allowedMimes.includes(file.type)) {
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
  const prepared = await Promise.all(
    files.map(async (file) => {
      const id = cuid();
      const key = makeAssignmentFileKey({
        assignmentId,
        lane,
        fileId: id,
        originalName: file.name,
      });
      const buf = Buffer.from(await file.arrayBuffer());
      const put = await store.put(key, buf, { mimeType: file.type });
      return { id, key, put, file };
    }),
  );

  try {
    await prisma.$transaction(
      prepared.map(({ id, put, file }) =>
        prisma.assignmentFile.create({
          data: {
            id,
            assignmentId,
            uploaderId: session.user.id,
            lane,
            storageKey: put.key,
            originalName: file.name,
            mimeType: file.type,
            sizeBytes: put.sizeBytes,
          },
        }),
      ),
    );
  } catch (err) {
    // DB insert failed — undo the storage writes so we don't orphan bytes.
    await Promise.all(prepared.map((p) => store.delete(p.key).catch(() => {})));
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

  await prisma.assignmentFile.update({
    where: { id: fileId },
    data: { deletedAt: new Date() },
  });

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
