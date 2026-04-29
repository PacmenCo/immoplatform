/**
 * Odoo JSON-RPC client.
 *
 * Talks to a hosted Odoo instance (default: asbestexperts.odoo.com) via the
 * `/jsonrpc` endpoint. Auth flow:
 *
 *   1. POST {service:'common', method:'authenticate'} → returns a numeric uid
 *   2. POST {service:'object',  method:'execute_kw'}  with (db, uid, password,
 *      model, method, args, kwargs) → runs an ORM call
 *
 * The uid is cached in module memory for the process lifetime — Odoo uids are
 * stable per (db, login). On any auth-shaped failure we drop the cache and
 * re-authenticate once before giving up.
 *
 * Env vars (all required when called):
 *   ODOO_URL        e.g. https://asbestexperts.odoo.com
 *   ODOO_DB         e.g. asbestexperts
 *   ODOO_USERNAME   the Odoo login (email)
 *   ODOO_API_KEY    a developer API key (Settings → Account Security)
 */

import "server-only";

type JsonRpcOk<T> = { jsonrpc: "2.0"; id: number | null; result: T };
type JsonRpcErr = {
  jsonrpc: "2.0";
  id: number | null;
  error: { code: number; message: string; data?: { name?: string; message?: string; debug?: string } };
};

// Memoized as a Promise (not a resolved value) so concurrent first-callers
// share a single in-flight `authenticate()` instead of each issuing one.
let uidPromise: Promise<number> | null = null;

function env() {
  const url = process.env.ODOO_URL;
  const db = process.env.ODOO_DB;
  const username = process.env.ODOO_USERNAME;
  const apiKey = process.env.ODOO_API_KEY;
  if (!url || !db || !username || !apiKey) {
    throw new Error(
      "Odoo not configured — set ODOO_URL, ODOO_DB, ODOO_USERNAME, ODOO_API_KEY",
    );
  }
  return { url: url.replace(/\/$/, ""), db, username, apiKey };
}

