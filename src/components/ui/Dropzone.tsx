"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { formatBytes } from "@/lib/format";
import { MAX_FILES_PER_UPLOAD } from "@/lib/file-constraints";
import { IconX } from "./Icons";
import { Spinner } from "./Spinner";

function IconUpload({ size = 24, className }: { size?: number; className?: string }) {
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
      className={className}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

type Props = {
  /** Name of the file input — the server action reads `formData.getAll(name)`. */
  name: string;
  files: File[];
  onChange: (files: File[]) => void;
  /** Comma-separated MIME list forwarded to `<input accept>`. */
  accept?: string;
  /** Display-only hint, e.g. "PDF only · up to 50 MB". */
  hint?: string;
  label?: string;
  maxFiles?: number;
  /** Per-file size cap in MB — client rejects before submit. */
  maxMB?: number;
  className?: string;
  disabled?: boolean;
  /**
   * True while the enclosing form's action is in flight. Renders a
   * spinner in place of each file's remove button and pulses a
   * subtle in-progress stripe on the row. Server actions don't expose
   * byte-level progress, so this is deliberately indeterminate.
   */
  uploading?: boolean;
  /** Called with a friendly message when client-side validation rejects. */
  onError?: (message: string) => void;
};

export function Dropzone({
  name,
  files,
  onChange,
  accept,
  hint,
  label,
  maxFiles = MAX_FILES_PER_UPLOAD,
  maxMB,
  className,
  disabled,
  uploading,
  onError,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function ingest(candidates: File[]) {
    const errs: string[] = [];
    const passed: File[] = [];
    for (const f of candidates) {
      if (maxMB && f.size > maxMB * 1024 * 1024) {
        errs.push(`"${f.name}" is larger than the ${maxMB} MB limit.`);
        continue;
      }
      passed.push(f);
    }
    let next = [...files, ...passed];
    if (next.length > maxFiles) {
      errs.push(`At most ${maxFiles} files per upload.`);
      next = next.slice(0, maxFiles);
    }
    // onChange FIRST so listeners that clear error state on change don't
    // erase the error we're about to fire. This pairs with FileUploadForm,
    // which clears its error banner on every onChange — if we fired
    // onError first, the truncation message would be wiped by the onChange
    // that follows.
    onChange(next);
    syncInput(next);
    if (errs.length && onError) onError(errs.join(" "));
  }

  /**
   * Keep the hidden native input's FileList in sync with our React state
   * so a plain <form action={...}> submission carries all picked files.
   */
  function syncInput(next: File[]) {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    for (const f of next) dt.items.add(f);
    inputRef.current.files = dt.files;
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length > 0) ingest(picked);
  }

  function remove(idx: number) {
    const next = files.filter((_, i) => i !== idx);
    onChange(next);
    syncInput(next);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(false);
          const picked = Array.from(e.dataTransfer.files);
          if (picked.length > 0) ingest(picked);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-[var(--color-brand)] bg-[color-mix(in_srgb,var(--color-brand)_6%,var(--color-bg))]"
            : "border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] hover:border-[var(--color-brand)] hover:bg-[var(--color-bg)]",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-bg)] text-[var(--color-brand)] ring-1 ring-[var(--color-border)]">
          <IconUpload size={22} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-ink)]">
            {label ?? "Drop files or click to upload"}
          </p>
          {hint && (
            <p className="text-xs text-[var(--color-ink-muted)]">{hint}</p>
          )}
        </div>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name={name}
          multiple={maxFiles > 1}
          accept={accept}
          disabled={disabled}
          className="sr-only"
          onChange={onInput}
        />
      </label>

      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className={cn(
                "flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm transition-opacity",
                uploading && "opacity-80 animate-pulse",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">
                {f.name}
              </span>
              <span className="shrink-0 text-xs text-[var(--color-ink-muted)] tabular-nums">
                {formatBytes(f.size)}
              </span>
              {uploading ? (
                <span
                  aria-label={`Uploading ${f.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center text-[var(--color-brand)]"
                >
                  <Spinner />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove ${f.name}`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                >
                  <IconX size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
