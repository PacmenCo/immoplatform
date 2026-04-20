// Plain crypto helpers — importable from seed scripts and server actions alike.
// Kept separate from src/lib/auth.ts which uses "server-only" for Next imports.

import { randomBytes, createHash } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
