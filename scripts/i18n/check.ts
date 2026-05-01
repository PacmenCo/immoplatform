#!/usr/bin/env -S npx tsx
//
// Reports drift between EN (source of truth) and every other locale across
// every namespace. Exits non-zero if any of the following hold:
//   - missing:           a key exists in EN but not in the locale file
//   - stale:             the locale has a sidecar hash and it doesn't match
//                        the current EN value (= EN was edited after
//                        translation)
//   - todo:              the locale value still starts with [TODO …] —
//                        placeholder that hasn't been replaced with a real
//                        translation
//   - orphan:            a key exists in the locale file but no longer in EN
//   - extra:             a sidecar hash exists for a key not in the locale
//                        file (and not already reported as `missing` for
//                        that locale/ns/key — sync prunes orphan sidecar
//                        entries, so this only fires on raw / hand-edited
//                        states)
//   - namespace-missing: EN has a namespace file but the locale doesn't
//                        (mid-translation / half-finished). Reported once
//                        per (locale, ns); EN keys in that namespace are
//                        also reported as `missing` for the locale.
//
// Run via `npm run i18n:check` (added to package.json).

import {
  flatten,
  hash,
  isTodo,
  listLocales,
  listNamespaces,
  namespaceExists,
  readHashes,
  readNamespace,
  SOURCE_LOCALE,
  type LeafEntry,
} from "./_lib";

type Issue = {
  locale: string;
  ns: string;
  key: string;
  kind: "missing" | "stale" | "todo" | "orphan" | "extra" | "namespace-missing";
  detail?: string;
};

function indexOf(entries: LeafEntry[]): Map<string, string> {
  return new Map(entries.map((e) => [e.key, e.value]));
}

function main(): void {
  const hashes = readHashes();
  const enNamespaces = listNamespaces(SOURCE_LOCALE);
  const otherLocales = listLocales().filter((l) => l !== SOURCE_LOCALE);

  const issues: Issue[] = [];

  for (const ns of enNamespaces) {
    const enFlat = flatten(readNamespace(SOURCE_LOCALE, ns));
    const enMap = indexOf(enFlat);

    for (const locale of otherLocales) {
      const sidecar = hashes[locale]?.[ns] ?? {};

      // If the locale is missing the whole namespace, surface a typed issue
      // and treat every EN key as `missing` for that locale. Avoids letting
      // `readNamespace` throw an unhelpful ENOENT and killing the run.
      if (!namespaceExists(locale, ns)) {
        issues.push({
          locale,
          ns,
          key: "",
          kind: "namespace-missing",
          detail: `messages/${locale}/${ns}.json does not exist`,
        });
        for (const key of enMap.keys()) {
          issues.push({ locale, ns, key, kind: "missing" });
        }
        // Stale sidecar entries are noise here — the whole file is gone.
        continue;
      }

      const localeFlat = flatten(readNamespace(locale, ns));
      const localeMap = indexOf(localeFlat);
      const missingKeys = new Set<string>();

      for (const [key, enValue] of enMap) {
        const localeValue = localeMap.get(key);
        if (localeValue === undefined) {
          issues.push({ locale, ns, key, kind: "missing" });
          missingKeys.add(key);
          continue;
        }
        if (isTodo(localeValue)) {
          issues.push({ locale, ns, key, kind: "todo" });
          continue;
        }
        const expected = hash(enValue);
        const recorded = sidecar[key];
        if (!recorded || recorded !== expected) {
          issues.push({
            locale,
            ns,
            key,
            kind: "stale",
            detail: recorded
              ? `sidecar=${recorded} current=${expected}`
              : "no sidecar hash",
          });
        }
      }

      for (const key of localeMap.keys()) {
        if (!enMap.has(key)) issues.push({ locale, ns, key, kind: "orphan" });
      }
      for (const key of Object.keys(sidecar)) {
        // Skip keys already reported as `missing` — otherwise a stale
        // sidecar entry for a missing key gets double-counted as both
        // `missing` and `extra`. (Post-`sync` this can't happen because
        // sync prunes orphan sidecar entries, but raw / hand-edited /
        // mid-merge states do hit it.)
        if (!localeMap.has(key) && !missingKeys.has(key))
          issues.push({ locale, ns, key, kind: "extra" });
      }
    }
  }

  if (issues.length === 0) {
    console.log(
      `✓ i18n: every key in ${otherLocales.length} non-EN locale(s) is in sync.`,
    );
    process.exit(0);
  }

  // Group by (locale, kind) for readability.
  const grouped = new Map<string, Issue[]>();
  for (const i of issues) {
    const k = `${i.locale}\t${i.kind}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(i);
  }
  console.error(`✗ i18n: ${issues.length} issue(s)\n`);
  for (const [k, list] of [...grouped.entries()].sort()) {
    const [locale, kind] = k.split("\t");
    console.error(`  ${locale} · ${kind} (${list.length})`);
    for (const i of list.slice(0, 20)) {
      const label = i.key ? `${i.ns}.${i.key}` : i.ns;
      console.error(
        `    ${label}${i.detail ? ` — ${i.detail}` : ""}`,
      );
    }
    if (list.length > 20) console.error(`    … ${list.length - 20} more`);
  }
  console.error(`\nRun \`npm run i18n:sync\` to add TODO stubs for new EN keys`);
  console.error(`and refresh sidecar hashes after translations are applied.`);
  process.exit(1);
}

main();
