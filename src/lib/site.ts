/**
 * Public site constants — safe to import from server or client. Used by
 * sitemap, robots, OG metadata, and the root layout. Centralized here so
 * a future rebrand updates one file instead of fanning out to many.
 */

export const SITE_URL = (
  process.env.APP_URL ?? "https://immoplatform.be"
).replace(/\/$/, "");

export const SITE_NAME = "Immo";

export const SITE_TAGLINE = "One platform for every real-estate certificate";

export const SITE_DESCRIPTION =
  "Energy Performance Certificates, Asbestos Inventory Attests, Electrical Inspections and Fuel Tank Checks for Belgian real-estate agents. One dashboard, one invoice, one team of experts.";
