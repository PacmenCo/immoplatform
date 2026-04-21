import "server-only";

/**
 * Centralized URL helpers. All callers go through `appBaseUrl()` so the
 * prod-APP_URL-missing guard fires uniformly — previously only the two
 * email-trigger sites had the guard, while invite/reset/storage readers
 * silently defaulted to localhost in production.
 */

export function appBaseUrl(): string {
  const raw = process.env.APP_URL;
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error(
      "APP_URL must be set in production — user-facing links would otherwise point at localhost.",
    );
  }
  return (raw ?? "http://localhost:3000").replace(/\/$/, "");
}

export function assignmentUrl(id: string): string {
  return `${appBaseUrl()}/dashboard/assignments/${id}`;
}

export function loginUrl(): string {
  return `${appBaseUrl()}/login`;
}

export function inviteAcceptUrl(token: string): string {
  return `${appBaseUrl()}/invites/${token}`;
}

export function passwordResetUrl(token: string): string {
  return `${appBaseUrl()}/reset-password?token=${token}`;
}