async function rpc<T>(
  endpoint: string,
  service: string,
  method: string,
  args: unknown[],
): Promise<T> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "call",
      params: { service, method, args },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Odoo ${service}.${method} HTTP ${res.status}`);
  const body = (await res.json()) as JsonRpcOk<T> | JsonRpcErr;
  if ("error" in body) {
    const detail = body.error.data?.message ?? body.error.message;
    const err = new Error(`Odoo ${service}.${method}: ${detail}`);
    (err as Error & { odoo?: typeof body.error }).odoo = body.error;
    throw err;
  }
  return body.result;
}

async function authenticate(): Promise<number> {
  const { url, db, username, apiKey } = env();
  const uid = await rpc<number | false>(
    `${url}/jsonrpc`,
    "common",
    "authenticate",
    [db, username, apiKey, {}],
  );
  if (!uid) throw new Error("Odoo authentication failed — bad credentials");
  return uid;
}

async function getUid(): Promise<number> {
  if (!uidPromise) {
    uidPromise = authenticate().catch((err) => {
      // Failed auth: drop the cached rejection so the next caller retries
      // with a fresh request, instead of every future call throwing the
      // same memoized rejection forever.
      uidPromise = null;
      throw err;
    });
  }
  return uidPromise;
}

function isAuthError(e: unknown): boolean {
  const odoo = (e as { odoo?: { data?: { name?: string } } } | null)?.odoo;
  const name = odoo?.data?.name ?? "";
  return /AccessDenied|AccessError|SessionExpired/i.test(name);
}

/**
 * Run an ORM method against any Odoo model. Mirrors `execute_kw`:
 *   executeKw('product.template', 'search_read', [domain, fields], {limit, order})
 */
export async function executeKw<T = unknown>(
  model: string,
  method: string,
  args: unknown[],
  kwargs: Record<string, unknown> = {},
): Promise<T> {
  const { url, db, apiKey } = env();
  const call = async () => {
    const uid = await getUid();
    return rpc<T>(`${url}/jsonrpc`, "object", "execute_kw", [
      db,
      uid,
      apiKey,
      model,
      method,
      args,
      kwargs,
    ]);
  };
  try {
    return await call();
  } catch (e) {
    if (!isAuthError(e)) throw e;
    uidPromise = null;
    return await call();
  }
}

/** Odoo many2one fields come back as `[id, display_name]` or `false`. */
export type Many2one = [number, string] | false;

export type OdooPricelist = {
  id: number;
  name: string;
  currency_id: Many2one;
  company_id: Many2one;
  active: boolean;
  sequence: number;
  /** Number of `product.pricelist.item` rows attached to this pricelist. */
  itemCount: number;
};

type PricelistRow = Omit<OdooPricelist, "itemCount">;
type ItemCountRow = { pricelist_id: Many2one; pricelist_id_count: number };

/**
 * List Odoo pricelists with their row counts. Defaults to active only.
 * The item count comes from a single `read_group` call against
 * `product.pricelist.item` so we don't N+1 the API.
 */
export async function listPricelists(opts: {
  includeInactive?: boolean;
} = {}): Promise<OdooPricelist[]> {
  const domain: unknown[] = opts.includeInactive ? [] : [["active", "=", true]];
  const [rows, counts] = await Promise.all([
    executeKw<PricelistRow[]>(
      "product.pricelist",
      "search_read",
      [domain, ["id", "name", "currency_id", "company_id", "active", "sequence"]],
      { order: "sequence,id" },
    ),
    executeKw<ItemCountRow[]>(
      "product.pricelist.item",
      "read_group",
      [[], ["pricelist_id"], ["pricelist_id"]],
    ),
  ]);
  const byId = new Map<number, number>();
  for (const c of counts) {
    if (Array.isArray(c.pricelist_id)) byId.set(c.pricelist_id[0], c.pricelist_id_count);
  }
  return rows.map((r) => ({ ...r, itemCount: byId.get(r.id) ?? 0 }));
}

export type OdooPricelistItem = {
  id: number;
  pricelistId: number;
  /** Falls back to `display_name` when there's no underlying product (rule
   *  applies on a category, not a specific product). */
  productName: string;
  /** Odoo's `compute_price`: "fixed" | "percentage" | "formula". */
  computePrice: string;
  /** Cents on a "fixed" rule. Null when the rule is percentage/formula. */
  fixedPriceCents: number | null;
  /** 0–100 on a "percentage" rule. Null otherwise. */
  priceDiscount: number | null;
  minQuantity: number;
  dateStart: string | false;
  dateEnd: string | false;
};

type RawItem = {
  id: number;
  pricelist_id: Many2one;
  display_name: string;
  applied_on: string;
  product_tmpl_id: Many2one;
  product_id: Many2one;
  categ_id: Many2one;
  min_quantity: number;
  fixed_price: number;
  price_discount: number;
  compute_price: string;
  date_start: string | false;
  date_end: string | false;
};

/**
 * List the rule rows attached to one or more pricelists. Returns a flat array;
 * caller groups by `pricelistId` if needed.
 *
 * Float prices from Odoo are converted to integer cents at the boundary so
 * everything downstream stays integer-only (per project money convention).
 */
export async function listPricelistItems(pricelistIds: number[]): Promise<OdooPricelistItem[]> {
  if (pricelistIds.length === 0) return [];
  const rows = await executeKw<RawItem[]>(
    "product.pricelist.item",
    "search_read",
    [
      [["pricelist_id", "in", pricelistIds]],
      [
        "id",
        "pricelist_id",
        "display_name",
        "applied_on",
        "product_tmpl_id",
        "product_id",
        "categ_id",
        "min_quantity",
        "fixed_price",
        "price_discount",
        "compute_price",
        "date_start",
        "date_end",
      ],
    ],
    { order: "id desc" },
  );
  return rows.map((r) => {
    const product =
      (Array.isArray(r.product_id) && r.product_id[1]) ||
      (Array.isArray(r.product_tmpl_id) && r.product_tmpl_id[1]) ||
      (Array.isArray(r.categ_id) && `Category: ${r.categ_id[1]}`) ||
      r.display_name ||
      "—";
    return {
      id: r.id,
      pricelistId: Array.isArray(r.pricelist_id) ? r.pricelist_id[0] : 0,
      productName: product,
      computePrice: r.compute_price,
      fixedPriceCents:
        r.compute_price === "fixed" ? Math.round(r.fixed_price * 100) : null,
      priceDiscount:
        r.compute_price === "percentage" ? r.price_discount : null,
      minQuantity: r.min_quantity,
      dateStart: r.date_start,
      dateEnd: r.date_end,
    };
  });
}

// ─── Configuration gate ───────────────────────────────────────────

/**
 * True only when every required env var is present. Use this from
 * orchestrators to skip silently in dev/staging environments without
 * Odoo credentials. Mirrors v1's `OdooService::isConfigured()`.
 */
export function isOdooConfigured(): boolean {
  return !!(
    process.env.ODOO_URL &&
    process.env.ODOO_DB &&
    process.env.ODOO_USERNAME &&
    process.env.ODOO_API_KEY
  );
}

// ─── 24h in-memory caches ─────────────────────────────────────────
// Single-process droplet (per CLAUDE.md) — module-level Map is fine.
// Don't cache `null` results (transient API failures shouldn't poison
// the cache for a day). Mirrors v1's `Cache::remember(_, now()->addDay())`.

type CacheEntry<T> = { value: T; expires: number };
const valueCache = new Map<string, CacheEntry<number>>();
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function memoNumeric(
  key: string,
  produce: () => Promise<number | null>,
): Promise<number | null> {
  const hit = valueCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const fresh = await produce();
  if (fresh !== null) {
    valueCache.set(key, { value: fresh, expires: Date.now() + ONE_DAY_MS });
  }
  return fresh;
}

// ─── Lookups for the sync orchestrator ────────────────────────────

/**
 * Look up a country id by ISO-2 code. Returns null when the country isn't
 * present in the tenant (extremely unlikely for "BE" but still defended).
 */
export async function findCountryIdByCode(code: string): Promise<number | null> {
  const rows = await executeKw<Array<{ id: number }>>(
    "res.country",
    "search_read",
    [[["code", "=", code]], ["id"]],
    { limit: 1 },
  );
  return rows[0]?.id ?? null;
}

/** Belgium country id, cached for 24h. Mirrors v1's getBelgiumCountryId. */
export async function getBelgiumCountryId(): Promise<number | null> {
  return memoNumeric("country:BE", () => findCountryIdByCode("BE"));
}

/**
 * Find the first pricelist whose name matches `name` (case-insensitive).
 * Mirrors v1's `findPricelistByName` — uses ilike, returns the first row.
 */
export async function findPricelistByName(name: string): Promise<number | null> {
  const rows = await executeKw<Array<{ id: number }>>(
    "product.pricelist",
    "search_read",
    [[["name", "ilike", name]], ["id"]],
    { limit: 1 },
  );
  return rows[0]?.id ?? null;
}

/** "Standaard prijslijst" id, cached for 24h. */
export async function getDefaultPricelistId(): Promise<number | null> {
  return memoNumeric("pricelist:default", () =>
    findPricelistByName("Standaard prijslijst"),
  );
}

/**
 * Look up a single `product.product` by case-insensitive name match.
 * Returns id + lst_price (Odoo's headline price, used as the order line's
 * `price_unit` — same field v1 reads). Returns null when no product
 * matches; caller decides whether that's a hard error or a warning.
 */
export async function findProductByName(
  name: string,
): Promise<{ id: number; lst_price: number } | null> {
  const rows = await executeKw<Array<{ id: number; lst_price: number }>>(
    "product.product",
    "search_read",
    [[["name", "ilike", name]], ["id", "lst_price"]],
    { limit: 1 },
  );
  return rows[0] ?? null;
}

/**
 * Look up a `product.product` variant for a given `product.template.id`.
 * Used to honor the realtor's product pick from the assignment-create form
 * (`AssignmentService.odooProductTemplateId` stores a template id; lines
 * need a product id). For products without variants there's exactly one
 * `product.product` per template — that's the row we want.
 */
export async function findProductByTemplateId(
  templateId: number,
): Promise<{ id: number; lst_price: number } | null> {
  const rows = await executeKw<Array<{ id: number; lst_price: number }>>(
    "product.product",
    "search_read",
    [[["product_tmpl_id", "=", templateId]], ["id", "lst_price"]],
    { limit: 1 },
  );
  return rows[0] ?? null;
}

/**
 * Search for an existing partner by email or VAT. Closes v1's known race
 * (two simultaneous assignments for the same owner → two `res.partner`
 * rows). Cost: one extra RPC per sync. Returns the first match by id.
 */
export async function findPartnerByEmailOrVat(
  email: string | null,
  vat: string | null,
): Promise<number | null> {
  const clauses: unknown[] = [];
  if (email) clauses.push(["email", "=", email]);
  if (vat) clauses.push(["vat", "=", vat]);
  if (clauses.length === 0) return null;
  // OR multiple terms together: ['|', term1, term2, …]
  const domain: unknown[] = clauses.length === 1 ? clauses : ["|", ...clauses];
  const rows = await executeKw<Array<{ id: number }>>(
    "res.partner",
    "search_read",
    [domain, ["id"]],
    { limit: 1 },
  );
  return rows[0]?.id ?? null;
}

// ─── Writes (used by the sync orchestrator) ───────────────────────

/** Defensive return-shape check on Odoo `create` calls. Odoo's RPC layer
 *  occasionally returns `false` after an unhandled auth error rather than
 *  raising — this converts that silent corruption into a clear failure. */
function ensureValidId(model: string, value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(
      `Odoo ${model}.create returned non-numeric: ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export type CreatePartnerArgs = {
  name: string;
  email?: string | null;
  phone?: string | null;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  country_id?: number | null;
};

