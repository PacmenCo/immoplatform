"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/Button";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { IconDownload, IconFileText, IconX } from "@/components/ui/Icons";
import {
  getAssignmentFileDownloadUrl,
  listAssignmentFiles,
} from "@/app/actions/files";

/**
 * Paperclip-style button in each assignments-list row. On click, loads the
 * file list for that assignment and shows a modal; each file has a Download
 * button that hits getAssignmentFileDownloadUrl and opens the returned URL.
 *
 * Platform parity: shows both freelancer + realtor lanes in one list (no
 * bulk-zip in v1 either), permissions are enforced server-side by
 * canViewAssignmentFiles so the button is safe to render unconditionally.
 */

type FileRow = {
  id: string;
  lane: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
};

export function AssignmentFilesButton({
  assignmentId,
  reference,
}: {
  assignmentId: string;
  reference: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Files for ${reference}`}
        className="grid h-9 w-9 place-items-center rounded text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
      >
        <PaperclipIcon />
      </button>
      {open && (
        <FilesModal
          assignmentId={assignmentId}
          reference={reference}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function FilesModal({
  assignmentId,
  reference,
  onClose,
}: {
  assignmentId: string;
  reference: string;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<FileRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startLoad] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startLoad(async () => {
      const res = await listAssignmentFiles(assignmentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFiles(res.data!.files);
    });
  }, [assignmentId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Files for ${reference}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(15,23,42,0.5)] p-4 sm:p-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mt-[10vh] w-full max-w-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-ink)]">Files</p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{reference}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
          >
            <IconX size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5">
          {error ? (
            <ErrorAlert>{error}</ErrorAlert>
          ) : files === null ? (
            <p className="text-sm text-[var(--color-ink-muted)]">Loading…</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-[var(--color-ink-muted)]">
              No files uploaded yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {files.map((f) => (
                <li key={f.id}>
                  <FileRow file={f} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FileRow({ file }: { file: FileRow }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    start(async () => {
      const res = await getAssignmentFileDownloadUrl(file.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      window.location.assign(res.data!.url);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-[var(--color-bg)] text-[var(--color-ink-muted)]">
        <IconFileText size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-ink)]">{file.originalName}</p>
        <p className="text-xs text-[var(--color-ink-muted)]">
          {file.lane === "freelancer" ? "Freelancer lane" : "Realtor lane"} ·{" "}
          {formatBytes(file.sizeBytes)}
        </p>
        {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={download} loading={pending}>
        <IconDownload size={12} />
        Download
      </Button>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PaperclipIcon() {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
