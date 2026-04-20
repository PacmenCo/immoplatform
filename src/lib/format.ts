// Small shared formatters used across dashboard pages.

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (f + l).toUpperCase() || "??";
}

/** Human-readable file size. 2 kB → "2.0 KB", 1048576 → "1.0 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}
