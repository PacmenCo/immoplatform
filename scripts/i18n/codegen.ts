#!/usr/bin/env -S npx tsx
//
// Derives the canonical list of message namespaces from `messages/en/*.json`
// and writes two outputs:
//
//   1. `src/i18n/_generated/namespaces.ts` — runtime `NAMESPACES` const +
//      `Namespace` type. Consumed by `src/i18n/request.ts` so a missing
//      registration can no longer cause a runtime `MISSING_MESSAGE`.
//   2. `src/types/messages.d.ts` — `use-intl` `AppConfig` augmentation that
//      types every namespace from its EN JSON shape, so `t('foo.bar')` is
//      compile-checked.
//
// Both files are GENERATED — never hand-edit. Run `npm run i18n:codegen`
// (or let `prebuild` do it) after dropping a new `messages/en/<ns>.json`.
//
// Modes:
//   - `npm run i18n:codegen`         — write outputs to disk.
//   - `npm run i18n:codegen -- --check` — render in-memory, diff vs disk,
//                                       exit 1 on mismatch (for CI).
//
// Determinism: the namespace list is sorted alphabetically before emit so
// re-runs against an unchanged catalog produce byte-identical files.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPO_ROOT = resolve(__dirname, "..", "..");
const EN_DIR = join(REPO_ROOT, "messages", "en");
const ROUTING_TS = join(REPO_ROOT, "src", "i18n", "routing.ts");
const NAMESPACES_OUT = join(
  REPO_ROOT,
  "src",
  "i18n",
  "_generated",
  "namespaces.ts",
);
const MESSAGES_DTS_OUT = join(REPO_ROOT, "src", "types", "messages.d.ts");

// `src/i18n/routing.ts` is the single source of truth for the locale list:
// adding a locale there must propagate to the `Locale` union in
// `messages.d.ts` without any second edit. We dynamically import the module
// (tsx + ESM resolves it fine — `routing.ts` is a pure module with no side
// effects) and read `routing.locales`. If that ever fails (e.g. an
// incompatible next-intl change at codegen time), fall back to a structural
// regex read of the literal `locales: [...]` array so the build doesn't wedge.
async function discoverLocales(): Promise<string[]> {
  try {
    const mod = (await import(pathToFileURL(ROUTING_TS).href)) as {
      routing?: { locales?: readonly string[] };
    };
    const locales = mod.routing?.locales;
    if (Array.isArray(locales) && locales.length > 0) {
      return [...locales];
    }
    throw new Error("routing.locales missing or empty");
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const source = readFileSync(ROUTING_TS, "utf8");
    const match = source.match(/locales:\s*\[([^\]]+)\]/);
    if (!match) {
      throw new Error(
        `Cannot derive locales from ${ROUTING_TS} (import failed: ${reason}; no locales: [...] literal found either)`,
      );
    }
    const locales = Array.from(match[1].matchAll(/["']([^"']+)["']/g)).map(
      (m) => m[1],
    );
    if (locales.length === 0) {
      throw new Error(
        `Locales array in ${ROUTING_TS} parsed to zero entries (import failed: ${reason})`,
      );
    }
    return locales;
  }
}

function discoverNamespaces(): string[] {
  let entries: string[];
  try {
    entries = readdirSync(EN_DIR);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read EN message catalog at ${EN_DIR}: ${reason}`);
  }
  const namespaces = entries
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
  if (namespaces.length === 0) {
    throw new Error(
      `No JSON namespaces found under ${EN_DIR}. The EN catalog must contain at least one file.`,
    );
  }
  return namespaces;
}

function renderNamespacesModule(namespaces: string[]): string {
  const tuple = namespaces.map((ns) => `"${ns}"`).join(", ");
  return [
    "// GENERATED — do not edit. Run `npm run i18n:codegen` after touching messages/en/.",
    "//",
    "// Source of truth: filenames under `messages/en/*.json`.",
    "// Consumed by `src/i18n/request.ts` to load every namespace per request.",
    "",
    `export const NAMESPACES = [${tuple}] as const;`,
    "",
    "export type Namespace = (typeof NAMESPACES)[number];",
    "",
  ].join("\n");
}

function renderMessagesDts(namespaces: string[], locales: string[]): string {
  const importLines = namespaces
    .map(
      (ns) =>
        `import type ${ns}Messages from "../../messages/en/${ns}.json";`,
    )
    .join("\n");
  const fieldLines = namespaces
    .map((ns) => `    ${ns}: typeof ${ns}Messages;`)
    .join("\n");
  // Emit a proper TS union type expression (`"a" | "b" | "c"`), not the raw
  // array contents. `routing.locales` order is preserved so a re-run with the
  // same routing.ts produces a byte-identical file.
  const localeUnion = locales.map((l) => `"${l}"`).join(" | ");
  return [
    "// GENERATED — do not edit. Run `npm run i18n:codegen`.",
    "//",
    "// Augments `use-intl`'s `AppConfig` so every `t('ns.key')` lookup is",
    "// compile-checked against the EN source-of-truth catalog. Adding a new",
    "// namespace is just `messages/en/<ns>.json` + re-running codegen — both",
    "// the runtime `NAMESPACES` array (in `src/i18n/_generated/namespaces.ts`)",
    "// and this type augmentation are derived from the same glob. The `Locale`",
    "// union is derived from `src/i18n/routing.ts` — adding a locale there",
    "// flows here on the next codegen run.",
    "",
    importLines,
    "",
    "declare module \"use-intl\" {",
    "  interface AppConfig {",
    "    Messages: {",
    fieldLines,
    "    };",
    `    Locale: ${localeUnion};`,
    "  }",
    "}",
    "",
  ].join("\n");
}

function readIfExists(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function writeFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, "utf8");
}

async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const checkMode = args.includes("--check");

  const namespaces = discoverNamespaces();
  const locales = await discoverLocales();
  const namespacesModule = renderNamespacesModule(namespaces);
  const messagesDts = renderMessagesDts(namespaces, locales);

  if (checkMode) {
    const onDiskNamespaces = readIfExists(NAMESPACES_OUT);
    const onDiskDts = readIfExists(MESSAGES_DTS_OUT);
    const drifts: string[] = [];
    if (onDiskNamespaces !== namespacesModule) {
      drifts.push(NAMESPACES_OUT);
    }
    if (onDiskDts !== messagesDts) {
      drifts.push(MESSAGES_DTS_OUT);
    }
    if (drifts.length > 0) {
      console.error(
        "[i18n:codegen --check] Generated files are out of date. Run `npm run i18n:codegen` and commit.",
      );
      for (const path of drifts) {
        console.error(`  drift: ${path}`);
      }
      process.exit(1);
    }
    console.log("[i18n:codegen --check] OK — generated files match catalog.");
    return;
  }

  writeFile(NAMESPACES_OUT, namespacesModule);
  writeFile(MESSAGES_DTS_OUT, messagesDts);
  console.log(
    `[i18n:codegen] wrote ${namespaces.length} namespace(s): ${namespaces.join(", ")} | ${locales.length} locale(s): ${locales.join(", ")}`,
  );
}

run().catch((err) => {
  const reason = err instanceof Error ? err.message : String(err);
  console.error(`[i18n:codegen] ${reason}`);
  process.exit(1);
});
