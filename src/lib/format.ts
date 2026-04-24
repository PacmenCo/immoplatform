// Small shared formatters used across dashboard pages.

export function initials(first: string | null | undefined, last: string | null | undefined): string {
  const f = first?.[0] ?? "";
  const l = last?.[0] ?? "";
  return (f + l).toUpperCase() || "??";
}

// Two-letter initialism from a single name string (e.g. a team name).
// Falls back to "?" on empty input. Used for logo placeholders.
export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
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

// ─── Belgian date/time formatters ──────────────────────────────────
// Centralised so every surface (dashboards, emails, timestamps) renders
// dates in the user's real timezone. Immo serves a Belgium-only market;
// we hard-code Europe/Brussels rather than thread recipient prefs through
// every call site. Locale nl-BE uses European d/m/y and 24-hour style.

/** Long weekday + day + month — for prominent "today is …" headers. */
export const BE_DATE_FULL = new Intl.DateTimeFormat("nl-BE", {
  timeZone: "Europe/Brussels",
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** Short date — for list cells and cards where horizontal space is tight. */
export const BE_DATE_SHORT = new Intl.DateTimeFormat("nl-BE", {
  timeZone: "Europe/Brussels",
  day: "2-digit",
  month: "short",
});

/** Date + time — for scheduled-appointment emails and event descriptions. */
export const BE_DATETIME = new Intl.DateTimeFormat("nl-BE", {
  timeZone: "Europe/Brussels",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "April 2026" — English month + year, UTC-anchored. Used in admin emails
 *  where the body copy is in English regardless of the nl-BE default. */
export const EN_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

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
