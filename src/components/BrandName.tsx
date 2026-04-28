import { BRAND_PRIMARY, BRAND_ACCENT } from "@/lib/site";

/**
 * The two-tone wordmark, inline. Use anywhere the brand name appears in
 * visible JSX prose so a rebrand stays a single-file change in `lib/site.ts`.
 *
 * For plain-text contexts (HTML page titles, email subjects, alt text, PDF
 * metadata, JSON manifest) import the `BRAND_NAME` constant from `lib/site`
 * directly instead — those pipelines can't render colored spans.
 *
 * Visual: `immo` in ink, `platform` in accent (amber). Both lowercase, bold,
 * with tight tracking — matches the logo wordmark. Inherits font-size from
 * its parent so it composes inside any heading or paragraph; pass a
 * `className` to override (e.g. `text-2xl` in a hero).
 */
export function BrandName({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-bold lowercase tracking-tight ${className}`}
      // The brand mark must read identically against any background, so we
      // bind to the theme's ink + accent tokens rather than hardcoding hex.
      // In dark mode `--color-ink` flips to a pale color and `--color-accent`
      // brightens — both still legible against dark surfaces. The colors
      // were picked to mirror the logo PNG (#0f172a + #f59e0b in light mode).
    >
      <span style={{ color: "var(--color-ink)" }}>{BRAND_PRIMARY}</span>
      <span style={{ color: "var(--color-accent)" }}>{BRAND_ACCENT}</span>
    </span>
  );
}
