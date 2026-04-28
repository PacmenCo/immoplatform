import { test, expect } from "@playwright/test";
import { signIn } from "./_helpers/auth";

// Covers the teams-page rework (commits bba906a + b72fb16):
// - desktop table layout w/ sortable headers
// - shared SearchInput (debounced 250ms, URL-synced via ?q=)
// - SearchInput trim-clobber regression (trailing/leading space)
// - empty-state copy
// - removed /dashboard/search + cmd-K palette

const SEARCH_INPUT = 'input[type="search"]';
const DEBOUNCE_MARGIN_MS = 350; // 250ms debounce + buffer for navigation

test.beforeEach(async ({ page }) => {
  await signIn(page, "admin");
  await page.goto("/dashboard/teams");
  await expect(page).toHaveURL(/\/dashboard\/teams/);
});

test("renders as a sortable table on desktop", async ({ page }) => {
  const table = page.locator("table").first();
  await expect(table).toBeVisible();

  const thead = table.locator("thead");
  await expect(thead.getByText("Office", { exact: true })).toBeVisible();
  await expect(thead.getByText("Owner", { exact: true })).toBeVisible();
  await expect(thead.getByText("Members", { exact: true })).toBeVisible();
  await expect(thead.getByText("Assignments", { exact: true })).toBeVisible();

  const rows = table.locator("tbody tr");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
});

test("search filters team rows by name", async ({ page }) => {
  const search = page.locator(SEARCH_INPUT).first();
  await search.fill("");
  await search.fill("Antwerp");

  await expect(page).toHaveURL(/q=Antwerp/);

  const tbody = page.locator("table tbody").first();
  await expect(tbody.getByText("Vastgoed Antwerp", { exact: true })).toBeVisible();
  await expect(tbody.getByText("Immo Bruxelles", { exact: true })).toHaveCount(0);
});

test("search matches owner email", async ({ page }) => {
  const search = page.locator(SEARCH_INPUT).first();
  await search.fill("");
  await search.fill("els@vastgoed");

  // Email "@" gets percent-encoded in the URL.
  await expect(page).toHaveURL(/q=els(%40|@)vastgoed/);

  const tbody = page.locator("table tbody").first();
  await expect(tbody.getByText("Vastgoed Antwerp", { exact: true })).toBeVisible();
});

test("search trim-clobber regression — typing space then char preserves the space", async ({
  page,
}) => {
  const search = page.locator(SEARCH_INPUT).first();

  // --- trailing space variant ---
  // Type "a", let the debounce fire so the URL becomes ?q=a and the server
  // re-renders with initialQuery="a" (this is what used to clobber the
  // user's mid-edit value).
  await search.fill("");
  await search.pressSequentially("a", { delay: 0 });
  await page.waitForTimeout(250 + DEBOUNCE_MARGIN_MS);
  await expect(page).toHaveURL(/q=a(&|$)/);

  // Now press space — without the fix, the useEffect that watches
  // initialQuery would overwrite "a " back to "a".
  await search.press(" ");
  await page.waitForTimeout(500);

  expect(await search.inputValue()).toBe("a ");

  // --- leading space variant ---
  await search.fill("");
  await search.press(" ");
  await page.waitForTimeout(50);
  await search.pressSequentially("a", { delay: 0 });
  await page.waitForTimeout(500);

  expect(await search.inputValue()).toBe(" a");
});

test("sort toggles asc/desc on Office column", async ({ page }) => {
  // Strip any stale ?sort/?dir state so we start from default (sort=name asc).
  await page.goto("/dashboard/teams");

  const officeHeader = page
    .locator("thead a", { hasText: "Office" })
    .first();

  // First click — current sort is "name"+"asc", so the link's nextDir is "desc".
  await officeHeader.click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(page).toHaveURL(/dir=desc/);

  // Second click — flips back to asc.
  await page.locator("thead a", { hasText: "Office" }).first().click();
  await expect(page).toHaveURL(/sort=name/);
  await expect(page).toHaveURL(/dir=asc/);
});

test("empty-state when no teams match", async ({ page }) => {
  const search = page.locator(SEARCH_INPUT).first();
  await search.fill("");
  await search.fill("zzznomatch");

  await expect(page).toHaveURL(/q=zzznomatch/);
  await expect(page.getByText("No teams match that search")).toBeVisible();
  await expect(page.getByText(/zzznomatch/)).toBeVisible();
  await expect(page.locator("table tbody tr")).toHaveCount(0);
});

test("old /dashboard/search route is gone", async ({ page }) => {
  await page.goto("/dashboard/search");

  // Dashboard 404 keeps the signed-in chrome and shows this copy.
  await expect(
    page.getByRole("heading", { name: /page not found/i }),
  ).toBeVisible();
  await expect(
    page.getByText("We couldn't find that page"),
  ).toBeVisible();

  // The cmd-K "Jump to a page…" topbar input was removed in the same rework.
  await expect(
    page.getByPlaceholder(/jump to a page/i),
  ).toHaveCount(0);
});
