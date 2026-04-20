// Small shared formatters used across dashboard pages.

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (f + l).toUpperCase() || "??";
}
