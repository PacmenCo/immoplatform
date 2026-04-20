"use client";

import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

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

function IconX({ size = 14 }: { size?: number }) {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
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
  maxFiles,
  maxMB,
  className,
  disabled,
  onError,
}: Props) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function accept_(candidates: File[]) {
    const errs: string[] = [];
    const passed: File[] = [];
    for (const f of candidates) {
      if (maxMB && f.size > maxMB * 1024 * 1024) {
        errs.push(`"${f.name}" is larger than ${maxMB} MB.`);
        continue;
      }
      passed.push(f);
    }
    let next = [...files, ...passed];
    if (maxFiles && next.length > maxFiles) {
      errs.push(`At most ${maxFiles} files per upload.`);
      next = next.slice(0, maxFiles);
    }
    if (errs.length && onError) onError(errs.join(" "));
    onChange(next);
    syncInput(next);
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
    // Reset so re-picking the same file re-triggers; DataTransfer sync happens next.
    if (picked.length > 0) accept_(picked);
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
          if (picked.length > 0) accept_(picked);
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
          multiple={!maxFiles || maxFiles > 1}
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
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate text-[var(--color-ink)]">
                {f.name}
              </span>
              <span className="shrink-0 text-xs text-[var(--color-ink-muted)] tabular-nums">
                {formatBytes(f.size)}
              </span>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove ${f.name}`}
                className="grid h-6 w-6 shrink-0 place-items-center rounded text-[var(--color-ink-muted)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
              >
                <IconX />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
