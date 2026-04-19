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

export function Dropzone({
  label,
  hint,
  accept,
  className,
}: {
  label?: string;
  hint?: string;
  accept?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border-2 border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-6 py-10 text-center transition-colors hover:border-[var(--color-brand)] hover:bg-white",
        className,
      )}
      role="button"
      tabIndex={0}
      aria-label={label ?? "Upload files"}
      data-accept={accept}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-white text-[var(--color-brand)] ring-1 ring-[var(--color-border)]">
        <IconUpload size={22} />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-ink)]">
          {label ?? "Drop files or click to upload"}
        </p>
        {hint && (
          <p className="text-xs text-[var(--color-ink-muted)]">{hint}</p>
        )}
        {accept && (
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-ink-faint)]">
            Accepts: {accept}
          </p>
        )}
      </div>
    </div>
  );
}
