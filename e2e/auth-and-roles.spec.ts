import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers/auth";

// Covers role-gate + founder-flow work from:
//   cec7e4c feat(roles): v1 parity for realtor founder flow + freelancer scope + delivery toggle
//   4a05dc4 fix(admin): restrict /dashboard/admin/* to admin role only
//
// `requireRoleOrRedirect(["admin"], "admin")` redirects non-admins to
// `/no-access?section=admin`; the no-access page renders "Admin tools are
// restricted." See src/lib/auth.ts + src/app/no-access/page.tsx.
//
// `gateRealtorRequiresTeam` redirects a teamless realtor to
// `/dashboard/teams?needs_team=1`. See src/lib/permissions.ts.

test("admin gate blocks staff from /dashboard/admin", async ({ page }) => {
  await signIn(page, "staff");
  await page.goto("/dashboard/admin");

  // Should land on the no-access page, not /dashboard/admin.
  await expect(page).toHaveURL(/\/no-access\?section=admin/);
  await expect(page).not.toHaveURL(/\/dashboard\/admin(\?|$)/);
  await expect(
    page.getByRole("heading", { name: /Admin tools are restricted/i }),
  ).toBeVisible();
});

test("admin can access /dashboard/admin", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/dashboard/admin");

  await expect(page).toHaveURL(/\/dashboard\/admin(\?|$|\/)/);
  // Topbar title (h1) + section heading (h2) both render on the admin hub.
  await expect(page.getByRole("heading", { level: 1, name: "Admin" })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Control panel" }),
  ).toBeVisible();
});

test("founder flow — realtor without team is gated", async ({ page }) => {
  await signIn(page, "founder");
  await page.goto("/dashboard/assignments");

  // Soft-redirected to teams index with the gate flag.
  await expect(page).toHaveURL(/\/dashboard\/teams\?needs_team=1/);

  // The fromGate copy is the leading sentence of the founder banner.
  await expect(
    page.getByText("You need a team before you can use that section."),
  ).toBeVisible();
  // Realtor with zero owned teams qualifies for canCreateFirstTeam, so the
  // CTA in the banner is "Create your office".
  await expect(
    page.getByRole("link", { name: /Create your office/i }),
  ).toBeVisible();
});

test("founder can create their first team", async ({ page }) => {
  await signIn(page, "founder");
  await page.goto("/dashboard/teams");

  // Without the ?needs_team=1 flag the banner copy is the agency-not-set-up
  // variant, but the CTA text + href is the same.
  const cta = page.getByRole("link", { name: /Create your office/i });
  await expect(cta).toBeVisible();
  await cta.click();

  await expect(page).toHaveURL(/\/dashboard\/teams\/new$/);
  // Topbar title on the new-team page.
  await expect(
    page.getByRole("heading", { level: 1, name: "Create team" }),
  ).toBeVisible();
});

test("freelancer scope — Tim sees only assigned work", async ({ page }) => {
  await signIn(page, "freelancer");
  await page.goto("/dashboard/assignments");

  // Page renders without redirect.
  await expect(page).toHaveURL(/\/dashboard\/assignments(\?|$)/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Assignments" }),
  ).toBeVisible();
  // Freelancer cannot create assignments — `New` button is hidden
  // (see src/app/dashboard/assignments/page.tsx line 284).
  await expect(page.getByRole("link", { name: /^New$/ })).toHaveCount(0);
  // Seeded in-progress assignment from scripts/seed-e2e-fixtures.ts uses an
  // `E2E-TOGGLE-XXXXXX` reference. At least one row should reference it.
  await expect(page.getByText(/E2E-TOGGLE-/).first()).toBeVisible();

  // /dashboard/admin is unreachable for freelancers — same gate as staff.
  await page.goto("/dashboard/admin");
  await expect(page).toHaveURL(/\/no-access\?section=admin/);
  await expect(
    page.getByRole("heading", { name: /Admin tools are restricted/i }),
  ).toBeVisible();
});

test("role-gated UI — staff cannot create a team", async ({ page }) => {
  await signIn(page, "staff");
  await page.goto("/dashboard/teams");

  await expect(page).toHaveURL(/\/dashboard\/teams(\?|$)/);
  await expect(page.getByRole("heading", { level: 1, name: "Teams" })).toBeVisible();

  // canCreateTeam is admin-only (src/lib/permissions.ts:309). Neither the
  // top-of-page "Create team" CTA nor the founder banner's "Create your
  // office" CTA should be visible to staff. The empty-state "Create first
  // team" button likewise should not appear for staff.
  await expect(
    page.getByRole("link", { name: /^Create team$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Create your office/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Create first team/i }),
  ).toHaveCount(0);
});
