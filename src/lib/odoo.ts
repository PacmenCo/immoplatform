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
