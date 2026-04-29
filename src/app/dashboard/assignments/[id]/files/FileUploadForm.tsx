"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dropzone } from "@/components/ui/Dropzone";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useToast } from "@/components/ui/Toast";
import {
  abortAssignmentFileUploads,
  finalizeAssignmentFileUpload,
  presignAssignmentFileUpload,
  type FinalizeItem,
  type PresignedUpload,
} from "@/app/actions/files";
import { FILE_CONSTRAINTS, type FileLane } from "@/lib/file-constraints";

/** Cap concurrent PUTs so a 20-file upload doesn't open 20 sockets at once. */
const UPLOAD_CONCURRENCY = 3;

export function FileUploadForm({
  assignmentId,
  lane,
}: {
  assignmentId: string;
  lane: FileLane;
}) {
  const constraints = FILE_CONSTRAINTS[lane];
  const router = useRouter();
  const { toast } = useToast();

  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Imperative bag of in-flight XHRs so a future Cancel button can abort
  // them. Also lets the unmount cleanup below abort uploads if the user
  // navigates away mid-batch — without this, sockets keep streaming bytes
  // to S3 with nothing on the React side to handle the eventual response.
  const inFlight = useRef<Set<XMLHttpRequest>>(new Set());

  useEffect(() => {
    const bag = inFlight.current;
    return () => {
      for (const xhr of bag) xhr.abort();
      bag.clear();
    };
  }, []);

  // v1 parity: FilePond auto-uploads on file selection (no separate confirm
  // button). Triggered from Dropzone's onChange the moment the user picks or
  // drops files. Takes the batch as a parameter rather than reading `files`
  // state so the closure isn't racing the setFiles update.
  async function runUpload(batch: File[]) {
    if (pending || batch.length === 0) return;
    setError(null);
    setPending(true);
    setProgress(new Array(batch.length).fill(0));

    try {
      // 1) Presign — server validates lane, terminal status, MIME, size cap,
      //    count cap; returns a PUT URL per file plus the storage key + fileId.
      const meta = batch.map((f) => ({
        name: f.name,
        mimeType: f.type,
        sizeBytes: f.size,
      }));
      const pres = await presignAssignmentFileUpload(assignmentId, lane, meta);
      if (!pres.ok) {
        setError(pres.error);
        toast.error(pres.error);
        return;
      }

      const uploads = pres.data!.uploads;
      if (uploads.length !== batch.length) {
        const msg = "Mismatched upload tickets — try again.";
        setError(msg);
        toast.error(msg);
        return;
      }

      // 2) PUT each file directly to storage. Concurrency-limited so a
      //    20-file batch doesn't saturate the user's upload bandwidth.
      const completed: PresignedUpload[] = [];
      const failed: PresignedUpload[] = [];
      let firstError: string | null = null;
      const queue = uploads.map((u, i) => ({ u, file: batch[i], index: i }));
      const workers = Array.from({ length: Math.min(UPLOAD_CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (!next) break;
          try {
            await putWithProgress(next.u.uploadUrl, next.file, (pct) => {
              setProgress((prev) => {
                const out = prev.slice();
                out[next.index] = pct;
                return out;
              });
            }, inFlight.current);
            completed.push(next.u);
          } catch (err) {
            failed.push(next.u);
            if (!firstError) {
              firstError = err instanceof Error ? err.message : "Upload failed.";
            }
          }
        }
      });
      await Promise.all(workers);

      if (failed.length > 0) {
        // Clean up whatever made it so the bucket doesn't accumulate
        // orphans. Best-effort — on cleanup failure we still surface the
        // upload error; a future bucket lifecycle rule can sweep stragglers.
        const keysToAbort = [
          ...failed.map((u) => u.storageKey),
          ...completed.map((u) => u.storageKey),
        ];
        await abortAssignmentFileUploads(assignmentId, lane, keysToAbort).catch(() => {});
        const msg = firstError ?? "One or more files failed to upload.";
        setError(msg);
        toast.error(msg);
        return;
      }

      // 3) Finalize — server HEADs each object to confirm size + reads the
      //    first 1 KB to magic-byte sniff, then runs the same DB
      //    transaction (createMany + auto-complete + commission) and
      //    side-effects (audit + email + revalidate) as the legacy upload.
      const items: FinalizeItem[] = uploads.map((u, i) => ({
        fileId: u.fileId,
        storageKey: u.storageKey,
        originalName: u.originalName,
        mimeType: u.mimeType,
        sizeBytes: batch[i].size,
      }));
      const fin = await finalizeAssignmentFileUpload(assignmentId, lane, items);
      if (!fin.ok) {
        setError(fin.error);
        toast.error(fin.error);
        return;
      }

      const n = batch.length;
      toast.success(`Uploaded ${n} file${n === 1 ? "" : "s"}.`);
      setFiles([]);
      setProgress([]);
      // revalidatePath inside the action marks server cache stale; refresh
      // pulls the new file list into the current view without a full nav.
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Dropzone
        name="file"
        files={files}
        onChange={(next) => {
          setFiles(next);
          setError(null);
          // The Dropzone is disabled while pending, so onChange can only
          // fire with a fresh batch (or with [] when the user removes a
          // post-success row before refresh lands). Empty batches no-op.
          const newOnes = next.filter((f) => !files.includes(f));
          if (newOnes.length > 0) {
            void runUpload(newOnes);
          }
        }}
        accept={constraints.allowedMimes.join(",")}
        hint={constraints.acceptHint}
        label={
          lane === "freelancer"
            ? "Drop certificate PDF(s) or click to upload"
            : "Drop floor plans, photos or notes"
        }
        maxMB={constraints.maxMB}
        onError={(msg) => {
          setError(msg);
          toast.error(msg);
        }}
        disabled={pending}
        uploading={pending}
        progress={pending ? progress : undefined}
      />
    </div>
  );
}

/**
 * PUT a single file to a presigned URL with byte-level progress callbacks.
 * `fetch` doesn't expose upload progress in any portable way; XHR does.
 * The Set lets the parent track in-flight requests for future cancellation.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (pct: number) => void,
  bag: Set<XMLHttpRequest>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    bag.add(xhr);
    xhr.open("PUT", url, true);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      bag.delete(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`));
      }
    };
    const fail = (err: Error) => {
      bag.delete(xhr);
      reject(err);
    };
    xhr.onerror = () => fail(new Error("Network error during upload."));
    // upload.onerror catches stalls/disconnects mid-PUT specifically (the
    // top-level onerror only fires for response-side errors). Belt and
    // suspenders — both reject the same promise via the bag-delete guard.
    xhr.upload.onerror = () => fail(new Error("Network error during upload."));
    xhr.onabort = () => fail(new Error("Upload aborted."));
    xhr.send(file);
  });
}
