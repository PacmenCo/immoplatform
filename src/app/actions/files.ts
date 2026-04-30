"use server";

import { revalidatePath } from "next/cache";
import { generateCuid } from "@/lib/cuid";
import { prisma } from "@/lib/db";
import { audit, type SessionWithUser } from "@/lib/auth";
import { applyCommission } from "@/lib/commission";
import { assignmentCompletedEmail, filesUploadedEmail } from "@/lib/email";
import { notify } from "@/lib/notify";
import {
  collectAgencyRecipients,
  loadUser,
  type Recipient,
} from "@/lib/assignment-recipients";
import { fullName } from "@/lib/format";
import { assignmentUrl as assignmentUrlFor } from "@/lib/urls";
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
  magicBytesValid,
  type FileLane,
} from "@/lib/file-constraints";
import { makeAssignmentFileKey, storage } from "@/lib/storage";
import type { Storage } from "@/lib/storage";
import { withSession, type ActionResult } from "./_types";

/** TTL for signed download URLs. Matches Platform's 5-minute window. */
// 1 hour — matches Platform parity (AssignmentController::downloadFile
// uses `now()->addHour()`). Long enough that a paused or slow download
// doesn't hit an expired URL; well under AWS's 7-day max.
const DOWNLOAD_URL_TTL_SEC = 60 * 60;

type LaneUploadPolicy = (
  s: SessionWithUser,
  a: AssignmentPolicyInput,
) => Promise<boolean>;

const LANE_UPLOAD_POLICY: Record<FileLane, LaneUploadPolicy> = {
  freelancer: canUploadToFreelancerLane,
  realtor: canUploadToRealtorLane,
};

/**
 * Window the browser has after `presign` to PUT all bytes and call
 * `finalize`. Long enough for a 500 MB upload on a flaky 10 Mbps link
 * (~7 min) plus headroom; short enough that an abandoned tab doesn't
 * leave a usable upload URL lying around.
 */
const PRESIGN_TTL_SEC = 30 * 60;

/**
 * Tolerance on the size sanity check during finalize. The browser
 * rounds Content-Length and S3 reports the exact stored byte count;
 * a tiny delta isn't suspicious. Anything bigger is — likely a swap.
 */
const SIZE_TOLERANCE_BYTES = 8;

type PreparedRow = {
  id: string;
  key: string;
  sizeBytes: number;
  originalName: string;
  mimeType: string;
};

/**
 * Shared post-storage workflow for both the legacy in-process upload
 * (`uploadAssignmentFilesInner`) and the direct-to-storage finalize
 * (`finalizeAssignmentFileUploadInner`). Bytes are already at `store`;
 * we own DB rows + status transition + commission + audits + emails.
 *
 * On any failure deletes the storage objects so we don't leak orphans.
 */
