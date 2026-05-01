/**
 * Vitest shim for `next-intl/server`. The real module reads request-scoped
 * config that's only set up by the Next.js framework dispatcher; outside a
 * request context it throws "not supported in Client Components". Tests run
 * server actions directly, so we stub `getLocale` to return the routing
 * default (matches what a fresh visit hits in production).
 */

import type { Locale } from "next-intl";
import { createTranslator } from "use-intl";
import { routing } from "@/i18n/routing";

export async function getLocale(): Promise<string> {
  return routing.defaultLocale;
}

// Load the requested locale's namespace JSON from disk. We read the file
// synchronously from the absolute messages path so Vite doesn't try to
// statically analyse a fully-dynamic import specifier (which it warns
// about and which doesn't actually transform correctly under the SSR
// pipeline anyway).
import { readFileSync } from "node:fs";
import { resolve as resolvePath } from "node:path";

function loadNamespace(
  locale: string,
  topNamespace: string,
): Record<string, unknown> {
  const path = resolvePath(
    process.cwd(),
    "messages",
    locale,
    `${topNamespace}.json`,
  );
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

type TranslatorOpts = { locale?: string; namespace?: string };

/**
 * Mimic `next-intl/server`'s `getTranslations` for vitest:
 *   getTranslations({ locale, namespace })
 *   getTranslations(namespace)
 *   getTranslations() — returns a translator scoped to messages root.
 *
 * The returned translator supports `(key, values?)` and `.has(key)` —
 * matches the surface our app code uses.
 */
export async function getTranslations(
  opts?: TranslatorOpts | string,
): Promise<ReturnType<typeof createTranslator>> {
  const arg: TranslatorOpts = typeof opts === "string" ? { namespace: opts } : (opts ?? {});
  const locale = arg.locale ?? routing.defaultLocale;
  const namespace = arg.namespace;

  // The first segment of `namespace` (before any dot) is the on-disk
  // namespace file; remaining segments are nested-key prefixes that
  // `createTranslator` resolves via its own `namespace:` option.
  const [topNs] = (namespace ?? "").split(".").filter(Boolean);
  const messages = topNs ? { [topNs]: loadNamespace(locale, topNs) } : {};
  return createTranslator({
    locale: locale as Locale,
    messages,
    namespace: namespace ?? undefined,
    // Tests should fail loudly on missing keys — surfaces translator bugs.
    onError: (err) => {
      throw err;
    },
    getMessageFallback: ({ key, namespace: ns }) => `${ns ?? ""}.${key}`,
  });
}
