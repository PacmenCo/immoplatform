import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers/auth";

// Covers recent public-marketing changes:
//   - 2956c87 / 59c1038  feat(contact): wire public contact form + admin inbox
//   - 4e249ff            remove(marketing): /pricing page
//   - ddcebe2            chore(marketing): drop /demo route
//
// Lives alongside e2e/deleted-routes.spec.ts (which already asserts /pricing
// and /demo 404). This file focuses on the contact-form round-trip and on
// confirming the public Nav/Footer no longer advertise the dead routes.

const MARKETING_404_HEADING =
  /this page went to the inspector and never came back/i;

test.describe("removed marketing routes", () => {
  test("/pricing returns the marketing 404", async ({ page }) => {
    await page.goto("/pricing");
    await expect(
      page.getByRole("heading", { name: MARKETING_404_HEADING }),
    ).toBeVisible();
    // Marketing 404 doesn't render the dashboard sidebar.
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });

  test("/demo returns the marketing 404", async ({ page }) => {
    await page.goto("/demo");
    await expect(
      page.getByRole("heading", { name: MARKETING_404_HEADING }),
    ).toBeVisible();
    await expect(page.getByRole("complementary")).toHaveCount(0);
  });
});

test("homepage Nav/Footer don't link to /pricing or /demo", async ({ page }) => {
  await page.goto("/");

  // No link points at /pricing or /demo anywhere on the homepage.
  await expect(
    page.locator('a[href="/pricing"], a[href^="/pricing?"], a[href^="/pricing#"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('a[href="/demo"], a[href^="/demo?"], a[href^="/demo#"]'),
  ).toHaveCount(0);

  // And no visible link with the matching accessible name either — guards
  // against someone re-introducing a link with a different href shape.
  await expect(
    page.getByRole("link", { name: /^pricing$/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /^(book a )?demo$/i }),
  ).toHaveCount(0);
});

test.describe("/contact form", () => {
  test("submits and lands in the admin inbox", async ({ page }) => {
    // Unique per-run marker so we can pick this exact submission out of the
    // admin inbox even if the seed/dev DB already has other entries.
    const marker = `e2e-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

    await page.goto("/contact");
    await expect(
      page.getByRole("heading", {
        name: /talk to a real human/i,
      }),
    ).toBeVisible();

    await page.getByLabel(/full name/i).fill("E2E Tester");
    await page.getByLabel(/work email/i).fill("e2e@example.com");
    // Subject is optional but useful as an extra hook in the inbox row.
    await page.getByLabel(/^subject$/i).fill(`E2E ${marker}`);
    await page
      .getByLabel(/^message$/i)
      .fill(`Hello from Playwright. marker=${marker}`);

    await page.getByRole("button", { name: /send message/i }).click();

    // Form is replaced by the SuccessBanner thank-you message.
    await expect(
      page.getByText(/thanks — we got your message/i),
    ).toBeVisible();

    // Now sign in as admin (same browser context = same cookies). The
    // signIn helper navigates to /login and asserts the post-login URL.
    await signIn(page, "admin");
    await page.goto("/dashboard/contact-messages");

    await expect(
      page.getByRole("heading", { name: /contact messages/i }).first(),
    ).toBeVisible();

    // The submission should be visible — match on the marker, which is
    // embedded in both the subject and message body.
    await expect(page.getByText(marker).first()).toBeVisible();

    // The row should also surface the visitor's name + email.
    await expect(page.getByText("E2E Tester").first()).toBeVisible();
    await expect(page.getByText("e2e@example.com").first()).toBeVisible();
  });

  test("validates required fields", async ({ page }) => {
    await page.goto("/contact");

    const submit = page.getByRole("button", { name: /send message/i });
    await submit.click();

    // The form opts out of native validation (`noValidate`), so the server
    // action runs and returns an ActionResult error → ErrorAlert renders.
    // We don't pin the exact copy — Zod's first-issue message can shift —
    // but we DO assert we never reached the success state and we're still
    // on /contact with the form mounted.
    await expect(page).toHaveURL(/\/contact$/);
    await expect(
      page.getByText(/thanks — we got your message/i),
    ).toHaveCount(0);

    // Either an explicit error alert appeared, or the required name input
    // is still empty + visible (i.e. the submission did not succeed).
    const nameInput = page.getByLabel(/full name/i);
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue("");
  });
});