async function applyUploadBookkeeping(
  session: SessionWithUser,
  assignmentId: string,
  lane: FileLane,
  prepared: PreparedRow[],
  store: Storage,
): Promise<ActionResult> {
  let autoCompleted = false;
  let commissionAmountCents: number | null = null;
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
          originalName: p.originalName,
          mimeType: p.mimeType,
          sizeBytes: p.sizeBytes,
        })),
      });
      // Platform parity (ProcessFilePondUpload.php:260-289 + AssignmentController.php:704-716):
      // a freelancer-lane upload jumps the assignment straight to `completed`
      // and fires the commission calc. `deliveredAt` is backfilled atomically
      // (only when still null) so a concurrent admin set can't be clobbered.
      if (lane === "freelancer") {
        const now = new Date();
        await tx.assignment.update({
          where: { id: assignmentId },
          data: { status: "completed", completedAt: now },
        });
        await tx.assignment.updateMany({
          where: { id: assignmentId, deliveredAt: null },
          data: { deliveredAt: now },
        });
        autoCompleted = true;
        const commission = await applyCommission(assignmentId, tx);
        commissionAmountCents = commission?.amountCents ?? null;
      }
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

  for (const p of prepared) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.file_uploaded",
      objectType: "assignment_file",
      objectId: p.id,
      metadata: {
        assignmentId,
        lane,
        originalName: p.originalName,
        sizeBytes: p.sizeBytes,
      },
    });
  }

  if (autoCompleted) {
    await audit({
      actorId: session.user.id,
      verb: "assignment.completed",
      objectType: "assignment",
      objectId: assignmentId,
      metadata: { trigger: "freelancer_upload", fileCount: prepared.length },
    });
    if (commissionAmountCents !== null) {
      await audit({
        actorId: session.user.id,
        verb: "assignment.commission_applied",
        objectType: "assignment",
        objectId: assignmentId,
        metadata: {
          amountCents: commissionAmountCents,
          trigger: "freelancer_upload",
        },
      });
    }
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
    let recipients: Recipient[] = [];
    if (lane === "freelancer") {
      recipients = await collectAgencyRecipients({
        teamId: meta.teamId,
        createdById: meta.createdById,
        exclude: [session.user.id],
      });
    } else if (lane === "realtor" && meta.freelancerId !== session.user.id) {
      const f = await loadUser(meta.freelancerId);
      if (f) recipients = [f];
    }
    const uploaderName = fullName(session.user);
    const ctx = {
      reference: meta.reference,
      address: meta.address,
      city: meta.city,
      postal: meta.postal,
      assignmentUrl: assignmentUrlFor(meta.id),
    };
    await Promise.all(
      recipients.map(async (r) =>
        notify({
          to: r,
          event: "assignment.files_uploaded",
          ...(await filesUploadedEmail({
            ...ctx,
            recipientName: r.firstName,
            uploaderName,
            lane,
            fileCount: prepared.length,
          })),
        }),
      ),
    );

    // Platform parity (AssignmentCompletedMail at AssignmentController.php:1082):
    // v2's auto-complete path skips "delivered" and lands directly on
    // "completed", so the files_uploaded email above doesn't say "it's
    // done" — fan out the completion event too. Auto-complete only fires
    // on the freelancer lane, where `recipients` is already the agency,
    // so reuse it instead of querying again. The assigned freelancer is
    // added only when they're not the uploader (admin/staff uploading on
    // behalf of the freelancer is possible via canUploadToFreelancerLane).
    if (autoCompleted) {
      const completedRecipients: Recipient[] = [...recipients];
      if (meta.freelancerId && meta.freelancerId !== session.user.id) {
        const assignedFreelancer = await loadUser(meta.freelancerId);
        if (
          assignedFreelancer &&
          !completedRecipients.some((r) => r.id === assignedFreelancer.id)
        ) {
          completedRecipients.push(assignedFreelancer);
        }
      }
      await Promise.all(
        completedRecipients.map(async (r) =>
          notify({
            to: r,
            event: "assignment.completed",
            ...(await assignmentCompletedEmail({
              ...ctx,
              recipientName: r.firstName,
              completedByName: uploaderName,
            })),
          }),
        ),
      );
    }
  }

  revalidatePath(`/dashboard/assignments/${assignmentId}/edit`);
  revalidatePath(`/dashboard/assignments/${assignmentId}`);
  return { ok: true };
}

// ─── Upload ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `uploadAssignmentFiles`. Exported so Vitest
 * integration tests can drive the action without a live cookie / request
 * context. Consumers should use the `withSession`-wrapped form below.
 */
export async function uploadAssignmentFilesInner(
  session: SessionWithUser,
  assignmentId: string,
  lane: FileLane,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
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
    // Magic-byte sniff against the declared MIME — `file.type` is browser-
    // supplied and trivially spoofable. Without this an attacker can upload
    // an HTML/script polyglot under `application/pdf` that becomes XSS if
    // any future viewer renders it inline.
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (!magicBytesValid(head, mime)) {
      return {
        ok: false,
        error: `"${file.name}" doesn't match its declared file type.`,
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
  const prepared: PreparedRow[] = [];
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
      prepared.push({
        id,
        key,
        sizeBytes,
        originalName: file.name,
        mimeType: file.type.toLowerCase(),
      });
    }
  } catch (err) {
    await Promise.all(prepared.map((p) => store.delete(p.key).catch(() => {})));
    throw err;
  }

  return applyUploadBookkeeping(session, assignmentId, lane, prepared, store);
}

export const uploadAssignmentFiles = withSession(uploadAssignmentFilesInner);

// ─── Direct-to-storage upload (presign + finalize) ────────────────
//
// Replacement for the in-process upload above on large files. The browser:
//   1) calls `presignAssignmentFileUpload` with file metadata
//   2) PUTs each file straight to S3 / DO Spaces using the returned URL
//   3) calls `finalizeAssignmentFileUpload` with the keys
//
// Bytes never travel through the Node server, so the 1 GB droplet handles
// 500 MB uploads without strain. Auth + lane policy + size cap + magic-byte
// check all happen on the server before/after the bucket round-trip.

