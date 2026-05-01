#!/usr/bin/env -S npx tsx
//
// Mutates non-EN locale files + the central _hashes.json:
//   - Adds keys present in EN but missing in the locale, populated with
//     `[TODO en: <english value>]` so the placeholder is visible in-app.
//   - Removes keys that no longer exist in EN (orphans).
//   - Records a sidecar hash for a *newly translated* key (no hash yet) so
//     "this translation was made against the current EN value" is captured
//     once. Existing hashes are NEVER overwritten by sync — if EN later
//     changes, `i18n:check` flags the entry as stale and the translator
//     must explicitly delete the sidecar hash entry (or use a future
//     `i18n:approve` flow) to acknowledge the re-translation.
//
// (Earlier versions of this script also rewrote stale hashes, which
// silently certified mismatched translations as in-sync. That was wrong;
// staleness must surface, not be auto-silenced.)
//
// What it deliberately does NOT do: rewrite TODO entries (those need a
// human translator), re-translate values, modify EN files, or refresh
// existing sidecar hashes.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  flatten,
  hash,
  HASHES_PATH,
  isTodo,
  listLocales,
  listNamespaces,
  MESSAGES_DIR,
  namespaceExists,
  readHashes,
  readNamespace,
  SOURCE_LOCALE,
  TODO_PREFIX,
  unflatten,
  type LeafEntry,
} from "./_lib";

function indexOf(entries: LeafEntry[]): Map<string, string> {
  return new Map(entries.map((e) => [e.key, e.value]));
}

function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function main(): void {
  const hashes = readHashes();
  const enNamespaces = listNamespaces(SOURCE_LOCALE);
  const otherLocales = listLocales().filter((l) => l !== SOURCE_LOCALE);

  let added = 0;
  let removed = 0;
  let recorded = 0;

  for (const ns of enNamespaces) {
    const enFlat = flatten(readNamespace(SOURCE_LOCALE, ns));
    const enMap = indexOf(enFlat);

    for (const locale of otherLocales) {
      // If the locale is missing this whole namespace file, treat every
      // EN key as a fresh insert. `check` reports this as `namespace-missing`;
      // here we simply seed an empty map so the standard "add missing" pass
      // populates it with TODO placeholders and writes the file out below.
      const localeFlat = namespaceExists(locale, ns)
        ? flatten(readNamespace(locale, ns))
        : [];
      const localeMap = indexOf(localeFlat);
      const sidecar: Record<string, string> = { ...(hashes[locale]?.[ns] ?? {}) };

      // Add missing.
      for (const [key, enValue] of enMap) {
        if (!localeMap.has(key)) {
          localeMap.set(key, `${TODO_PREFIX} en: ${enValue}]`);
          added++;
        }
      }
      // Remove orphans.
      for (const key of [...localeMap.keys()]) {
        if (!enMap.has(key)) {
          localeMap.delete(key);
          removed++;
        }
      }
      // Record sidecar hashes for *newly translated* entries only.
      // We deliberately never overwrite an existing hash: if EN drifted
      // after translation, that's a staleness condition `i18n:check` must
      // surface, not something `sync` silently certifies away. Translators
      // (or a future `i18n:approve` flow) must delete the sidecar entry to
      // acknowledge a re-translation.
      for (const [key, localeValue] of localeMap) {
        if (isTodo(localeValue)) {
          // Untranslated — leave any old hash entry in place (or absent).
          continue;
        }
        if (sidecar[key]) {
          // Already hashed — never overwrite (see comment above).
          continue;
        }
        const enValue = enMap.get(key);
        if (enValue === undefined) continue; // shouldn't happen post-orphan-prune
        sidecar[key] = hash(enValue);
        recorded++;
      }
      // Drop sidecar entries for keys that no longer exist in the locale file.
      for (const key of Object.keys(sidecar)) {
        if (!localeMap.has(key)) delete sidecar[key];
      }

      // Write back the locale file (sorted by key so diffs stay tidy).
      const sortedEntries: LeafEntry[] = [...localeMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => ({ key, value }));
      writeJson(
        join(MESSAGES_DIR, locale, `${ns}.json`),
        unflatten(sortedEntries),
      );

      hashes[locale] = hashes[locale] ?? {};
      hashes[locale][ns] = Object.fromEntries(
        Object.entries(sidecar).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
  }

  // Sort the top-level hash file too.
  const sortedHashes = Object.fromEntries(
    Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeJson(HASHES_PATH, sortedHashes);

  console.log(
    `✓ i18n sync: +${added} added, -${removed} removed, ${recorded} hash(es) recorded.`,
  );
}

main();
