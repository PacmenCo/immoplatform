"use client";

import { useState, useTransition } from "react";
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

function IconDocument({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function IconDownload({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function FileItem({ file }: { file: FileRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDownload() {
    setError(null);
    startTransition(async () => {
      const res = await getAssignmentFileDownloadUrl(file.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.open(res.data!.url, "_blank", "noopener");
    });
  }

  function onDelete() {
    if (!confirm(`Delete "${file.originalName}"?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteAssignmentFile(file.id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]">
        <IconDocument />
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
          <p role="alert" className="mt-1 text-xs text-[var(--color-asbestos)]">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDownload}
        disabled={pending}
        aria-label={`Download ${file.originalName}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-2.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-ink-soft)] disabled:opacity-50"
      >
        <IconDownload />
        Download
      </button>
      {file.canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label={`Delete ${file.originalName}`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-asbestos)] disabled:opacity-50"
        >
          <IconTrash />
        </button>
      )}
    </li>
  );
}
