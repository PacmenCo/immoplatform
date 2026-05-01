import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Single source of truth for what a "string leaf" looks like in the message
// catalog: any plain string value at any depth. Numbers/booleans/null/arrays
// are not currently part of our message shape — flag them loudly so we don't
// silently drop new copy patterns.
export type LeafEntry = { key: string; value: string };

// Resolved at module load. Override with `I18N_MESSAGES_DIR=<path>` so tests
// (or one-off audits against a snapshot) can run the scripts against a
// fixture tree without `cd`-ing into it. Production scripts leave this unset
// and pick up the default `messages/` relative to cwd.
export const MESSAGES_DIR = process.env.I18N_MESSAGES_DIR || "messages";
export const HASHES_PATH = join(MESSAGES_DIR, "_hashes.json");
export const SOURCE_LOCALE = "en";
export const TODO_PREFIX = "[TODO";

export function listNamespaces(locale: string): string[] {
  const dir = join(MESSAGES_DIR, locale);
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export function listLocales(): string[] {
  return readdirSync(MESSAGES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function readNamespace(locale: string, ns: string): unknown {
  return JSON.parse(
    readFileSync(join(MESSAGES_DIR, locale, `${ns}.json`), "utf8"),
  );
}

// Existence check used by `check`/`sync` to detect a namespace that EN has
// but a non-EN locale doesn't (mid-translation, half-finished). The scripts
// surface this as a typed `namespace-missing` issue rather than letting
// `readFileSync` throw an unhelpful ENOENT and dying mid-run.
export function namespaceExists(locale: string, ns: string): boolean {
  return existsSync(join(MESSAGES_DIR, locale, `${ns}.json`));
}

export function flatten(obj: unknown, prefix = ""): LeafEntry[] {
  if (obj == null) return [];
  if (typeof obj === "string") {
    return [{ key: prefix, value: obj }];
  }
  if (typeof obj !== "object" || Array.isArray(obj)) {
    throw new Error(
      `Unsupported value at "${prefix}": ${typeof obj}. Messages must be string leaves nested in plain objects.`,
    );
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

export function unflatten(entries: LeafEntry[]): unknown {
  const root: Record<string, unknown> = {};
  for (const { key, value } of entries) {
    const parts = key.split(".");
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cursor[p] !== "object" || cursor[p] === null)
        cursor[p] = {};
      cursor = cursor[p] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return root;
}

export function hash(value: string): string {
  // Truncated to 12 hex chars — collisions are astronomically unlikely at
  // our scale and the shorter form keeps `_hashes.json` diffs readable.
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function isTodo(value: string): boolean {
  return value.startsWith(TODO_PREFIX);
}

export type HashesFile = Record<string, Record<string, Record<string, string>>>;

export function readHashes(): HashesFile {
  try {
    return JSON.parse(readFileSync(HASHES_PATH, "utf8")) as HashesFile;
  } catch {
    return {};
  }
}
