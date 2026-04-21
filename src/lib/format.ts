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

export function fullName(u: { firstName: string; lastName: string }): string {
  return `${u.firstName} ${u.lastName}`;
}

/** Integer cents → "€ 123.45" (or "−€ 25.00" for negatives). */
export function formatEuros(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const frac = (Math.abs(cents) % 100).toString().padStart(2, "0");
  const sign = cents < 0 ? "−" : "";
  return `${sign}€ ${whole}.${frac}`;
}

/**
 * Display a commission rate the way it was stored: percentage values are in
 * basis-points (1_000 → "10%", 1_050 → "10.5%"); fixed values are raw cents.
 * `type` is `string | null` so callers can pass a DB column without narrowing.
 */
export function formatCommissionRate(
  type: string | null | undefined,
  value: number | null | undefined,
): string {
  if (!type || value === null || value === undefined) return "—";
  if (type === "percentage") {
    const whole = value % 100 === 0;
    return `${(value / 100).toFixed(whole ? 0 : 1)}%`;
  }
  if (type === "fixed") return formatEuros(value);
  return "—";
}
