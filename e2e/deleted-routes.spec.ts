import { test, expect, type Page } from "@playwright/test";
import { signIn } from "./_helpers/auth";

// Verifies that pages removed in the recent purge (commits bba906a, 006f44e,
// 91faa13, 4e249ff, ddcebe2, 6b55ce8, 94694f6, 06abd29, plus earlier removals
// of /dashboard/no-team and /dashboard/settings/billing) now render a clean
// 404 instead of crashing or silently routing somewhere unexpected.
//
// Two 404 shells exist:
//   - src/app/dashboard/not-found.tsx  → keeps signed-in chrome (sidebar)
//   - src/app/not-found.tsx            → marketing shell (Nav + Footer)
// We assert both render the right text from their respective files.

const DASHBOARD_404_HEADING = /page not found/i;
const DASHBOARD_404_BODY = "We couldn't find that page";
const MARKETING_404_HEADING = /this page went to the inspector and never came back/i;

async function assertDashboard404(page: Page) {
  await expect(
    page.getByRole("heading", { name: DASHBOARD_404_HEADING }),
  ).toBeVisible();
  await expect(page.getByText(DASHBOARD_404_BODY)).toBeVisible();
  // Sidebar (an <aside>) stays mounted because dashboard/not-found.tsx is
  // wrapped by dashboard/layout.tsx — that's the whole point of the file.
  await expect(page.getByRole("complementary").first()).toBeVisible();
}

test.describe("deleted dashboard routes return the dashboard 404", () => {
  const routes: readonly string[] = [
    "/dashboard/search",
    "/dashboard/notifications",
    "/dashboard/help",
    "/dashboard/admin/exports",
    "/dashboard/admin/invoice-reminders",
    "/dashboard/settings/api",
    "/dashboard/settings/security/2fa",
    "/dashboard/settings/branding",
    "/dashboard/settings/team",
    "/dashboard/settings/billing",
    "/dashboard/settings/integrations/odoo",
    "/dashboard/no-team",
  ];

  test.beforeEach(async ({ page }) => {
    await signIn(page, "admin");
  });

  for (const path of routes) {
    test(`404s on ${path}`, async ({ page }) => {
      await page.goto(path);
      await assertDashboard404(page);
    });
  }
});

test.describe("deleted marketing routes return the marketing 404", () => {
  // No signIn — these are public routes that should 404 for anyone.
  test("404s on /pricing", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: MARKETING_404_HEADING }),
    ).toBeVisible();
    // Marketing 404 should NOT render the dashboard sidebar.
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });

  test("404s on /demo", async ({ page }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: MARKETING_404_HEADING }),
    ).toBeVisible();
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });
});

test("topbar cmd-K palette is gone", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);

  // The TopbarSearch input was deleted in bba906a — there should be no
  // "Jump to a page…" placeholder and no element labelled "Search" in the
  // topbar chrome.
  await expect(page.getByPlaceholder(/jump to a page/i)).toHaveCount(0);
  await expect(page.locator('[aria-label="Search"]')).toHaveCount(0);

  // Cmd+K should no longer pop a modal/overlay. Trigger it and make sure
  // nothing dialog-shaped appears.
  await page.keyboard.press("Meta+K");
  // Give any phantom listener a tick to render.
  await page.waitForTimeout(200);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByPlaceholder(/jump to a page/i)).toHaveCount(0);
});

test("assignment /complete page route is gone", async ({ page }) => {
  await signIn(page, "admin");

  // The route file was deleted (006f44e), so any id — real or not — under
  // /complete must hit the dashboard 404. Using a clearly-bogus id avoids
  // depending on seed data.
  await page.goto("/dashboard/assignments/nonexistent-id/complete");
  await assertDashboard404(page);
});
