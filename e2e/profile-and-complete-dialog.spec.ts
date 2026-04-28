import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./_helpers/auth";

/**
 * Covers two recent UX changes:
 *
 * 1. `bc3698f feat(profile): auto-upload avatar on file pick`
 *    Picking a file in /dashboard/settings auto-submits the upload form —
 *    no separate "Upload" button. Implementation in
 *    `src/app/dashboard/settings/ProfileForm.tsx` (`onChange` →
 *    `requestSubmit()`).
 *
 * 2. `006f44e refactor(assignments): inline complete dialog (drop /complete page)`
 *    "Mark completed" opens an inline `<Modal overlay>` (CompleteForm) instead
 *    of navigating to `/dashboard/assignments/[id]/complete`. The page route
 *    file is gone, so any direct hit lands on the dashboard 404.
 */

// 1×1 transparent PNG (valid bytes), used for the avatar upload test.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Avatar auto-upload on file pick", () => {
  test("picking an avatar file auto-submits the form", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard/settings");

    const fileInput = page.locator('input[type="file"][name="avatar"]');
    await expect(fileInput).toBeVisible();

    // Snapshot the current avatar src (if any) so we can detect a change.
    const photoCard = page
      .locator("section, div")
      .filter({ has: page.locator('input[type="file"][name="avatar"]') })
      .first();
    const avatarImg = photoCard.locator("img").first();
    const initialSrc = (await avatarImg.count()) > 0
      ? await avatarImg.getAttribute("src")
      : null;

    // Set the file — onChange should call requestSubmit() on the form.
    // We do NOT click any "Upload" button; the test fails if it relies on one.
    await fileInput.setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: TINY_PNG,
    });

    // Either the success banner appears, or the avatar src changes — either
    // is proof the auto-submit fired and the action ran end-to-end.
    const successBanner = page.getByText(/photo updated\./i);
    const srcChanged = page.locator(
      `img:not([src="${initialSrc ?? "__none__"}"])`,
    );
    await expect
      .poll(
        async () => {
          if (await successBanner.isVisible().catch(() => false)) return "banner";
          if ((await avatarImg.count()) > 0) {
            const cur = await avatarImg.getAttribute("src");
            if (cur && cur !== initialSrc) return "src";
          }
          return null;
        },
        { timeout: 15_000, message: "expected upload to complete after file pick" },
      )
      .not.toBeNull();
  });

  test("there is no separate Upload button to click", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard/settings");

    const photoCard = page
      .locator("section, div")
      .filter({ has: page.locator('input[type="file"][name="avatar"]') })
      .first();

    // The auto-submit replaced the explicit upload button. A "Remove" button
    // can still be present (only when an avatar already exists) — that's fine.
    const uploadBtn = photoCard.getByRole("button", { name: /^upload$/i });
    await expect(uploadBtn).toHaveCount(0);
  });
});

test.describe("Inline complete dialog", () => {
  /**
   * Walk to a "delivered" assignment so that "Mark completed" is visible.
   * Tim's E2E-TOGGLE assignment seeds in `in_progress`; admin can advance it.
   * Returns the URL of the detail page so individual tests can assert no nav.
   */
  async function openDeliveredAssignment(page: Page): Promise<string> {
    await page.goto("/dashboard/assignments");

    // Filter to Tim's seeded fixture (reference starts E2E-TOGGLE-).
    // The row link points at /edit for admins, so we extract the assignment id
    // from the href and navigate to the detail page directly — that's where
    // the action buttons (Start, Mark delivered, Mark completed) live.
    const referenceLink = page
      .locator('a[href^="/dashboard/assignments/"]')
      .filter({ hasText: /E2E-TOGGLE-/ })
      .first();
    await expect(referenceLink).toBeVisible({ timeout: 10_000 });
    const href = await referenceLink.getAttribute("href");
    const id = href?.match(/\/dashboard\/assignments\/([^/?#]+)/)?.[1];
    if (!id) throw new Error(`Could not extract assignment id from ${href}`);
    await page.goto(`/dashboard/assignments/${id}`);
    await page.waitForURL(new RegExp(`/dashboard/assignments/${id}$`));

    // Wait for the action panel to render — `goto` only waits for `load`,
    // and the assignment detail page fetches via Suspense. Without waiting,
    // the isVisible() probes below fire on an empty DOM and skip the clicks,
    // leaving the status unchanged.
    await page.getByRole("heading", { name: /E2E-TOGGLE-/i }).waitFor();

    // If still scheduled/in_progress, click through to "delivered" so the
    // "Mark completed" button surfaces (canComplete && status === "delivered").
    const startBtn = page.getByRole("button", { name: /start inspection/i });
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click();
      await expect(startBtn).toBeHidden();
    }
    const deliverBtn = page.getByRole("button", { name: /^mark delivered$/i });
    if (await deliverBtn.isVisible().catch(() => false)) {
      await deliverBtn.click();
      // Wait for the post-action revalidation: "Mark completed" is the new
      // affordance once the server action lands and status moves to delivered.
      await expect(
        page.getByRole("button", { name: /mark completed/i }),
      ).toBeVisible();
    }

    return page.url();
  }

  test("Mark completed opens an inline dialog (no navigation)", async ({ page }) => {
    await signIn(page, "admin");
    const detailUrl = await openDeliveredAssignment(page);

    const completeBtn = page.getByRole("button", { name: /mark completed/i });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // URL must not change — the action is now an inline dialog.
    expect(page.url()).toBe(detailUrl);
    await expect(page).not.toHaveURL(/\/complete(\/|$)/);

    // Dialog appears with the CompleteForm fields.
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('input[name="finishedAt"]')).toBeVisible();
    await expect(dialog.locator('textarea[name="note"]')).toBeVisible();
  });

  test("/complete sub-route is gone (404)", async ({ page }) => {
    await signIn(page, "admin");

    // The route file was deleted; any id (existing or not) should fall back
    // to the dashboard's not-found page.
    await page.goto("/dashboard/assignments/nonexistent/complete");

    // `src/app/dashboard/not-found.tsx` renders the dashboard 404. The Topbar
    // is the H1 ("Page not found"); the EmptyState body uses a <p>, not a
    // heading, so we assert the topbar title.
    await expect(
      page.getByRole("heading", { level: 1, name: /page not found/i }),
    ).toBeVisible();
    await expect(page.getByText(/we couldn't find that page/i)).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard\/assignments\/[^/]+$/);
  });

  test("closing the complete dialog returns control without navigation", async ({
    page,
  }) => {
    await signIn(page, "admin");
    const detailUrl = await openDeliveredAssignment(page);

    await page.getByRole("button", { name: /mark completed/i }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Press Escape — Modal overlay listens on keydown and calls onClose.
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(page.url()).toBe(detailUrl);

    // Re-open and dismiss via the dialog's footer "Cancel" button — both
    // dismissal paths must leave URL untouched.
    await page.getByRole("button", { name: /mark completed/i }).click();
    const dialogAgain = page.getByRole("dialog");
    await expect(dialogAgain).toBeVisible();
    await dialogAgain.getByRole("button", { name: /^cancel$/i }).click();
    await expect(dialogAgain).toBeHidden();
    expect(page.url()).toBe(detailUrl);
  });
});
