import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  flatten,
  hash,
  isTodo,
  unflatten,
  TODO_PREFIX,
} from "../../../scripts/i18n/_lib";

// Repo root — we run the scripts from here so they can resolve their own
// relative imports + `node_modules/.bin/tsx`. Vitest's process.cwd() at the
// moment this module loads is already the repo root, but resolve() pins it
// against this test file so the tests don't care where they're invoked from.
const REPO_ROOT = resolve(__dirname, "..", "..", "..");
const TSX_BIN = join(REPO_ROOT, "node_modules", ".bin", "tsx");
const CHECK_SCRIPT = join(REPO_ROOT, "scripts", "i18n", "check.ts");
const SYNC_SCRIPT = join(REPO_ROOT, "scripts", "i18n", "sync.ts");

// -----------------------------------------------------------------------------
// Pure helper tests — no fs, no spawn.
// -----------------------------------------------------------------------------

describe("flatten / unflatten", () => {
  it("round-trips a representative nested object", () => {
    const input = {
      nav: { home: "Home", login: "Log in" },
      footer: {
        columns: { account: { title: "Account" } },
        copyright: "© 2026",
      },
      tagline: "Hello",
    };
    const flat = flatten(input);
    const back = unflatten(flat);
    expect(back).toEqual(input);
  });

  it("preserves empty strings as valid leaves", () => {
    const flat = flatten({ a: { b: "" } });
    expect(flat).toEqual([{ key: "a.b", value: "" }]);
    expect(unflatten(flat)).toEqual({ a: { b: "" } });
  });

  it("preserves unicode and ICU-style placeholders unchanged", () => {
    const input = {
      greet: "Hello {name} 👋",
      multi: "{count, plural, one {# item} other {# items}}",
      nl: "Alstublieft — éénmalig",
    };
    const back = unflatten(flatten(input));
    expect(back).toEqual(input);
  });

  it("flattens deeply nested keys with dotted paths", () => {
    const flat = flatten({ a: { b: { c: { d: "deep" } } } });
    expect(flat).toEqual([{ key: "a.b.c.d", value: "deep" }]);
  });

  it("treats null leaves as absent (returns no entry for that path)", () => {
    // Documents current behaviour — see _lib.ts: `if (obj == null) return [];`
    // Means a nested null silently drops the parent key with no warning.
    expect(flatten({ a: null, b: "ok" })).toEqual([{ key: "b", value: "ok" }]);
  });

  it("throws on number leaves and names the offending key", () => {
    expect(() => flatten({ a: { b: 42 } })).toThrowError(/"a\.b".*number/);
  });

  it("throws on boolean leaves and names the offending key", () => {
    expect(() => flatten({ flag: true })).toThrowError(/"flag".*boolean/);
  });

  it("throws on array leaves and names the offending key", () => {
    // Arrays are objects in JS; the check is `Array.isArray(obj)`.
    expect(() => flatten({ items: ["a", "b"] })).toThrowError(/"items".*object/);
  });
});

describe("hash", () => {
  it("is deterministic for the same input across calls", () => {
    expect(hash("hello")).toBe(hash("hello"));
  });

  it("returns a 12-char hex digest", () => {
    expect(hash("anything")).toMatch(/^[0-9a-f]{12}$/);
  });

  it("differs when whitespace, case, or unicode codepoint changes", () => {
    expect(hash("Hello")).not.toBe(hash("hello"));
    expect(hash("Hello {name}")).not.toBe(hash("Hello {firstName}"));
    expect(hash("café")).not.toBe(hash("cafe"));
  });

  it("hashes the empty string to a stable, well-defined value", () => {
    // SHA-256("") prefix — guards against ever switching algos by accident.
    expect(hash("")).toBe("e3b0c44298fc");
  });
});

