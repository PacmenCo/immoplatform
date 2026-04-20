"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/Dropzone";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
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

  // Clear picked files on successful server upload + surface server errors
  // into the single `error` channel so ErrorAlert shows them.
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      setFiles([]);
      setError(null);
    } else {
      setError(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
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
        onError={setError}
        disabled={pending}
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