export type PresignedUpload = {
  fileId: string;
  storageKey: string;
  uploadUrl: string;
  originalName: string;
  mimeType: string;
};

export type FinalizeItem = {
  fileId: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function presignAssignmentFileUploadInner(
  session: SessionWithUser,
  assignmentId: string,
  lane: FileLane,
  files: Array<{ name: string; mimeType: string; sizeBytes: number }>,
): Promise<ActionResult<{ uploads: PresignedUpload[] }>> {
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

  if (!Array.isArray(files) || files.length === 0) {
    return { ok: false, error: "Pick a file to upload." };
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { ok: false, error: `Upload up to ${MAX_FILES_PER_UPLOAD} files at a time.` };
  }

  const { maxMB, allowedMimes } = FILE_CONSTRAINTS[lane];
  const maxBytes = maxMB * 1024 * 1024;
  for (const f of files) {
    const mime = f.mimeType?.toLowerCase() ?? "";
    if (!allowedMimes.includes(mime)) {
      return {
        ok: false,
        error: `"${f.name}" isn't an allowed file type. ${FILE_CONSTRAINTS[lane].acceptHint}.`,
      };
    }
    if (!Number.isFinite(f.sizeBytes) || f.sizeBytes <= 0) {
      return { ok: false, error: `"${f.name}" is empty.` };
    }
    if (f.sizeBytes > maxBytes) {
      return {
        ok: false,
        error: `"${f.name}" is larger than the ${maxMB} MB limit.`,
      };
    }
  }

  const store = storage();
  const uploads: PresignedUpload[] = [];
  for (const f of files) {
    const fileId = generateCuid();
    const storageKey = makeAssignmentFileKey({
      assignmentId,
      lane,
      fileId,
      originalName: f.name,
    });
    const mime = f.mimeType.toLowerCase();
    const uploadUrl = await store.getPresignedUploadUrl(storageKey, {
      ttlSec: PRESIGN_TTL_SEC,
      mimeType: mime,
    });
    uploads.push({
      fileId,
      storageKey,
      uploadUrl,
      originalName: f.name,
      mimeType: mime,
    });
  }
  return { ok: true, data: { uploads } };
}

export const presignAssignmentFileUpload = withSession(
  presignAssignmentFileUploadInner,
);

export async function finalizeAssignmentFileUploadInner(
  session: SessionWithUser,
  assignmentId: string,
  lane: FileLane,
  items: FinalizeItem[],
): Promise<ActionResult> {
  if (!isLane(lane)) return { ok: false, error: "Invalid file lane." };
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "No uploaded files to finalize." };
  }
  if (items.length > MAX_FILES_PER_UPLOAD) {
    return { ok: false, error: `Finalize up to ${MAX_FILES_PER_UPLOAD} files at a time.` };
  }

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

  const expectedPrefix = `assignments/${assignmentId}/${lane}/`;
  const { maxMB, allowedMimes } = FILE_CONSTRAINTS[lane];
  const maxBytes = maxMB * 1024 * 1024;

  // Re-validate every item against current policy + the actual stored
  // bytes. The browser is hostile by default — we trust nothing it sent
  // back from presign other than the keys (which we minted) and the bytes
  // (which we now read directly).
  const store = storage();
  const cleanup = async () => {
    await Promise.all(items.map((it) => store.delete(it.storageKey).catch(() => {})));
  };
  const prepared: PreparedRow[] = [];
  for (const it of items) {
    if (!it.storageKey.startsWith(expectedPrefix)) {
      await cleanup();
      return { ok: false, error: "Upload keys don't match this assignment." };
    }
    const mime = (it.mimeType ?? "").toLowerCase();
    if (!allowedMimes.includes(mime)) {
      await cleanup();
      return {
        ok: false,
        error: `"${it.originalName}" isn't an allowed file type.`,
      };
    }
    const head = await store.headObject(it.storageKey);
    if (!head) {
      await cleanup();
      return {
        ok: false,
        error: `"${it.originalName}" didn't finish uploading. Try again.`,
      };
    }
    if (head.sizeBytes > maxBytes) {
      await cleanup();
      return {
        ok: false,
        error: `"${it.originalName}" is larger than the ${maxMB} MB limit.`,
      };
    }
    if (Math.abs(head.sizeBytes - it.sizeBytes) > SIZE_TOLERANCE_BYTES) {
      await cleanup();
      return {
        ok: false,
        error: `"${it.originalName}" doesn't match the expected size.`,
      };
    }
    const headBytes = await store.getRange(it.storageKey, 0, 1024);
    if (!headBytes || !magicBytesValid(new Uint8Array(headBytes), mime)) {
      await cleanup();
      return {
        ok: false,
        error: `"${it.originalName}" doesn't match its declared file type.`,
      };
    }
    prepared.push({
      id: it.fileId,
      key: it.storageKey,
      sizeBytes: head.sizeBytes,
      originalName: it.originalName,
      mimeType: mime,
    });
  }

  return applyUploadBookkeeping(session, assignmentId, lane, prepared, store);
}

