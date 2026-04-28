/**
 * Public site constants — safe to import from server or client. Used by
 * sitemap, robots, OG metadata, the root layout, emails, and PDFs.
 *
 * Brand identity is split into PRIMARY + ACCENT so the visual two-tone
 * treatment (`<BrandName />`) and any plain-text rendering (page titles,
 * email subjects, PDF metadata) all derive from the same source. Renaming
 * the brand is a single-file change here.
 */

export const SITE_URL = (
  process.env.APP_URL ?? "https://immoplatform.be"
).replace(/\/$/, "");

// ─── Brand ─────────────────────────────────────────────────────────────
// The two-tone wordmark in the logo: `immo` (ink) + `platform` (accent).
// Always lowercase. `BRAND_NAME` is the joined plain-text version used in
// places that can't render colored spans (page titles, email subjects,
// alt text, PDF metadata, JSON manifest).
export const BRAND_PRIMARY = "immo";
export const BRAND_ACCENT = "platform";
export const BRAND_NAME = `${BRAND_PRIMARY}${BRAND_ACCENT}`;

// Legal entity — used in copyright lines, ToS/Privacy preambles, and
// contracts. Distinct from BRAND_NAME because the registered company name
// often differs from the consumer-facing brand.
export const BRAND_LEGAL = "Immoplatform BV";

// Back-compat alias for older imports — points at the same value.
export const SITE_NAME = BRAND_NAME;

export const SITE_TAGLINE = "One platform for every real-estate certificate";

export const SITE_DESCRIPTION =
  "Energy Performance Certificates, Asbestos Inventory Attests, Electrical Inspections and Fuel Tank Checks for Belgian real-estate agents. One dashboard, one invoice, one team of experts.";
