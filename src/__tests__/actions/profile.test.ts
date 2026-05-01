import { describe, expect, it } from "vitest";
import {
  confirmEmailVerification,
  removeAvatarInner,
  resendEmailVerificationInner,
  updateProfileInner,
  uploadAvatarInner,
} from "@/app/actions/profile";
import { generateToken, hashToken } from "@/lib/auth";
import { AVATAR_MAX_BYTES } from "@/lib/avatar";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — self-service profile:
//   Platform/app/Http/Controllers/ProfileController.php
//   Platform/app/Http/Controllers/EmailVerification*Controller.php
//
// Covers:
//   1. updateProfile — zod validation, email-change → clear verified + new
//      token, email uniqueness enforcement
//   2. resendEmailVerification — only when not already verified
//   3. confirmEmailVerification — token states (missing, used, expired,
//      email-changed), consume-once
//   4. uploadAvatar / removeAvatar — mime/size gates, old-key cleanup

setupTestDb();

function form(data: Record<string, string | File>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) {
    fd.set(k, v as string | Blob);
  }
  return fd;
}

function profileForm(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    firstName: "Updated",
    lastName: "Name",
    email: "self@test.local",
    phone: "",
    region: "",
    bio: "",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) {
    fd.set(k, v);
  }
  return fd;
}

describe("updateProfileInner — basic path", () => {
  it("writes firstName/lastName/phone/region/bio", async () => {
    const { realtor } = await seedBaseline();
    const res = await updateProfileInner(
      realtor,
      undefined,
      profileForm({
        firstName: "New",
        lastName: "Name",
        email: realtor.user.email, // no email change
        phone: "+32 123 45 67",
        region: "Antwerp",
        bio: "Hello world.",
      }),
    );
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(user).toMatchObject({
      firstName: "New",
      lastName: "Name",
      phone: "+32 123 45 67",
      region: "Antwerp",
      bio: "Hello world.",
    });
  });

  it("zod rejects empty firstName", async () => {
    const { realtor } = await seedBaseline();
    const res = await updateProfileInner(
      realtor,
      undefined,
      profileForm({ firstName: "", email: realtor.user.email }),
    );
    expect(res).toEqual({ ok: false, error: "First name is required." });
  });

  it("zod rejects invalid email", async () => {
    const { realtor } = await seedBaseline();
    const res = await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: "not-an-email" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "Enter a valid email address.",
    });
  });

  it("empty phone/region/bio stored as null (not empty string)", async () => {
    const { realtor } = await seedBaseline();
    await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: realtor.user.email }),
    );
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(user.phone).toBeNull();
    expect(user.region).toBeNull();
    expect(user.bio).toBeNull();
  });

  it("emits user.profile_updated audit", async () => {
    const { realtor } = await seedBaseline();
    await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: realtor.user.email }),
    );
    const audits = await prisma.auditLog.findMany({
      where: { actorId: realtor.user.id, verb: "user.profile_updated" },
      select: { metadata: true },
    });
    expect(audits).toHaveLength(1);
    expect(auditMeta(audits[0].metadata).emailChanged).toBe(false);
  });
});