export const finalizeAssignmentFileUpload = withSession(
  finalizeAssignmentFileUploadInner,
);

/**
 * Best-effort cleanup the client calls when a PUT fails mid-batch. Lets
 * us free orphan bytes deterministically instead of waiting on a bucket
 * lifecycle rule. Permission to delete a key is the same as permission
 * to upload — we re-check lane policy.
 */
export async function abortAssignmentFileUploadsInner(
  session: SessionWithUser,
  assignmentId: string,
  lane: FileLane,
  storageKeys: string[],
): Promise<ActionResult> {
  if (!isLane(lane)) return { ok: false, error: "Invalid file lane." };
  if (!Array.isArray(storageKeys) || storageKeys.length === 0) {
    return { ok: true };
  }
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
    return { ok: false, error: "Forbidden." };
  }
  const expectedPrefix = `assignments/${assignmentId}/${lane}/`;
  const safe = storageKeys.filter((k) => k.startsWith(expectedPrefix));
  if (safe.length === 0) return { ok: true };
  await storage().deleteMany(safe);
  return { ok: true };
}

export const abortAssignmentFileUploads = withSession(
  abortAssignmentFileUploadsInner,
);

// ─── Delete ────────────────────────────────────────────────────────

/**
 * Session-accepting body of `deleteAssignmentFile`. Exported for Vitest tests.
 */
export async function deleteAssignmentFileInner(
  session: SessionWithUser,
  fileId: string,
): Promise<ActionResult> {
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

  revalidatePath(`/dashboard/assignments/${file.assignmentId}/edit`);
  revalidatePath(`/dashboard/assignments/${file.assignmentId}`);
  return { ok: true };
}

export const deleteAssignmentFile = withSession(deleteAssignmentFileInner);

// ─── Get download URL ──────────────────────────────────────────────

/**
 * Session-accepting body of `listAssignmentFiles`. Exported for Vitest tests.
 * Visible to admin/staff, the team's members, the creator, and the assigned
 * freelancer (via `canViewAssignmentFiles`).
 */
export async function listAssignmentFilesInner(
  session: SessionWithUser,
  assignmentId: string,
): Promise<
  ActionResult<{
    files: Array<{
      id: string;
      lane: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: Date;
    }>;
  }>
> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: { teamId: true, freelancerId: true, createdById: true },
  });
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (!(await canViewAssignmentFiles(session, assignment))) {
    return { ok: false, error: "You don't have permission to see this assignment's files." };
  }

  const files = await prisma.assignmentFile.findMany({
    where: { assignmentId, deletedAt: null },
    orderBy: [{ lane: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      lane: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return { ok: true, data: { files } };
}

export const listAssignmentFiles = withSession(listAssignmentFilesInner);

/**
 * Session-accepting body of `getAssignmentFileDownloadUrl`. Exported for tests.
 */
export async function getAssignmentFileDownloadUrlInner(
  session: SessionWithUser,
  fileId: string,
): Promise<ActionResult<{ url: string; originalName: string }>> {
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

  // `downloadName` tells S3 / DO Spaces to serve the file with the original
  // filename via Content-Disposition; LocalStorage ignores it (the
  // /api/files/* route already reads the name from the DB row).
  const url = await storage().getSignedUrl(file.storageKey, {
    ttlSec: DOWNLOAD_URL_TTL_SEC,
    downloadName: file.originalName,
  });
  return { ok: true, data: { url, originalName: file.originalName } };
}

export const getAssignmentFileDownloadUrl = withSession(getAssignmentFileDownloadUrlInner);
