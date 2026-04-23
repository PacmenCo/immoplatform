"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/Dropzone";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { useToast } from "@/components/ui/Toast";
import { uploadAssignmentFiles } from "@/app/actions/files";
import { FILE_CONSTRAINTS, type FileLane } from "@/lib/file-constraints";
import type { ActionResult } from "@/app/actions/_types";

export function FileUploadForm({
  assignmentId,
  lane,
}: {
  assignmentId: string;
  lane: FileLane;
}) {
  const constraints = FILE_CONSTRAINTS[lane];
  const action = uploadAssignmentFiles.bind(null, assignmentId, lane);
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  // `files` clears on success before the toast fires, so capture the count
  // at submit-time for the confirmation message.
  const lastSubmittedCount = useRef(0);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      const n = lastSubmittedCount.current;
      setFiles([]);
      setError(null);
      if (n > 0) {
        toast.success(`Uploaded ${n} file${n === 1 ? "" : "s"}.`);
      }
    } else {
      setError(state.error);
      toast.error(state.error);
    }
  }, [state, toast]);

  return (
    <form
      action={(fd) => {
        lastSubmittedCount.current = files.length;
        return formAction(fd);
      }}
      className="space-y-4"
    >
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Dropzone
        name="file"
        files={files}
        onChange={(next) => {
          setFiles(next);
          setError(null);
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
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-ink-muted)]">
          {files.length === 0
            ? "No files picked yet."
            : `${files.length} file${files.length === 1 ? "" : "s"} ready to upload.`}
        </p>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          disabled={files.length === 0}
        >
          Upload
        </Button>
      </div>
    </form>
  );
}