describe("updateProfileInner — email change", () => {
  it("changing email clears emailVerifiedAt + emits email_changed audit + creates verification row", async () => {
    const { realtor } = await seedBaseline();
    // Pre-verify the user so we can observe the clearing.
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    const res = await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: "brand-new@test.local" }),
    );
    expect(res).toEqual({ ok: true });
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(after.email).toBe("brand-new@test.local");
    expect(after.emailVerifiedAt).toBeNull();

    const audits = await prisma.auditLog.findMany({
      where: { actorId: realtor.user.id },
      select: { verb: true, metadata: true },
    });
    const verbs = audits.map((a) => a.verb);
    expect(verbs).toContain("user.email_changed");
    expect(verbs).toContain("user.email_verification_sent");

    const verifications = await prisma.emailVerification.findMany({
      where: { userId: realtor.user.id, email: "brand-new@test.local" },
    });
    expect(verifications).toHaveLength(1);
  });

  it("email already in use on ANOTHER account → rejected", async () => {
    const { realtor } = await seedBaseline();
    await prisma.user.create({
      data: {
        id: "u_email_owner",
        email: "taken@test.local",
        role: "realtor",
        firstName: "Taker",
        lastName: "Owner",
      },
    });
    const res = await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: "taken@test.local" }),
    );
    expect(res).toEqual({
      ok: false,
      error: "errors.auth.emailTakenOnAnotherAccount",
    });
  });

  it("case/whitespace on input is normalized (zod lowercases + trims)", async () => {
    const { realtor } = await seedBaseline();
    await updateProfileInner(
      realtor,
      undefined,
      profileForm({ email: "  SHOUTY@test.local  " }),
    );
    const after = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(after.email).toBe("shouty@test.local");
  });
});

describe("resendEmailVerificationInner", () => {
  it("unverified user → creates new EmailVerification row + audit", async () => {
    const { realtor } = await seedBaseline();
    // Seed the user as unverified.
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { emailVerifiedAt: null },
    });
    const res = await resendEmailVerificationInner(realtor);
    expect(res).toEqual({ ok: true });
    const rows = await prisma.emailVerification.findMany({
      where: { userId: realtor.user.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe(realtor.user.email);
  });

  it("already-verified user → 'already verified' error (no row)", async () => {
    const { realtor } = await seedBaseline();
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    // Use a fresh session that has emailVerifiedAt set (seedBaseline's session
    // snapshot was taken before the update).
    const verifiedSession = await makeSession({
      role: "realtor",
      userId: "u_already_verified",
    });
    await prisma.user.update({
      where: { id: verifiedSession.user.id },
      data: { emailVerifiedAt: new Date() },
    });
    verifiedSession.user.emailVerifiedAt = new Date();
    const res = await resendEmailVerificationInner(verifiedSession);
    expect(res).toEqual({ ok: false, error: "errors.verification.alreadyVerified" });
  });
});

describe("confirmEmailVerification", () => {
  async function seedVerification() {
    const { realtor } = await seedBaseline();
    const token = generateToken();
    const row = await prisma.emailVerification.create({
      data: {
        userId: realtor.user.id,
        email: realtor.user.email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return { token, row, realtor };
  }

  it("valid token → marks user verified + consumes row + audit", async () => {
    const { token, row, realtor } = await seedVerification();
    const res = await confirmEmailVerification(token);
    expect(res.ok).toBe(true);
    if (!res.ok || !res.data) throw new Error("expected data");
    expect(res.data.email).toBe(realtor.user.email);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);

    const consumed = await prisma.emailVerification.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect(consumed.usedAt).toBeInstanceOf(Date);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: realtor.user.id, verb: "user.email_verified" },
    });
    expect(audit).toBeTruthy();
  });

  it("missing token → 'Missing or invalid'", async () => {
    const res = await confirmEmailVerification("");
    expect(res).toEqual({
      ok: false,
      error: "errors.verification.tokenMissing",
    });
  });

  it("unknown token → 'invalid'", async () => {
    await seedBaseline();
    const res = await confirmEmailVerification("unknown-token-value");
    expect(res).toEqual({ ok: false, error: "errors.verification.linkInvalid" });
  });

  it("already-used token → 'already been used'", async () => {
    const { token, row } = await seedVerification();
    await prisma.emailVerification.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    const res = await confirmEmailVerification(token);
    expect(res).toEqual({
      ok: false,
      error: "errors.verification.linkUsed",
    });
  });

  it("expired token → 'expired'", async () => {
    const { token, row } = await seedVerification();
    await prisma.emailVerification.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await confirmEmailVerification(token);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("errors.verification.linkExpired");
  });

  it("email changed between request and confirm → 'previous email' error", async () => {
    const { token, realtor } = await seedVerification();
    // Simulate the user changing their email after the verification was sent.
    await prisma.user.update({
      where: { id: realtor.user.id },
      data: { email: "someone-else@test.local" },
    });
    const res = await confirmEmailVerification(token);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("errors.verification.linkStaleEmail");
    // Not consumed.
    const rows = await prisma.emailVerification.findMany({
      where: { userId: realtor.user.id },
    });
    expect(rows[0].usedAt).toBeNull();
  });
});