/**
 * Create a `res.partner`. Empty strings collapse to `null` — caller pattern
 * is `value || null` (same as v1's `?: null` ternary). Country id may be
 * null (skipped from payload).
 */
export async function createPartner(data: CreatePartnerArgs): Promise<number> {
  const payload: Record<string, unknown> = { name: data.name };
  if (data.email) payload.email = data.email;
  if (data.phone) payload.phone = data.phone;
  if (data.street) payload.street = data.street;
  if (data.city) payload.city = data.city;
  if (data.zip) payload.zip = data.zip;
  if (data.country_id) payload.country_id = data.country_id;
  const id = await executeKw<unknown>("res.partner", "create", [payload]);
  return ensureValidId("res.partner", id);
}

export type CreateSaleOrderArgs = {
  partner_id: number;
  pricelist_id?: number | null;
  /** Custom Studio field on Asbestexperts' Odoo tenant. Format: "street, postal city". */
  x_studio_werfadres?: string | null;
  /** "YYYY-MM-DD HH:mm:ss" — Odoo accepts both date and datetime in this slot. */
  date_order?: string;
  /** "YYYY-MM-DD" — project deadline. */
  end_date?: string;
};

export async function createSaleOrder(data: CreateSaleOrderArgs): Promise<number> {
  const payload: Record<string, unknown> = { partner_id: data.partner_id };
  if (data.pricelist_id) payload.pricelist_id = data.pricelist_id;
  if (data.x_studio_werfadres) payload.x_studio_werfadres = data.x_studio_werfadres;
  if (data.date_order) payload.date_order = data.date_order;
  if (data.end_date) payload.end_date = data.end_date;
  const id = await executeKw<unknown>("sale.order", "create", [payload]);
  return ensureValidId("sale.order", id);
}

/**
 * Append a single line to an existing sale.order. Uses Odoo's
 * `(0, 0, {...})` one2many command — `0` = "create new related record",
 * which appends to the existing `order_line` list (does not replace).
 * Mirrors v1's `OdooService::addOrderLineViaUpdate` exactly.
 */
export async function addSaleOrderLine(
  orderId: number,
  productId: number,
  priceUnit: number,
  qty: number = 1,
): Promise<void> {
  await executeKw<boolean>("sale.order", "write", [
    [orderId],
    {
      order_line: [
        [0, 0, { product_id: productId, product_uom_qty: qty, price_unit: priceUnit }],
      ],
    },
  ]);
}
