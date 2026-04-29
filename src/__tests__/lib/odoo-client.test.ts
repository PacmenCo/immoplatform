import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock global fetch so we never hit Odoo. The client builds its requests
// through `executeKw` → `rpc` → fetch. Asserting on `fetch.mock.calls[0]`
// gives us the exact JSON-RPC payload, including the `[0, 0, {…}]` tuple
// for sale.order.write.

const fetchMock = vi.hoisted(() => vi.fn());
vi.stubGlobal("fetch", fetchMock);

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    ODOO_URL: "https://odoo.test",
    ODOO_DB: "testdb",
    ODOO_USERNAME: "tester@test.local",
    ODOO_API_KEY: "test-api-key",
  };
  fetchMock.mockReset();
  // The Odoo client memoizes uid in module memory + the 24h caches
  // (country / pricelist) too. Reset modules so each test starts with
  // zero cached state and the auth fetch is observable.
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

function fetchOk(result: unknown) {
  return {
    ok: true,
    json: async () => ({ jsonrpc: "2.0", id: 1, result }),
  };
}

describe("isOdooConfigured", () => {
  it("requires all four env vars", async () => {
    const { isOdooConfigured } = await import("@/lib/odoo");
    expect(isOdooConfigured()).toBe(true);

    delete process.env.ODOO_API_KEY;
    expect(isOdooConfigured()).toBe(false);
  });
});

describe("createPartner", () => {
  it("posts payload to res.partner.create + collapses falsy fields", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7)) // authenticate → uid=7
      .mockResolvedValueOnce(fetchOk(4711)); // create → id=4711

    const { createPartner } = await import("@/lib/odoo");
    const id = await createPartner({
      name: "Test Owner",
      email: "owner@example.local",
      phone: "",
      street: null,
      city: "Antwerpen",
      zip: "2000",
      country_id: 21,
    });

    expect(id).toBe(4711);
    // execute_kw args layout: [db, uid, apiKey, model, method, args, kwargs]
    // — that's indices 0..6. Destructure positions 3 (model), 4 (method),
    // 5 (positional args list).
    const createCallBody = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const [, , , model, method, args] = createCallBody.params.args;
    expect(model).toBe("res.partner");
    expect(method).toBe("create");
    const payload = (args as unknown[])[0] as Record<string, unknown>;
    // Empty/null fields stripped — only the truthy ones land in the payload
    expect(payload).toMatchObject({
      name: "Test Owner",
      email: "owner@example.local",
      city: "Antwerpen",
      zip: "2000",
      country_id: 21,
    });
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("street");
  });

  it("throws on non-numeric Odoo create response (defensive check)", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(false));

    const { createPartner } = await import("@/lib/odoo");
    await expect(
      createPartner({ name: "Test" }),
    ).rejects.toThrow(/non-numeric/);
  });

  it("throws on negative id (defensive check)", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(-1));

    const { createPartner } = await import("@/lib/odoo");
    await expect(
      createPartner({ name: "Test" }),
    ).rejects.toThrow(/non-numeric/);
  });
});

describe("createSaleOrder", () => {
  it("includes pricelist_id when set, omits when null", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(8821));

    const { createSaleOrder } = await import("@/lib/odoo");
    await createSaleOrder({
      partner_id: 4711,
      pricelist_id: 99,
      x_studio_werfadres: "Meir 34, 2000 Antwerpen",
      date_order: "2026-04-29 10:00:00",
      end_date: "2026-05-29",
    });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const payload = body.params.args[5][0];
    expect(payload).toMatchObject({
      partner_id: 4711,
      pricelist_id: 99,
      x_studio_werfadres: "Meir 34, 2000 Antwerpen",
    });
  });

  it("omits pricelist_id when undefined", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(8822));

    const { createSaleOrder } = await import("@/lib/odoo");
    await createSaleOrder({ partner_id: 4711 });

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const payload = body.params.args[5][0];
    expect(payload).not.toHaveProperty("pricelist_id");
  });
});

describe("addSaleOrderLine — the [0, 0, {…}] tuple", () => {
  it("write payload uses Odoo's create-related-record command", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(true));

    const { addSaleOrderLine } = await import("@/lib/odoo");
    await addSaleOrderLine(8821, 33_500, 199, 2);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const [, , , model, method, modelArgs] = body.params.args;
    expect(model).toBe("sale.order");
    expect(method).toBe("write");
    // First arg = list of ids; second = field updates with order_line: [[0, 0, {...}]]
    expect((modelArgs as unknown[])[0]).toEqual([8821]);
    const updates = (modelArgs as unknown[])[1] as Record<string, unknown>;
    expect(updates).toHaveProperty("order_line");
    const lines = updates.order_line as unknown[];
    expect(lines).toHaveLength(1);
    const tuple = lines[0] as unknown[];
    expect(tuple[0]).toBe(0);
    expect(tuple[1]).toBe(0);
    expect(tuple[2]).toEqual({
      product_id: 33_500,
      product_uom_qty: 2,
      price_unit: 199,
    });
  });

  it("default qty = 1", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk(true));

    const { addSaleOrderLine } = await import("@/lib/odoo");
    await addSaleOrderLine(8821, 33_500, 199);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const tuple = (body.params.args[5][1].order_line as unknown[][])[0];
    expect(tuple[2]).toMatchObject({ product_uom_qty: 1 });
  });
});

describe("findPartnerByEmailOrVat", () => {
  it("OR-joins email + vat clauses with the | operator", async () => {
    fetchMock
      .mockResolvedValueOnce(fetchOk(7))
      .mockResolvedValueOnce(fetchOk([{ id: 1234 }]));

    const { findPartnerByEmailOrVat } = await import("@/lib/odoo");
    const id = await findPartnerByEmailOrVat("test@local", "BE0712.345.678");

    expect(id).toBe(1234);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const domain = body.params.args[5][0];
    // Domain shape: ["|", ["email", "=", "..."], ["vat", "=", "..."]]
    expect(domain[0]).toBe("|");
  });

  it("returns null when neither email nor vat provided", async () => {
    const { findPartnerByEmailOrVat } = await import("@/lib/odoo");
    const id = await findPartnerByEmailOrVat(null, null);
    expect(id).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
