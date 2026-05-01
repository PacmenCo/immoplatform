import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { NAMESPACES } from "./_generated/namespaces";

// Namespaces are split per feature so the catalog stays diff-friendly and
// translators can see scope at a glance. The list above is generated from
// `messages/en/*.json` by `scripts/i18n/codegen.ts` (run via
// `npm run i18n:codegen`, also wired as `prebuild`). Add a file → re-run
// codegen; do not hand-maintain the array.

// Untranslated copy in the catalog is conventionally seeded with a leading
// `[TODO en: …]` token (see `scripts/i18n/_lib.ts` `TODO_PREFIX`). Without
// extra signaling these strings render as plain text in the UI, so a
// translator-forgot bug looks identical to intentional copy. In dev we wrap
// them in unmistakable markers and warn once per (locale, namespace, key)
// per render. In production we no-op — exactly one env check per request.
const TODO_PREFIX = "[TODO";
const MARKER = "⚠";

/**
 * Recursively walk a loaded message tree and visually flag any leaf string
 * that begins with `[TODO`. Mutation is out-of-place: returns a new tree so
 * the imported JSON modules stay untouched (they're cached at module scope
 * by the dynamic `import()` and would leak the markers into prod if mutated
 * after a hot-reload swap).
 *
 * @param messages    Loaded message tree (namespace → nested object of strings).
 * @param locale      Active request locale, included in warn output.
 * @param warn        Logger (defaults to `console.warn`; tests inject a spy).
 * @param seen        Per-render dedupe set scoped by the caller.
 * @returns           A new message tree with TODO leaves wrapped.
 */
export function markTodoLeaves(
  messages: Record<string, unknown>,
  locale: string,
  warn: (message: string) => void = console.warn,
  seen: Set<string> = new Set(),
): Record<string, unknown> {
  const walk = (node: unknown, path: string): unknown => {
    if (typeof node === "string") {
      if (node.startsWith(TODO_PREFIX)) {
        const dedupeKey = `${locale}:${path}`;
        if (!seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          warn(`[i18n] untranslated leaf at ${locale}:${path} → ${node}`);
        }
        return `${MARKER} ${node} ${MARKER}`;
      }
      return node;
    }
    if (node && typeof node === "object" && !Array.isArray(node)) {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = walk(v, path ? `${path}.${k}` : k);
      }
      return out;
    }
    // Numbers/booleans/null/arrays aren't part of the message shape — pass
    // through untouched. The `scripts/i18n/_lib.ts` flatten() throws on these
    // at build time, so by the time we get here the tree is well-formed.
    return node;
  };

  const out: Record<string, unknown> = {};
  for (const [ns, tree] of Object.entries(messages)) {
    out[ns] = walk(tree, ns);
  }
  return out;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const messages: Record<string, unknown> = {};
  await Promise.all(
    NAMESPACES.map(async (ns) => {
      messages[ns] = (await import(`../../messages/${locale}/${ns}.json`))
        .default;
    }),
  );

  if (process.env.NODE_ENV !== "production") {
    return { locale, messages: markTodoLeaves(messages, locale) };
  }

  return { locale, messages };
});
