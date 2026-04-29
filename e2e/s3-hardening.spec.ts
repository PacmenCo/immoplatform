import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { signIn } from "./_helpers/auth";

/**
 * End-to-end coverage for the S3-hygiene work landed under todo
 * `S3 hardening: reaper cron + cleanup on user/team delete`.
 *
 * Manual verification angle: drives the actual UI, then asserts that the
 * underlying storage bytes — written through the LocalStorage backend in
 * dev — actually disappear when the row is deleted. The vitest tier already
 * covers the same logic at the action level; this layer catches a UI wiring
 * regression that vitest can't see (e.g. a confirm-dialog click that fails
 * to invoke the action).
 *
 * Prerequisites for a clean run:
 *   - Dev server is up at $E2E_BASE_URL (default http://localhost:3000).
 *   - STORAGE_PROVIDER=local + STORAGE_LOCAL_ROOT=./storage in the dev env.
 *   - Admin seeded by `prisma db seed` (jordan@asbestexperts.be).
 *   - For the cron-route assertion, optionally export CRON_SECRET in the
 *     server's env to exercise the full path; otherwise the unconfigured
 *     branch is asserted.
 */

const STORAGE_ROOT = process.env.STORAGE_LOCAL_ROOT ?? "./storage";
const CRON_SECRET = process.env.CRON_SECRET ?? "";
const prisma = new PrismaClient();

// Tests share fixture state through the database — keep them serial so a
// teardown from test A can't race a test B that's still using the row.
test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await prisma.$disconnect();
});

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function stage(absPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, content);
}

test.describe("S3 hardening", () => {
  test("cron route: rejects unauthenticated requests", async ({ request }) => {
    const res = await request.get("/api/cron/reap-deleted-files");
    // 401 when CRON_SECRET is configured but the request lacks it; 500
    // when CRON_SECRET isn't set on the server. Both prove the route
    // can't be hit without proper setup.
    expect([401, 500]).toContain(res.status());
  });

  test("cron route: dry-run with a valid Bearer returns ok:true", async ({
    request,
  }) => {
    test.skip(!CRON_SECRET, "CRON_SECRET not exported to the playwright env");
    const res = await request.get("/api/cron/reap-deleted-files?dry=1", {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      dryRun: true,
    });
    expect(typeof body.olderThanDays).toBe("number");
    expect(Array.isArray(body.ids ?? [])).toBe(true);
  });

  test("admin-delete user via UI removes the avatar bytes from storage", async ({
    page,
  }) => {
    const userId = "u_e2e_avatar_victim";
    const avatarKey = `avatars/${userId}/v0.png`;
    const absPath = path.resolve(STORAGE_ROOT, avatarKey);

    // Stage a real avatar file + the row that points at it.
    await stage(absPath, "fake-png-bytes-for-e2e");
    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: `${userId}@e2e.local`,
        firstName: "AvatarVictim",
        lastName: "E2E",
        role: "freelancer",
        avatarUrl: avatarKey,
        emailVerifiedAt: new Date(),
      },
      update: {
        avatarUrl: avatarKey,
        deletedAt: null,
        firstName: "AvatarVictim",
        lastName: "E2E",
      },
    });

    expect(await exists(absPath)).toBe(true);

    await signIn(page, "admin");
    await page.goto(`/dashboard/users/${userId}`);
    // The name appears in both the topbar and the hero h1 — first() is fine,
    // we're only confirming the page rendered.
    await expect(
      page.getByRole("heading", { name: /AvatarVictim E2E/ }).first(),
    ).toBeVisible();

    // Open the confirm dialog: button labeled "Delete" on the detail page.
    await page
      .getByRole("button", { name: /^Delete$/, exact: false })
      .first()
      .click();

    // The dialog confirm button is labeled "Delete user" — distinct from
    // the trigger so the locator can target it unambiguously.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Delete user/ }).click();

    // redirectTo="/dashboard/users" → land back on the list.
    await page.waitForURL(/\/dashboard\/users(\?|$)/, { timeout: 5_000 });

    // DB: row soft-deleted, avatarUrl nulled.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.deletedAt).toBeInstanceOf(Date);
    expect(after.avatarUrl).toBeNull();

    // Storage: bytes are gone.
    expect(await exists(absPath)).toBe(false);

    // Cleanup the seed row so a re-run doesn't accumulate ghosts.
    await prisma.user.delete({ where: { id: userId } });
  });

  test("admin-delete team via UI removes logo + signature bytes from storage", async ({
    page,
  }) => {
    const teamId = "t_e2e_branded";
    const logoKey = `teams/${teamId}/logo/v0.png`;
    const sigKey = `teams/${teamId}/signature/v0.png`;
    const logoPath = path.resolve(STORAGE_ROOT, logoKey);
    const sigPath = path.resolve(STORAGE_ROOT, sigKey);

    await stage(logoPath, "fake-logo-bytes");
    await stage(sigPath, "fake-signature-bytes");
    await prisma.team.upsert({
      where: { id: teamId },
      create: {
        id: teamId,
        name: "E2E Branded Office",
        logoUrl: logoKey,
        signatureUrl: sigKey,
      },
      update: {
        logoUrl: logoKey,
        signatureUrl: sigKey,
        name: "E2E Branded Office",
      },
    });

    expect(await exists(logoPath)).toBe(true);
    expect(await exists(sigPath)).toBe(true);

    await signIn(page, "admin");
    await page.goto(`/dashboard/teams/${teamId}`);
    await expect(
      page.getByRole("heading", { name: /E2E Branded Office/ }).first(),
    ).toBeVisible();

    // Trigger button has icon + "Delete team" text. Open the dialog.
    await page
      .getByRole("button", { name: /Delete team/ })
      .first()
      .click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    // Confirm inside the dialog. Same accessible name as the trigger,
    // scoped via the dialog locator.
    await dialog.getByRole("button", { name: /Delete team/ }).click();

    await page.waitForURL(/\/dashboard\/teams(\?|$)/, { timeout: 5_000 });

    const after = await prisma.team.findUnique({ where: { id: teamId } });
    expect(after).toBeNull();

    expect(await exists(logoPath)).toBe(false);
    expect(await exists(sigPath)).toBe(false);
  });
});
