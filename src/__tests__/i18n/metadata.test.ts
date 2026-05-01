import { beforeEach, describe, expect, it, vi } from "vitest";

// `buildLocaleAlternates` calls `getLocale()` from `next-intl/server` to know
// which locale is "active" (so canonical can point at the current page,
// while `languages` enumerates every locale's URL of the same path). The
// real `getLocale` reads request-scoped config — only the framework
// dispatcher sets that up. We mock it here so each test can pin the
// "active" locale explicitly.
//
// Note: vitest.config.ts already aliases `next-intl/server` to a stub that
// returns the routing default. `vi.mock` overrides that alias inside this
// test's module graph, which is exactly what we want — full control over
// the active locale per test, no reliance on the global default.
const { getLocaleMock } = vi.hoisted(() => ({
  getLocaleMock: vi.fn<() => Promise<string>>(),
}));
vi.mock("next-intl/server", () => ({
  getLocale: getLocaleMock,
}));

import { buildLocaleAlternates } from "@/i18n/metadata";

beforeEach(() => {
  getLocaleMock.mockReset();
});

describe("buildLocaleAlternates — homepage", () => {
  it("emits prefix-only URLs (no trailing slash) when active locale is nl-BE", async () => {
    getLocaleMock.mockResolvedValueOnce("nl-BE");

    const alternates = await buildLocaleAlternates("/");

    expect(alternates).toEqual({
      canonical: "/nl",
      languages: {
        en: "/en",
        "nl-BE": "/nl",
        "x-default": "/nl",
      },
    });
  });

  it("flips canonical to /en when the active locale is English", async () => {
    getLocaleMock.mockResolvedValueOnce("en");

    const alternates = await buildLocaleAlternates("/");

    expect(alternates.canonical).toBe("/en");
    // x-default still points at the default locale's URL — independent of
    // which page the user is currently viewing.
    expect(alternates.languages["x-default"]).toBe("/nl");
    expect(alternates.languages.en).toBe("/en");
    expect(alternates.languages["nl-BE"]).toBe("/nl");
  });
});

describe("buildLocaleAlternates — deep page", () => {
  it("preserves the path under each locale prefix", async () => {
    getLocaleMock.mockResolvedValueOnce("en");

    const alternates = await buildLocaleAlternates("/services/epc");

    expect(alternates).toEqual({
      canonical: "/en/services/epc",
      languages: {
        en: "/en/services/epc",
        "nl-BE": "/nl/services/epc",
        "x-default": "/nl/services/epc",
      },
    });
  });

  it("x-default mirrors the default locale's URL of the same deep path", async () => {
    getLocaleMock.mockResolvedValueOnce("en");

    const alternates = await buildLocaleAlternates("/legal/privacy");

    expect(alternates.languages["x-default"]).toBe(
      alternates.languages["nl-BE"],
    );
    expect(alternates.languages["x-default"]).toBe("/nl/legal/privacy");
  });
});

describe("buildLocaleAlternates — normalizePath boundaries", () => {
  // `normalizePath` is a private helper, but its behavior is observable
  // through the alternates output. Each pair below should produce the
  // SAME set of URLs — the helper exists precisely so callers don't have
  // to be careful about the input shape.

  it("treats empty string the same as '/'", async () => {
    getLocaleMock.mockResolvedValueOnce("nl-BE");
    const a = await buildLocaleAlternates("");
    getLocaleMock.mockResolvedValueOnce("nl-BE");
    const b = await buildLocaleAlternates("/");

    expect(a).toEqual(b);
    expect(a.canonical).toBe("/nl"); // never `/nl/`
  });

  it("tolerates a missing leading slash ('about' === '/about')", async () => {
    getLocaleMock.mockResolvedValueOnce("nl-BE");
    const a = await buildLocaleAlternates("about");
    getLocaleMock.mockResolvedValueOnce("nl-BE");
    const b = await buildLocaleAlternates("/about");

    expect(a).toEqual(b);
    expect(a.canonical).toBe("/nl/about");
  });

  it("strips a trailing slash ('/about/' === '/about')", async () => {
    getLocaleMock.mockResolvedValueOnce("en");
    const a = await buildLocaleAlternates("/about/");
    getLocaleMock.mockResolvedValueOnce("en");
    const b = await buildLocaleAlternates("/about");

    expect(a).toEqual(b);
    expect(a.canonical).toBe("/en/about");
  });

  it("normalizes a deep trailing-slash path without producing double slashes", async () => {
    getLocaleMock.mockResolvedValueOnce("en");
    const alternates = await buildLocaleAlternates("/services/epc/");

    // Critical: no `//` anywhere, and no trailing `/` on locale-prefix URLs.
    for (const url of Object.values(alternates.languages)) {
      expect(url).not.toMatch(/\/\//);
      expect(url).not.toMatch(/\/$/);
    }
    expect(alternates.canonical).toBe("/en/services/epc");
  });
});

describe("buildLocaleAlternates — x-default invariant", () => {
  it("x-default always points at the default locale's URL of the same path, regardless of active locale", async () => {
    for (const active of ["en", "nl-BE"] as const) {
      getLocaleMock.mockResolvedValueOnce(active);
      const alternates = await buildLocaleAlternates("/services/asbestos");
      expect(alternates.languages["x-default"]).toBe(
        "/nl/services/asbestos",
      );
    }
  });
});
