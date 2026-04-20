import "server-only";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { User, Session } from "@prisma/client";

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

export type SessionWithUser = Session & { user: User };

export async function getSession(): Promise<SessionWithUser | null> {
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
  return session;
}

export async function requireSession(): Promise<SessionWithUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
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

// ─── audit log ─────────────────────────────────────────────────────

export async function audit(opts: {
  actorId?: string | null;
  verb: string;
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
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
      },
    });
  } catch (err) {
    // Audit failures should never break the primary flow
    console.warn("audit failed:", err);
  }
}
