"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/Dropzone";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { uploadAssignmentFiles } from "@/app/actions/files";
import {
  FILE_CONSTRAINTS,
  MAX_FILES_PER_UPLOAD,
  type FileLane,
} from "@/lib/file-constraints";
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
  const [clientError, setClientError] = useState<string | null>(null);

  // Clear picked files + errors on successful server upload.
  useEffect(() => {
    if (state?.ok) {
      setFiles([]);
      setClientError(null);
    }
  }, [state]);

  const error = clientError ?? (state && !state.ok ? state.error : null);

  return (
    <form action={formAction} className="space-y-4">
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <Dropzone
        name="file"
        files={files}
        onChange={(next) => {
          setFiles(next);
          setClientError(null);
        }}
        accept={constraints.allowedMimes.join(",")}
        hint={constraints.acceptHint}
        label={
          lane === "freelancer"
            ? "Drop certificate PDF(s) or click to upload"
            : "Drop floor plans, photos or notes"
        }
        maxMB={constraints.maxMB}
        maxFiles={MAX_FILES_PER_UPLOAD}
        onError={setClientError}
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
