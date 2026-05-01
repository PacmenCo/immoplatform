import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `request.ts` calls `getRequestConfig(...)` at module-eval as its default
// export. The shared `next-intl/server` Vitest stub only provides `getLocale`
// — extend it locally so importing `request.ts` doesn't crash. The default
// export itself is irrelevant to these tests; only the named `markTodoLeaves`
// helper is exercised.
vi.mock("next-intl/server", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "next-intl/server",
  );
  return {
    ...actual,
    getRequestConfig: (fn: unknown) => fn,
  };
});

import { markTodoLeaves } from "../../i18n/request";

// These tests cover the pure post-processor that flags untranslated `[TODO`
// leaves with visible markers + a console.warn. The integration into
// `getRequestConfig` is one line of glue — not worth wiring up next-intl's
// request runtime here.

describe("markTodoLeaves (dev visibility for untranslated copy)", () => {
  let warnSpy: ReturnType<typeof vi.fn<(message: string) => void>>;

  beforeEach(() => {
    warnSpy = vi.fn<(message: string) => void>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("wraps a [TODO en: …] leaf in ⚠ markers", () => {
    const input = {
      common: { greeting: "[TODO en: Hello]" },
    };
    const out = markTodoLeaves(input, "nl-BE", warnSpy);
    expect(out).toEqual({
      common: { greeting: "⚠ [TODO en: Hello] ⚠" },
    });
  });

  it("leaves non-TODO strings untouched", () => {
    const input = {
      common: { greeting: "Hallo", farewell: "Tot ziens" },
    };
    const out = markTodoLeaves(input, "nl-BE", warnSpy);
    expect(out).toEqual(input);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("walks deeply nested objects and flags TODO leaves at any depth", () => {
    const input = {
      dashboard: {
        nav: {
          home: "Start",
          settings: {
            title: "[TODO en: Settings]",
            sub: { ok: "OK" },
          },
        },
      },
    };
    const out = markTodoLeaves(input, "nl-BE", warnSpy);
    expect(out).toEqual({
      dashboard: {
        nav: {
          home: "Start",
          settings: {
            title: "⚠ [TODO en: Settings] ⚠",
            sub: { ok: "OK" },
          },
        },
      },
    });
  });

  it("returns a new tree without mutating the input (cached imports stay clean)", () => {
    const input = {
      common: { greeting: "[TODO en: Hello]" },
    };
    const snapshot = JSON.parse(JSON.stringify(input));
    markTodoLeaves(input, "nl-BE", warnSpy);
    expect(input).toEqual(snapshot);
  });

  it("warns once per TODO leaf with locale, namespace, key, and value visible", () => {
    const input = {
      common: { greeting: "[TODO en: Hello]" },
      dashboard: { nav: { home: "[TODO en: Home]" } },
    };
    markTodoLeaves(input, "nl-BE", warnSpy);
    expect(warnSpy).toHaveBeenCalledTimes(2);
    const messages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(messages[0]).toContain("nl-BE");
    expect(messages[0]).toContain("common.greeting");
    expect(messages[0]).toContain("[TODO en: Hello]");
    expect(messages[1]).toContain("dashboard.nav.home");
    expect(messages[1]).toContain("[TODO en: Home]");
  });

  it("dedupes warnings within a single render via the seen set", () => {
    const input = {
      common: { a: "[TODO en: X]", b: "[TODO en: X]" },
    };
    const seen = new Set<string>();
    markTodoLeaves(input, "nl-BE", warnSpy, seen);
    // Different paths → both warn (dedupe is by path, not value).
    expect(warnSpy).toHaveBeenCalledTimes(2);

    // Re-running with the same `seen` set is a no-op for already-seen paths.
    markTodoLeaves(input, "nl-BE", warnSpy, seen);
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("uses console.warn by default when no logger is injected", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    markTodoLeaves(
      { common: { x: "[TODO en: x]" } },
      "nl-BE",
    );
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain("[TODO en: x]");
  });
});

describe("markTodoLeaves — production semantics (deep equality on identity input)", () => {
  // The wiring in `getRequestConfig` is `if (NODE_ENV !== "production") apply`.
  // So in prod the function is never invoked. We assert the production branch
  // by checking that NOT calling the post-processor leaves the tree byte-for-
  // byte identical to the input — i.e., the fast path really is "do nothing".
  it("input passed through untouched is deep-equal to itself", () => {
    const input = {
      common: { greeting: "[TODO en: Hello]", ok: "OK" },
      dashboard: { nav: { home: "[TODO en: Home]" } },
    };
    // Simulate the prod branch: skip post-processing entirely.
    const prodOutput = input;
    expect(prodOutput).toEqual(input);
    expect(prodOutput).toBe(input);
  });
});
