import "server-only";

/**
 * Calendar provider configuration checks. Three independent paths:
 *
 * 1. **Agency Google** — admin-wide service account that writes to a single
 *    shared calendar (Platform's `google_calendar_event_id` flow).
 * 2. **Personal Google** — per-user OAuth for the "Add to my calendar"
 *    button. Separate Google Cloud credential from the service account.
 * 3. **Outlook** — per-user OAuth delegated to each realtor's mailbox.
 *
 * Each check is independent so a partial deployment (e.g. only agency
 * Google configured) still boots and the UI renders "Not configured"
 * cleanly where needed.
 */

export function isGoogleAgencyConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY &&
    process.env.GOOGLE_AGENCY_CALENDAR_ID
  );
}

export function isGooglePersonalConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function isOutlookConfigured(): boolean {
  return !!(process.env.OUTLOOK_OAUTH_CLIENT_ID && process.env.OUTLOOK_OAUTH_CLIENT_SECRET);
}

export function requireAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is not set — calendar OAuth redirect URIs cannot be built.",
    );
  }
  return url.replace(/\/$/, "");
}

export function requireEncryptionKey(): Buffer {
  const raw = process.env.CALENDAR_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'CALENDAR_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32`.',
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `CALENDAR_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length}).`,
    );
  }
  return buf;
}