describe("isTodo", () => {
  it("matches the canonical sync-emitted placeholder", () => {
    expect(isTodo(`${TODO_PREFIX} en: Hello]`)).toBe(true);
  });

  it("matches any value starting with [TODO regardless of suffix", () => {
    // The check is a literal `startsWith("[TODO")` — no space requirement,
    // so anything that begins with the prefix counts as untranslated. This
    // is intentional (cheap + permissive) but document it so a contributor
    // doesn't assume a stricter shape.
    expect(isTodo("[TODO_TRANSLATED]")).toBe(true);
    expect(isTodo("[TODO]")).toBe(true);
    expect(isTodo("[TODOpending]")).toBe(true);
  });

  it("rejects strings that mention TODO without the bracket prefix", () => {
    expect(isTodo("TODO")).toBe(false);
    expect(isTodo("This is a TODO note")).toBe(false);
    expect(isTodo(" [TODO en: x]")).toBe(false); // leading space defeats it
    expect(isTodo("")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Integration tests — spawn the scripts against a fixture messages dir.
// -----------------------------------------------------------------------------

type Tree = Record<string, unknown>;

interface Fixture {
  dir: string;
  hashesPath: string;
  writeNs(locale: string, ns: string, tree: Tree): void;
  readNs(locale: string, ns: string): Tree;
  readHashes(): Record<string, Record<string, Record<string, string>>>;
  runCheck(): { code: number; stdout: string; stderr: string };
  runSync(): { code: number; stdout: string; stderr: string };
}

function makeFixture(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), "immo-i18n-"));
  mkdirSync(join(dir, "en"), { recursive: true });
  mkdirSync(join(dir, "nl-BE"), { recursive: true });

  const writeNs = (locale: string, ns: string, tree: Tree): void => {
    mkdirSync(join(dir, locale), { recursive: true });
    writeFileSync(
      join(dir, locale, `${ns}.json`),
      `${JSON.stringify(tree, null, 2)}\n`,
      "utf8",
    );
  };

  const readNs = (locale: string, ns: string): Tree =>
    JSON.parse(readFileSync(join(dir, locale, `${ns}.json`), "utf8")) as Tree;

  const readHashes = () => {
    try {
      return JSON.parse(readFileSync(join(dir, "_hashes.json"), "utf8"));
    } catch {
      return {};
    }
  };

  const run = (script: string) => {
    try {
      const stdout = execFileSync(TSX_BIN, [script], {
        cwd: REPO_ROOT,
        env: { ...process.env, I18N_MESSAGES_DIR: dir },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return { code: 0, stdout, stderr: "" };
    } catch (err) {
      const e = err as {
        status?: number;
        stdout?: Buffer | string;
        stderr?: Buffer | string;
      };
      return {
        code: e.status ?? 1,
        stdout: e.stdout ? e.stdout.toString() : "",
        stderr: e.stderr ? e.stderr.toString() : "",
      };
    }
  };

  return {
    dir,
    hashesPath: join(dir, "_hashes.json"),
    writeNs,
    readNs,
    readHashes,
    runCheck: () => run(CHECK_SCRIPT),
    runSync: () => run(SYNC_SCRIPT),
  };
}

describe("i18n scripts (integration)", () => {
  let fx: Fixture;

  beforeEach(() => {
    fx = makeFixture();
  });

  afterEach(() => {
    rmSync(fx.dir, { recursive: true, force: true });
  });

  it("clean state — every key translated + hashed → check exits 0", () => {
    fx.writeNs("en", "common", { hello: "Hello", bye: "Bye" });
    fx.writeNs("nl-BE", "common", { hello: "Hallo", bye: "Tot ziens" });
    writeFileSync(
      fx.hashesPath,
      JSON.stringify(
        {
          "nl-BE": {
            common: { hello: hash("Hello"), bye: hash("Bye") },
          },
        },
        null,
        2,
      ),
      "utf8",
    );
    const { code, stdout } = fx.runCheck();
    expect(code).toBe(0);
    expect(stdout).toMatch(/in sync/);
  });

  it("EN gets a new key → check reports `missing`; sync inserts a TODO; check then reports `todo`", () => {
    fx.writeNs("en", "common", { hello: "Hello", farewell: "Farewell" });
    fx.writeNs("nl-BE", "common", { hello: "Hallo" });
    writeFileSync(
      fx.hashesPath,
      JSON.stringify(
        { "nl-BE": { common: { hello: hash("Hello") } } },
        null,
        2,
      ),
      "utf8",
    );

    // 1. check sees `missing`.
    const r1 = fx.runCheck();
    expect(r1.code).toBe(1);
    expect(r1.stderr).toMatch(/missing/);
    expect(r1.stderr).toMatch(/common\.farewell/);

    // 2. sync inserts a TODO placeholder for the missing key.
    const r2 = fx.runSync();
    expect(r2.code).toBe(0);
    expect(r2.stdout).toMatch(/\+1 added/);
    const nl = fx.readNs("nl-BE", "common") as Record<string, string>;
    expect(nl.farewell).toBe(`${TODO_PREFIX} en: Farewell]`);
    // sync must NOT record a hash for an untranslated TODO entry.
    const hashes = fx.readHashes();
    expect(hashes["nl-BE"].common.farewell).toBeUndefined();

    // 3. check now reports `todo` for the new key (and not `missing`).
    const r3 = fx.runCheck();
    expect(r3.code).toBe(1);
    expect(r3.stderr).toMatch(/todo/);
    expect(r3.stderr).toMatch(/common\.farewell/);
    expect(r3.stderr).not.toMatch(/missing/);
  });

  it("translating a TODO + sync → hash is recorded → check passes", () => {
    fx.writeNs("en", "common", { hello: "Hello" });
    fx.writeNs("nl-BE", "common", { hello: `${TODO_PREFIX} en: Hello]` });
    writeFileSync(fx.hashesPath, "{}", "utf8");

    // sync over an untranslated state records nothing (TODO is skipped).
    const r1 = fx.runSync();
    expect(r1.code).toBe(0);
    expect(fx.readHashes()).toEqual({ "nl-BE": { common: {} } });

    // Translator replaces the TODO with a real translation.
    fx.writeNs("nl-BE", "common", { hello: "Hallo" });

    // sync records the sidecar hash on first translation.
    const r2 = fx.runSync();
    expect(r2.code).toBe(0);
    expect(r2.stdout).toMatch(/1 hash\(es\) recorded/);
    expect(fx.readHashes()["nl-BE"].common.hello).toBe(hash("Hello"));

    // check is now clean.
    const r3 = fx.runCheck();
    expect(r3.code).toBe(0);
  });

  // The headline regression test. An older version of `sync` would refresh
  // existing sidecar hashes and silently certify a stale translation as in
  // sync. Sync must NEVER overwrite an existing hash.
  it("EN edited after translation → check reports `stale`; sync does NOT rewrite the sidecar hash", () => {
    fx.writeNs("en", "common", { hello: "Hello" });
    fx.writeNs("nl-BE", "common", { hello: "Hallo" });
    const originalHash = hash("Hello");
    writeFileSync(
      fx.hashesPath,
      JSON.stringify({ "nl-BE": { common: { hello: originalHash } } }, null, 2),
      "utf8",
    );

    // Editor changes the EN copy after translation has shipped.
    fx.writeNs("en", "common", { hello: "Hello there" });

    // check reports stale with both hashes in the detail line.
    const r1 = fx.runCheck();
    expect(r1.code).toBe(1);
    expect(r1.stderr).toMatch(/stale/);
    expect(r1.stderr).toMatch(/common\.hello/);
    expect(r1.stderr).toMatch(originalHash);
    expect(r1.stderr).toMatch(hash("Hello there"));

    // sync runs cleanly but MUST leave the sidecar hash untouched.
    const r2 = fx.runSync();
    expect(r2.code).toBe(0);
    expect(r2.stdout).toMatch(/0 hash\(es\) recorded/);
    expect(fx.readHashes()["nl-BE"].common.hello).toBe(originalHash);

    // check still reports stale — staleness was not silenced.
    const r3 = fx.runCheck();
    expect(r3.code).toBe(1);
    expect(r3.stderr).toMatch(/stale/);
  });

  // Bug 1 regression. When EN has a key, the locale lacks it, AND the
  // sidecar still records a hash for that key, an older `check` reported
  // it as both `missing` (EN side) and `extra` (sidecar side). It should
  // be reported exactly once, as `missing`.
  it("missing key with stale sidecar → reported once as `missing`, not also `extra`", () => {
    fx.writeNs("en", "home", { foo: "Foo", bar: "Bar" });
    // Locale lacks `foo` entirely.
    fx.writeNs("nl-BE", "home", { bar: "Bar" });
    // Sidecar still records a hash for `foo` (raw / hand-edited state).
    writeFileSync(
      fx.hashesPath,
      JSON.stringify(
        {
          "nl-BE": {
            home: { foo: hash("Foo"), bar: hash("Bar") },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const r = fx.runCheck();
    expect(r.code).toBe(1);
    expect(r.stderr).toMatch(/missing/);
    // The (locale, ns, key) triple appears exactly once across the report.
    const occurrences = (r.stderr.match(/home\.foo/g) ?? []).length;
    expect(occurrences).toBe(1);
    // And specifically NOT under the `extra` heading.
    expect(r.stderr).not.toMatch(/extra[\s\S]*home\.foo/);
  });

  // Bug 2 regression. If a non-EN locale is missing a whole namespace file,
  // the script used to die with an unhelpful ENOENT. It should report a
  // typed `namespace-missing` issue and continue; sync should create the
  // file populated with TODO placeholders for every EN key in that ns.
  it("locale missing a whole namespace → check reports `namespace-missing`; sync creates the file with TODOs", () => {
    fx.writeNs("en", "common", { hello: "Hello" });
    fx.writeNs("en", "somenamespace", { a: "Alpha", b: "Beta" });
    // nl-BE has `common` but NOT `somenamespace`.
    fx.writeNs("nl-BE", "common", { hello: "Hallo" });
    writeFileSync(
      fx.hashesPath,
      JSON.stringify(
        { "nl-BE": { common: { hello: hash("Hello") } } },
        null,
        2,
      ),
      "utf8",
    );

    const r1 = fx.runCheck();
    expect(r1.code).toBe(1);
    // Typed kind, not a raw fs error.
    expect(r1.stderr).toMatch(/namespace-missing/);
    expect(r1.stderr).toMatch(/somenamespace/);
    expect(r1.stderr).toMatch(/nl-BE/);
    // ENOENT must NOT leak to the user.
    expect(r1.stderr).not.toMatch(/ENOENT/);

    // sync creates the file populated with TODO placeholders.
    const r2 = fx.runSync();
    expect(r2.code).toBe(0);
    const created = fx.readNs("nl-BE", "somenamespace") as Record<
      string,
      string
    >;
    expect(created).toEqual({
      a: `${TODO_PREFIX} en: Alpha]`,
      b: `${TODO_PREFIX} en: Beta]`,
    });
  });

  it("EN drops a key → check reports `orphan`; sync removes the key + drops the sidecar entry", () => {
    fx.writeNs("en", "common", { keep: "Keep" });
    fx.writeNs("nl-BE", "common", { keep: "Behouden", drop: "Verwijderen" });
    writeFileSync(
      fx.hashesPath,
      JSON.stringify(
        {
          "nl-BE": {
            common: { keep: hash("Keep"), drop: hash("Drop") },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    // check reports an orphan for the locale-only key.
    const r1 = fx.runCheck();
    expect(r1.code).toBe(1);
    expect(r1.stderr).toMatch(/orphan/);
    expect(r1.stderr).toMatch(/common\.drop/);

    // sync removes the orphan key + drops its sidecar hash.
    const r2 = fx.runSync();
    expect(r2.code).toBe(0);
    expect(r2.stdout).toMatch(/-1 removed/);
    const nl = fx.readNs("nl-BE", "common") as Record<string, string>;
    expect(nl).toEqual({ keep: "Behouden" });
    expect(fx.readHashes()["nl-BE"].common).toEqual({ keep: hash("Keep") });

    // check is now clean.
    const r3 = fx.runCheck();
    expect(r3.code).toBe(0);
  });
});
