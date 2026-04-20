import { FileItem, type FileRow } from "./FileItem";

export type { FileRow } from "./FileItem";

/**
 * Renders a list of `AssignmentFile` rows. Server component — each row
 * delegates interactive bits (download / delete) to the `FileItem` client
 * component. Pass `emptyMessage` to customise the zero-state copy per lane.
 */
export function FileList({
  files,
  emptyMessage = "No files uploaded yet.",
}: {
  files: FileRow[];
  emptyMessage?: string;
}) {
  if (files.length === 0) {
    return (
      <p className="text-sm text-[var(--color-ink-muted)]">{emptyMessage}</p>
    );
  }
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <FileItem key={f.id} file={f} />
      ))}
    </ul>
  );
}
