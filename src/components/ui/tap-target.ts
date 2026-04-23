/**
 * Shared class string for inline anchor tap-target polish.
 *
 * Gives a link a 44px minimum height on viewports below `lg` so thumb-tap
 * targets meet the WCAG AAA guideline, then collapses to compact (zero
 * min-height + 4px vertical padding) at `lg+` where mouse users would
 * rather have tighter lists (footer columns, TOC sidebars).
 *
 * Callers layer text-size / hover tweaks on top via a template literal:
 *
 *   <a className={`${TAP_TARGET_LINK} text-sm transition-colors`}>
 */
export const TAP_TARGET_LINK =
  "-mx-2 inline-flex min-h-11 items-center rounded px-2 text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] lg:min-h-0 lg:py-1";
