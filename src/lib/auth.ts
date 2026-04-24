import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Prisma, Session, User } from "@prisma/client";
import { prisma } from "./db";

export { generateToken, hashToken } from "./auth-crypto";

const SESSION_COOKIE = "immo_session";
const SESSION_DAYS = 30;

// ─── password hashing ──────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  // bcrypt with cost 12 — OWASP-acceptable fallback until we move to argon2id.
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string | null,
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

// ─── sessions ──────────────────────────────────────────────────────

export async function createSession(opts: {
  userId: string;
  activeTeamId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<Session> {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      id,
      userId: opts.userId,
      activeTeamId: opts.activeTeamId ?? null,
      userAgent: opts.userAgent ?? null,
      ip: opts.ip ?? null,
      expiresAt,
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session;
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  jar.delete(SESSION_COOKIE);
  if (id) {
    await prisma.session
      .update({
        where: { id },
        data: { revokedAt: new Date() },
      })
      .catch(() => {
        // Session may have been deleted elsewhere; ignore.
      });
  }
}

/**
 * The User shape carried on a session — deliberately omits `passwordHash` so
 * it can't leak through server-to-client serialization (server action return
 * values, revalidate boundary) or into audit metadata by accident. Anything
 * that actually needs the hash (change-password, delete-account) should
 * query it from the DB at the point of use.
 */
export type SessionUser = Omit<User, "passwordHash">;
export type SessionWithUser = Session & { user: SessionUser };

// Cached via React.cache() so repeated calls within one Server-Component
// render reuse the cookie read + session lookup + lastSeenAt touch. Layout,
// Topbar, and page code each call getSession/requireSession independently;
// without this, each call hits the DB. Outside a React render (server
// actions, API routes) cache is a no-op — those paths only call once anyway.
export const getSession = cache(async (): Promise<SessionWithUser | null> => {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;
  if (session.user.deletedAt) return null;

  // Fire-and-forget touch — refreshes lastSeenAt without blocking the request.
  // revokedAt guard prevents resurrecting revoked sessions if another request
  // (logout, reset-password) revokes concurrently.
  prisma.session
    .updateMany({
      where: { id, revokedAt: null },
      data: { lastSeenAt: new Date() },
    })
    .catch(() => {});
  const { passwordHash: _ph, ...user } = session.user;
  void _ph;
  return { ...session, user };
});

export async function requireSession(): Promise<SessionWithUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}

/**
 * Fetch a user's password hash. `SessionWithUser` deliberately omits the hash
 * so it can't leak through server-action returns or audit metadata, so flows
 * that need to verify a password (change-password, delete-account) call this
 * at the point of use instead.
 */
export async function getUserPasswordHash(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return row?.passwordHash ?? null;
}

export async function requireRole(
  roles: Array<"admin" | "staff" | "realtor" | "freelancer">,
): Promise<SessionWithUser> {
  const s = await requireSession();
  if (!roles.includes(s.user.role as (typeof roles)[number])) {
    throw new Error("FORBIDDEN");
  }
  return s;
}

export function noAccessPath(section: string): string {
  return `/no-access?section=${section}`;
}

// Page-level gate: require the viewer's role to be in `roles`, otherwise
// redirect to /no-access. Prefer this over `requireRole` at the page layer
// (requireRole throws, which leaks to the error boundary).
export async function requireRoleOrRedirect(
  roles: Array<"admin" | "staff" | "realtor" | "freelancer">,
  section: string,
): Promise<SessionWithUser> {
  const s = await requireSession();
  if (!roles.includes(s.user.role as (typeof roles)[number])) {
    redirect(noAccessPath(section));
  }
  return s;
}

// ─── audit log ─────────────────────────────────────────────────────

/**
 * Typed verb enum — catches typos (e.g. "assignment.deliverd") at compile time.
 * Convention: `{object}.{action}`. Add new verbs here when wiring a new mutation.
 */
export type AuditVerb =
  | "auth.login_failed"
  | "user.signed_in"
  | "user.signed_out"
  | "user.created"
  | "user.password_changed"
  | "user.profile_updated"
  | "user.avatar_uploaded"
  | "user.avatar_removed"
  | "password_reset.requested"
  | "session.team_switched"
  | "invite.sent"
  | "invite.resent"
  | "invite.revoked"
  | "invite.accepted"
  | "team.created"
  | "team.updated"
  | "team.service_override_set"
  | "team.service_override_removed"
  | "assignment.commission_applied"
  | "commission.quarter_paid"
  | "commission.quarter_unpaid"
  | "team.member_added"
  | "team.ownership_transferred"
  | "assignment.created"
  | "assignment.updated"
  | "assignment.started"
  | "assignment.delivered"
  | "assignment.completed"
  | "assignment.cancelled"
  | "assignment.reassigned"
  | "assignment.file_uploaded"
  | "assignment.file_deleted"
  | "revenue_adjustment.created"
  | "revenue_adjustment.deleted"
  | "calendar.connected"
  | "calendar.disconnected"
  | "announcement.created"
  | "announcement.updated"
  | "announcement.deleted"
  | "announcement.dismissed"
  | "user.deleted"
  | "user.sessions_revoked"
  | "user.email_changed"
  | "user.email_verified"
  | "user.email_verification_sent"
  | "assignment.deleted"
  | "assignment.pdf_generated"
  | "team.deleted"
  | "team.member_removed"
  | "user.role_changed"
  | "invoice_reminder.sent"
  | "invoice_reminder.skipped";

export async function audit(opts: {
  actorId?: string | null;
  verb: AuditVerb;
  objectType?: string;
  objectId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: opts.actorId ?? null,
        verb: opts.verb,
        objectType: opts.objectType,
        objectId: opts.objectId,
        // Postgres JSONB column — pass the object directly. Prisma serializes.
        // `undefined` (omit column) is used instead of null so Prisma doesn't
        // require the explicit `Prisma.JsonNull` sentinel. Cast through
        // `InputJsonValue` — `Record<string, unknown>` isn't structurally
        // assignable but `unknown` inputs are the documented shape.
        metadata: (opts.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    // Audit failures should never break the primary flow
    console.warn("audit failed:", err);
  }
}
