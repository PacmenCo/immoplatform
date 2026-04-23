/**
 * Security headers applied when this server streams user-uploaded image bytes
 * (avatars, team logos, signatures). SVG logos are rendered as full documents
 * when a URL is opened directly, so a strict CSP + sandbox blocks embedded
 * script execution and nosniff prevents MIME fallback. Harmless overhead on
 * PNG/JPG/WebP/GIF.
 *
 * NOTE: On S3 / DO Spaces, the browser fetches bytes directly from the bucket
 * via a presigned redirect — these headers don't apply there. Prod deploys
 * should either configure bucket-level response headers or remove SVG from
 * the MIME whitelist.
 */
export const IMAGE_SAFETY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
} as const;
