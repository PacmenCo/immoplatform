import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers/auth";

/**
 * Covers the sidebar redesign in commit bba906a:
 * - Settings removed from main nav (only reachable via profile popup).
 * - Bottom user-row chevron toggles a popup with Settings + Sign out.
 * - Popup closes on outside click, Escape, and route change.
 * - Sections collapse based on role (`visibleFor` filtering).
 *
 * Selectors are derived from `src/components/dashboard/Sidebar.tsx`:
 * - The sidebar root is an `<aside>` element.
 * - The toggle is `<button aria-haspopup="menu" aria-expanded={menuOpen}>`.
 * - The popup is `<div role="menu">` containing a Settings link + Sign out button.
 */

const sidebar = (page: import("@playwright/test").Page) => page.locator("aside");
const profileToggle = (page: import("@playwright/test").Page) =>
  sidebar(page).locator('button[aria-haspopup="menu"]');
const popup = (page: import("@playwright/test").Page) =>
  sidebar(page).locator('[role="menu"]');

test.describe("Sidebar — main nav", () => {
  test("Settings is no longer in the main nav", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");

    const nav = sidebar(page).locator("nav");
    await expect(nav).toBeVisible();

    // Collect all visible link texts inside the main <nav>.
    const links = nav.getByRole("link");
    const count = await links.count();
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await links.nth(i).innerText()).trim();
      if (text) labels.push(text);
    }

    expect(labels).not.toContain("Settings");
    expect(labels.some((l) => /^settings$/i.test(l))).toBe(false);

    // Sanity: the main nav still has at least Assignments visible.
    expect(labels.some((l) => /assignments/i.test(l))).toBe(true);
  });
});

test.describe("Sidebar — profile popup", () => {
  test("profile popup opens via the user-row chevron", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");

    const toggle = profileToggle(page);
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    await toggle.click();

    const menu = popup(page);
    await expect(menu).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");

    await expect(menu.getByRole("menuitem", { name: /settings/i })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: /sign out/i })).toBeVisible();
  });

  test("profile popup closes on outside click", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");

    await profileToggle(page).click();
    await expect(popup(page)).toBeVisible();

    // Click somewhere clearly outside the sidebar — the main content area.
    // Use a body-level click far from the aside; Sidebar listens on
    // window pointerdown and closes when the target is outside menuRef.
    await page.locator("body").click({ position: { x: 800, y: 400 } });

    await expect(popup(page)).toHaveCount(0);
    await expect(profileToggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("profile popup closes on Escape", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");

    await profileToggle(page).click();
    await expect(popup(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(popup(page)).toHaveCount(0);
    await expect(profileToggle(page)).toHaveAttribute("aria-expanded", "false");
  });

  test("profile popup auto-closes on route change", async ({ page }) => {
    await signIn(page, "admin");
    await page.goto("/dashboard");

    await profileToggle(page).click();
    const menu = popup(page);
    await expect(menu).toBeVisible();

    await menu.getByRole("menuitem", { name: /settings/i }).click();

    await page.waitForURL(/\/dashboard\/settings(\/|$)/);
    await expect(page).toHaveURL(/\/dashboard\/settings(\/|$)/);

    // Sidebar's pathname-effect should have closed the popup.
    await expect(popup(page)).toHaveCount(0);
    await expect(profileToggle(page)).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("Sidebar — role-based section collapsing", () => {
  test("freelancer sees fewer sections than admin (no Teams / no Admin)", async ({
    browser,
  }) => {
    // Count admin's nav links as the upper bound, then compare to freelancer.
    // Use isolated contexts so cookies don't bleed across roles.
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await signIn(adminPage, "admin");
    await adminPage.goto("/dashboard");
    // Wait for the sidebar to actually render — `goto` only waits for `load`,
    // and the dashboard's `loading.tsx` placeholder paints first. Without
    // this, count() races and returns 0.
    await expect(
      sidebar(adminPage).locator("nav").getByRole("link").first(),
    ).toBeVisible();
    const adminLinks = sidebar(adminPage).locator("nav").getByRole("link");
    const adminCount = await adminLinks.count();
    await adminCtx.close();

    const tinyCtx = await browser.newContext();
    const timPage = await tinyCtx.newPage();
    await signIn(timPage, "freelancer");
    await timPage.goto("/dashboard");

    const timNav = sidebar(timPage).locator("nav");
    await expect(timNav.getByRole("link").first()).toBeVisible();
    const timLinks = timNav.getByRole("link");
    const timCount = await timLinks.count();

    expect(timCount).toBeLessThan(adminCount);

    // Freelancers don't get Users / Teams / Admin items.
    await expect(
      timNav.getByRole("link", { name: /^teams$/i }),
    ).toHaveCount(0);
    await expect(
      timNav.getByRole("link", { name: /^users$/i }),
    ).toHaveCount(0);
    await expect(
      timNav.locator('a[href="/dashboard/overview"]'),
    ).toHaveCount(0);
    await expect(
      timNav.locator('a[href="/dashboard/commissions"]'),
    ).toHaveCount(0);
    await expect(
      timNav.locator('a[href="/dashboard/announcements"]'),
    ).toHaveCount(0);

    // But Assignments must be visible.
    await expect(
      timNav.getByRole("link", { name: /assignments/i }),
    ).toBeVisible();

    await tinyCtx.close();
  });

  test("staff sees no Admin section", async ({ page }) => {
    await signIn(page, "staff");
    await page.goto("/dashboard");

    const nav = sidebar(page).locator("nav");

    // Admin gate is admin-only after 4a05dc4 — staff must not see any of
    // the Admin-section items.
    await expect(nav.locator('a[href="/dashboard/admin"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/dashboard/overview"]')).toHaveCount(0);
    await expect(nav.locator('a[href="/dashboard/commissions"]')).toHaveCount(0);
    await expect(
      nav.locator('a[href="/dashboard/contact-messages"]'),
    ).toHaveCount(0);
    await expect(
      nav.locator('a[href="/dashboard/announcements"]'),
    ).toHaveCount(0);

    // The "Admin" section heading should not be present either.
    await expect(nav.getByText(/^admin$/i)).toHaveCount(0);

    // Staff still sees Assignments + Users + Teams.
    await expect(nav.getByRole("link", { name: /assignments/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^users$/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /^teams$/i })).toBeVisible();
  });
});