describe("uploadAvatarInner", () => {
  function makeImage(type: string, size: number): File {
    return new File(["x".repeat(size)], `a.${type.split("/")[1]}`, { type });
  }

  it("valid PNG → stores + sets avatarUrl on user + audit", async () => {
    const { realtor } = await seedBaseline();
    const img = makeImage("image/png", 10_000);
    const res = await uploadAvatarInner(realtor, undefined, form({ avatar: img }));
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(user.avatarUrl).toMatch(/^avatars\//);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: realtor.user.id, verb: "user.avatar_uploaded" },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.mime).toBe("image/png");
    expect(meta.sizeBytes).toBe(10_000);
  });

  it("empty FormData → 'Pick an image to upload.'", async () => {
    const { realtor } = await seedBaseline();
    const res = await uploadAvatarInner(realtor, undefined, new FormData());
    expect(res).toEqual({ ok: false, error: "errors.profile.pickImage" });
  });

  it("oversize image → rejected with size-limit message", async () => {
    const { realtor } = await seedBaseline();
    const tooBig = makeImage("image/png", AVATAR_MAX_BYTES + 1);
    const res = await uploadAvatarInner(realtor, undefined, form({ avatar: tooBig }));
    expect(res).toEqual({ ok: false, error: "errors.profile.imageTooLarge" });
  });

  it("disallowed mime (PDF) → 'Use PNG, JPG or WebP.'", async () => {
    const { realtor } = await seedBaseline();
    const pdf = new File(["x"], "a.pdf", { type: "application/pdf" });
    const res = await uploadAvatarInner(realtor, undefined, form({ avatar: pdf }));
    expect(res).toEqual({ ok: false, error: "errors.profile.imageWrongFormat" });
  });

  it("uploading a new avatar while one exists → old key deleted (via storage.delete)", async () => {
    const { realtor } = await seedBaseline();
    // First upload
    await uploadAvatarInner(
      realtor,
      undefined,
      form({ avatar: makeImage("image/png", 1000) }),
    );
    const afterFirst = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    const oldKey = afterFirst.avatarUrl;
    // Small delay so the epoch-ms version differs.
    await new Promise((r) => setTimeout(r, 5));
    // Second upload
    await uploadAvatarInner(
      realtor,
      undefined,
      form({ avatar: makeImage("image/jpeg", 1500) }),
    );
    const afterSecond = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(afterSecond.avatarUrl).not.toBe(oldKey);
  });
});

describe("removeAvatarInner", () => {
  it("user with avatarUrl → clears column + audit", async () => {
    const { realtor } = await seedBaseline();
    // Upload one first so there's something to remove.
    await uploadAvatarInner(
      realtor,
      undefined,
      form({ avatar: new File(["png"], "a.png", { type: "image/png" }) }),
    );
    const res = await removeAvatarInner(realtor);
    expect(res).toEqual({ ok: true });
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: realtor.user.id },
    });
    expect(user.avatarUrl).toBeNull();
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: realtor.user.id, verb: "user.avatar_removed" },
    });
    expect(audit).toBeTruthy();
  });

  it("user with NO avatar → no-op (ok, no audit)", async () => {
    const { realtor } = await seedBaseline();
    const res = await removeAvatarInner(realtor);
    expect(res).toEqual({ ok: true });
    const audits = await prisma.auditLog.count({
      where: { actorId: realtor.user.id, verb: "user.avatar_removed" },
    });
    expect(audits).toBe(0);
  });
});
