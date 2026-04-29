import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { signIn } from "./_helpers/auth";

// Covers the per-service Odoo pricelist binding feature:
//   - team edit page: admin sees the pricelist picker on the asbestos row
//     and the items-in-pricelist table previews live data from Odoo.
//   - assignment create page: when the active team has an asbestos
//     pricelist binding, ticking the AIV checkbox reveals an inline
//     typeahead pre-loaded with that pricelist's items.
//
// Tests assume:
//   - The dev server (or test deploy) is running with valid ODOO_* env vars
//     and the asbestexperts Odoo tenant is reachable.
//   - Pricelist id 16 ("LTC") exists in Odoo and contains items whose
//     names include the words "EPC" and "Niet-destructieve". If Odoo data
//     drifts these probes need updating.
//
// The tests bind LTC to the asbestos service for two teams in beforeAll:
//   - t_01 (Jordan's first owned team, his session.activeTeamId) — used for
//     the assignment-new picker test.
//   - t_brugge_test — used for the team-edit test (an admin viewing any
//     team can see + edit its bindings).
// Bindings are torn down in afterAll so reruns are idempotent.

const prisma = new PrismaClient();

const LTC_PRICELIST_ID = 16;
const TEAMS_UNDER_TEST = ["t_01", "t_brugge_test"] as const;

