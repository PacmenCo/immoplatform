/**
 * Security headers applied when this server streams user-uploaded image bytes
 * (avatars, team logos, signatures). Belt-and-braces: the upload allowlists
 * are raster-only (no SVG) so direct-URL XSS via embedded scripts isn't
 * reachable, but the strict CSP + nosniff still defends against MIME-sniff
 * fallback attacks on raster bytes.
 *
 * NOTE: On S3 / DO Spaces, the browser fetches bytes directly from the bucket
 * via a presigned redirect — these headers don't apply there. The raster-only
 * allowlist is the primary defense in that path.
 */
export const IMAGE_SAFETY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  "X-Content-Type-Options": "nosniff",
} as const;
