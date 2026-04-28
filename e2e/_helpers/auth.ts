import { type Page, expect } from "@playwright/test";

/**
 * Test users seeded by `prisma/seed.ts` + `scripts/seed-e2e-fixtures.ts`.
 * Every dummy user's password rotates to "Jordan1234" on each `prisma db seed`.
 */
export const USERS = {
  admin: { email: "jordan@asbestexperts.be", password: "Jordan1234" },
  staff: { email: "marie@immo.be", password: "Jordan1234" },
  // Realtors below all have at least one team.
  realtor: { email: "els@vastgoedantwerp.be", password: "Jordan1234" },
  realtorBrussels: { email: "pierre@immobruxelles.be", password: "Jordan1234" },
  // Realtor with NO team — for founder-flow tests. Created by
  // scripts/seed-e2e-fixtures.ts; NOT present after a plain `prisma db seed`.
  founder: { email: "founder@e2e.local", password: "Jordan1234" },
  // Freelancer Tim has the in_progress assignment used by mark-delivered tests
  // (also from seed-e2e-fixtures.ts).
  freelancer: { email: "tim@immo.be", password: "Jordan1234" },
} as const;

export type UserKey = keyof typeof USERS;

/** Sign in via the public /login form. Asserts post-login URL leaves /login. */
export async function signIn(page: Page, who: UserKey | { email: string; password: string }) {
  const creds = typeof who === "string" ? USERS[who] : who;
  await page.goto("/login");
  await page.fill('input[name="email"]', creds.email);
  await page.fill('input[name="password"]', creds.password);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes("/login"), { timeout: 10_000 }),
    page.click('button[type="submit"]'),
  ]);
  await expect(page).not.toHaveURL(/\/login/);
}

/** Sign out via the sidebar profile popup (post-bba906a layout). */
export async function signOut(page: Page) {
  // Open the bottom-of-sidebar profile popup, then click Sign out.
  // The chevron toggle on the user row is the entry point.
  await page.goto("/dashboard");
  const profileToggle = page.locator(
    '[aria-label="Open profile menu"], button:has-text("Sign out")',
  ).first();
  if ((await profileToggle.count()) > 0) {
    await profileToggle.click().catch(() => {});
  }
  const signOut = page.getByRole("link", { name: /sign out/i }).or(
    page.getByRole("button", { name: /sign out/i }),
  ).first();
  await signOut.click();
  await page.waitForURL(/\/login/);
}
