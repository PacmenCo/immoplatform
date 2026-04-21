"use client";

import { useState, useTransition } from "react";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { ErrorAlert } from "./ErrorAlert";
import { IconDownload, IconFileText, IconTrash } from "./Icons";
import { formatBytes } from "@/lib/format";
import {
  deleteAssignmentFile,
  getAssignmentFileDownloadUrl,
} from "@/app/actions/files";

export type FileRow = {
  id: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
  createdAt: Date;
  uploaderName: string | null;
  canDelete: boolean;
};

export function FileItem({ file }: { file: FileRow }) {
  // Separate transitions so the Delete button doesn't inherit pending
  // state from an in-flight download roundtrip (or vice versa).
  const [downloading, startDownload] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function onDownload() {
    setError(null);
    startDownload(async () => {
      const res = await getAssignmentFileDownloadUrl(file.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Same-tab navigation preserves the user-gesture chain so Safari's
      // popup blocker doesn't swallow the download. The Content-Disposition:
      // attachment header on the route keeps the user's current page intact.
      window.location.assign(res.data!.url);
    });
  }

  function runDelete() {
    setConfirmOpen(false);
    setError(null);
    startDelete(async () => {
      const res = await deleteAssignmentFile(file.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
        <IconFileText size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">
          {file.originalName}
        </p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {formatBytes(file.sizeBytes)}
          {file.uploaderName && <> · {file.uploaderName}</>}
          {" · "}
          {file.createdAt.toISOString().slice(0, 10)}
        </p>
        {error && (
          <div className="mt-2">
            <ErrorAlert>{error}</ErrorAlert>
          </div>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onDownload}
        loading={downloading}
        disabled={deleting}
      >
        <IconDownload size={14} />
        Download
      </Button>
      {file.canDelete && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmOpen(true)}
          loading={deleting}
          disabled={downloading}
          aria-label={`Delete ${file.originalName}`}
        >
          <IconTrash size={14} />
        </Button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="Delete this file?"
        description={`"${file.originalName}" will be removed from the assignment. This can't be undone.`}
        confirmLabel="Delete file"
        cancelLabel="Keep it"
        onConfirm={runDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </li>
  );
}