test.describe("per-service Odoo pricelist binding", () => {
  test.beforeAll(async () => {
    for (const teamId of TEAMS_UNDER_TEST) {
      await prisma.teamServiceOverride.upsert({
        where: { teamId_serviceKey: { teamId, serviceKey: "asbestos" } },
        create: { teamId, serviceKey: "asbestos", odooPricelistId: LTC_PRICELIST_ID },
        update: { odooPricelistId: LTC_PRICELIST_ID, priceCents: null },
      });
    }
  });

  test.afterAll(async () => {
    // Clear only the column we set, not the whole row — preserves any
    // priceCents override that other tests / fixtures depend on.
    for (const teamId of TEAMS_UNDER_TEST) {
      const existing = await prisma.teamServiceOverride.findUnique({
        where: { teamId_serviceKey: { teamId, serviceKey: "asbestos" } },
        select: { priceCents: true },
      });
      if (!existing) continue;
      if (existing.priceCents === null) {
        await prisma.teamServiceOverride
          .delete({ where: { teamId_serviceKey: { teamId, serviceKey: "asbestos" } } })
          .catch(() => {});
      } else {
        await prisma.teamServiceOverride.update({
          where: { teamId_serviceKey: { teamId, serviceKey: "asbestos" } },
          data: { odooPricelistId: null },
        });
      }
    }
    await prisma.$disconnect();
  });

  test.describe("team edit page", () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "admin");
    });

    test("AIV row exposes a pricelist picker pre-filled with the bound pricelist", async ({
      page,
    }) => {
      await page.goto("/dashboard/teams/t_brugge_test/edit");
      const select = page.locator('select[id="pricelist-asbestos"]');
      await expect(select).toBeVisible();
      await expect(select).toHaveValue(String(LTC_PRICELIST_ID));
    });

    test("items-in-pricelist table renders live items from Odoo", async ({ page }) => {
      await page.goto("/dashboard/teams/t_brugge_test/edit");

      // The table sits inside the AIV row; presence is enough to prove the
      // server-side Odoo fetch landed and rendered. Asserting on a couple
      // of known rows gives us a sanity check on the data path without
      // pinning every Odoo product name.
      const aivRow = page
        .locator('select[id="pricelist-asbestos"]')
        .locator("xpath=ancestor::li[1]");
      await expect(aivRow.getByText(/EPC-Certificaat/).first()).toBeVisible();
      await expect(aivRow.getByText(/Niet-destructieve/).first()).toBeVisible();
    });

    test("changing the binding to '— None —' and saving clears the row", async ({
      page,
    }) => {
      await page.goto("/dashboard/teams/t_brugge_test/edit");

      const select = page.locator('select[id="pricelist-asbestos"]');
      await select.selectOption("");

      // The picker has its own per-row Save button (not the form-wide save bar).
      const aivRow = select.locator("xpath=ancestor::li[1]");
      await aivRow.getByRole("button", { name: "Save", exact: true }).click();

      // Wait for the server action to redirect-or-revalidate.
      await page.waitForLoadState("networkidle");

      const after = await prisma.teamServiceOverride.findUnique({
        where: { teamId_serviceKey: { teamId: "t_brugge_test", serviceKey: "asbestos" } },
      });
      expect(after).toBeNull();

      // Re-bind so subsequent tests in the file (or reruns) start from the
      // expected state — afterAll's cleanup handles full teardown.
      await prisma.teamServiceOverride.create({
        data: {
          teamId: "t_brugge_test",
          serviceKey: "asbestos",
          odooPricelistId: LTC_PRICELIST_ID,
        },
      });
    });
  });

  test.describe("assignment create page", () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, "admin");
      await page.goto("/dashboard/assignments/new");
    });

    test("picker is hidden until the AIV checkbox is ticked (CSS-only reveal)", async ({
      page,
    }) => {
      const picker = page.locator('input[id="product-asbestos"]');

      // CSS-driven reveal: the input still exists in the DOM but its
      // wrapper has `display: none` until `:has(:checked)` flips on.
      await expect(picker).toBeHidden();

      const aivCheckbox = page.locator('input[name="service_asbestos"]');
      await aivCheckbox.check();

      await expect(picker).toBeVisible();
    });

    test("picker filters items as the user types and selecting one populates the hidden field", async ({
      page,
    }) => {
      await page.locator('input[name="service_asbestos"]').check();

      const picker = page.locator('input[id="product-asbestos"]');
      await picker.click();

      // Filter to a single result. "101" matches "Niet-destructieve
      // Asbestinventaris. 101 - 250 m²" — a stable row name in LTC.
      await picker.fill("101");

      const listbox = page.locator('ul[role="listbox"]');
      await expect(listbox).toBeVisible();
      await expect(listbox.locator("button")).toHaveCount(1);
      const option = listbox.locator("button").first();
      await expect(option).toContainText("101 - 250");

      // Pick via mousedown — the picker preventDefaults blur on mousedown
      // so the selection lands before the popover unmounts. Using
      // `dispatchEvent` keeps the click synthetic-equivalent without
      // racing the blur handler.
      await option.dispatchEvent("mousedown");

      // Two hidden form fields submit together: `_product` carries the
      // Odoo `product.template.id`, `_price` carries the picked rule's
      // fixed price in cents (becomes the assignment-line snapshot,
      // overriding the team override / Service.unitPrice).
      const hiddenProduct = page.locator('input[name="service_asbestos_product"]');
      const hiddenPrice = page.locator('input[name="service_asbestos_price"]');
      const productId = await hiddenProduct.inputValue();
      expect(productId).toMatch(/^\d+$/);
      expect(Number.parseInt(productId, 10)).toBeGreaterThan(0);
      // The "101 - 250 m²" rule in the LTC pricelist is priced at €0.00 in
      // current Odoo data — the field still submits "0", not empty.
      const priceCents = await hiddenPrice.inputValue();
      expect(priceCents).toMatch(/^\d+$/);

      // Visible input shows the chosen product's name (snapshot of
      // `productName` from `OdooPricelistItem`).
      await expect(picker).toHaveValue(/101 - 250/);
    });

    test("clearing the picker resets the hidden field to empty string", async ({
      page,
    }) => {
      await page.locator('input[name="service_asbestos"]').check();

      const picker = page.locator('input[id="product-asbestos"]');
      await picker.click();
      await picker.fill("Gemeenschappelijke");
      await page
        .locator('ul[role="listbox"] button')
        .first()
        .dispatchEvent("mousedown");

      const hidden = page.locator('input[name="service_asbestos_product"]');
      expect(await hidden.inputValue()).not.toBe("");

      // The clear (×) button only appears once an item is selected.
      await page.getByLabel("Clear pricelist selection").click();
      await expect(hidden).toHaveValue("");
      await expect(picker).toHaveValue("");
    });

    test("picker is NOT rendered for services without a pricelist binding", async ({
      page,
    }) => {
      // EPC, EK and TK have no pricelist binding on t_01 (only asbestos
      // does). Their per-service pickers should not exist at all.
      for (const key of ["epc", "electrical", "fuel"]) {
        await expect(page.locator(`input[id="product-${key}"]`)).toHaveCount(0);
      }
    });
  });
});
