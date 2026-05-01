import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { SITE_URL } from "@/lib/site";
import { SERVICE_KEYS } from "@/lib/mockData";
import { routing, urlPrefixFor } from "@/i18n/routing";

// Pin the clock so `lastModified` is deterministic for the inline snapshot.
const FIXED_NOW = new Date("2026-04-30T12:00:00.000Z");

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe("sitemap", () => {
  it("emits structurally-correct entries", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    const entries = sitemap();

    // Every entry has the documented Next.js sitemap shape.
    for (const e of entries) {
      expect(e).toHaveProperty("url");
      expect(e).toHaveProperty("lastModified");
      expect(e).toHaveProperty("changeFrequency");
      expect(e).toHaveProperty("priority");
      expect(e.alternates?.languages).toBeTruthy();
    }

    // Group entries by the path-portion (after the locale prefix). Every
    // path should appear exactly once per locale.
    const pathBuckets = new Map<string, Set<string>>();
    for (const e of entries) {
      let pathOnly = e.url.replace(SITE_URL, "");
      // Strip the locale prefix to get the canonical path.
      let matchedLocale: string | null = null;
      for (const locale of routing.locales) {
        const prefix = urlPrefixFor(locale);
        if (pathOnly === prefix) {
          pathOnly = "/";
          matchedLocale = locale;
          break;
        }
        if (pathOnly.startsWith(`${prefix}/`)) {
          pathOnly = pathOnly.slice(prefix.length);
          matchedLocale = locale;
          break;
        }
      }
      expect(matchedLocale).not.toBeNull();
      const bucket = pathBuckets.get(pathOnly) ?? new Set<string>();
      bucket.add(matchedLocale!);
      pathBuckets.set(pathOnly, bucket);
    }

    // Each path should have one entry per locale.
    for (const [, locales] of pathBuckets) {
      expect(locales.size).toBe(routing.locales.length);
    }

    // Total = paths × locales.
    const expectedPathCount = 4 + SERVICE_KEYS.length + 3; // /, /about, /contact, /register + services + 3 legal
    expect(pathBuckets.size).toBe(expectedPathCount);
    expect(entries.length).toBe(expectedPathCount * routing.locales.length);

    // alternates.languages keys = routing.locales ∪ {"x-default"}.
    const expectedKeys = new Set<string>([...routing.locales, "x-default"]);
    for (const e of entries) {
      const keys = new Set(Object.keys(e.alternates!.languages!));
      expect(keys).toEqual(expectedKeys);
      // x-default URL = default-locale URL for the same path.
      expect(e.alternates!.languages!["x-default"]).toBe(
        e.alternates!.languages![routing.defaultLocale],
      );
    }

    // All URLs begin with SITE_URL.
    for (const e of entries) {
      expect(e.url.startsWith(SITE_URL)).toBe(true);
    }

    // Homepage shape: /nl, not /nl/. The unprefixed homepage entry for
    // the default locale must equal `${SITE_URL}/nl` exactly.
    const homepageDefault = entries.find(
      (e) => e.url === `${SITE_URL}${urlPrefixFor(routing.defaultLocale)}`,
    );
    expect(homepageDefault).toBeTruthy();
    // And no entry should have a trailing-slash homepage shape.
    for (const e of entries) {
      for (const locale of routing.locales) {
        const prefix = urlPrefixFor(locale);
        expect(e.url).not.toBe(`${SITE_URL}${prefix}/`);
      }
    }
  });

  it("matches the regression snapshot", async () => {
    const sitemap = (await import("@/app/sitemap")).default;
    // Normalise lastModified to a fixed string so the snapshot is stable
    // even if the `new Date()` construction in the SUT picks up a slightly
    // different ms value than the fake-timer pin (it shouldn't, but belt
    // and braces against drift).
    const normalised = sitemap().map((e) => ({
      ...e,
      lastModified: "2026-04-30T12:00:00.000Z",
    }));
    expect(normalised).toMatchInlineSnapshot(`
      [
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en",
              "nl-BE": "http://localhost:3000/nl",
              "x-default": "http://localhost:3000/nl",
            },
          },
          "changeFrequency": "weekly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 1,
          "url": "http://localhost:3000/en",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en",
              "nl-BE": "http://localhost:3000/nl",
              "x-default": "http://localhost:3000/nl",
            },
          },
          "changeFrequency": "weekly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 1,
          "url": "http://localhost:3000/nl",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/about",
              "nl-BE": "http://localhost:3000/nl/about",
              "x-default": "http://localhost:3000/nl/about",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.8,
          "url": "http://localhost:3000/en/about",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/about",
              "nl-BE": "http://localhost:3000/nl/about",
              "x-default": "http://localhost:3000/nl/about",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.8,
          "url": "http://localhost:3000/nl/about",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/contact",
              "nl-BE": "http://localhost:3000/nl/contact",
              "x-default": "http://localhost:3000/nl/contact",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.5,
          "url": "http://localhost:3000/en/contact",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/contact",
              "nl-BE": "http://localhost:3000/nl/contact",
              "x-default": "http://localhost:3000/nl/contact",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.5,
          "url": "http://localhost:3000/nl/contact",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/epc",
              "nl-BE": "http://localhost:3000/nl/services/epc",
              "x-default": "http://localhost:3000/nl/services/epc",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/epc",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/epc",
              "nl-BE": "http://localhost:3000/nl/services/epc",
              "x-default": "http://localhost:3000/nl/services/epc",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/epc",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/asbestos",
              "nl-BE": "http://localhost:3000/nl/services/asbestos",
              "x-default": "http://localhost:3000/nl/services/asbestos",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/asbestos",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/asbestos",
              "nl-BE": "http://localhost:3000/nl/services/asbestos",
              "x-default": "http://localhost:3000/nl/services/asbestos",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/asbestos",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/electrical",
              "nl-BE": "http://localhost:3000/nl/services/electrical",
              "x-default": "http://localhost:3000/nl/services/electrical",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/electrical",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/electrical",
              "nl-BE": "http://localhost:3000/nl/services/electrical",
              "x-default": "http://localhost:3000/nl/services/electrical",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/electrical",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/fuel",
              "nl-BE": "http://localhost:3000/nl/services/fuel",
              "x-default": "http://localhost:3000/nl/services/fuel",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/fuel",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/fuel",
              "nl-BE": "http://localhost:3000/nl/services/fuel",
              "x-default": "http://localhost:3000/nl/services/fuel",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/fuel",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/photos",
              "nl-BE": "http://localhost:3000/nl/services/photos",
              "x-default": "http://localhost:3000/nl/services/photos",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/photos",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/photos",
              "nl-BE": "http://localhost:3000/nl/services/photos",
              "x-default": "http://localhost:3000/nl/services/photos",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/photos",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/signage",
              "nl-BE": "http://localhost:3000/nl/services/signage",
              "x-default": "http://localhost:3000/nl/services/signage",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/en/services/signage",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/services/signage",
              "nl-BE": "http://localhost:3000/nl/services/signage",
              "x-default": "http://localhost:3000/nl/services/signage",
            },
          },
          "changeFrequency": "monthly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.9,
          "url": "http://localhost:3000/nl/services/signage",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/privacy",
              "nl-BE": "http://localhost:3000/nl/legal/privacy",
              "x-default": "http://localhost:3000/nl/legal/privacy",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/en/legal/privacy",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/privacy",
              "nl-BE": "http://localhost:3000/nl/legal/privacy",
              "x-default": "http://localhost:3000/nl/legal/privacy",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/nl/legal/privacy",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/terms",
              "nl-BE": "http://localhost:3000/nl/legal/terms",
              "x-default": "http://localhost:3000/nl/legal/terms",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/en/legal/terms",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/terms",
              "nl-BE": "http://localhost:3000/nl/legal/terms",
              "x-default": "http://localhost:3000/nl/legal/terms",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/nl/legal/terms",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/cookies",
              "nl-BE": "http://localhost:3000/nl/legal/cookies",
              "x-default": "http://localhost:3000/nl/legal/cookies",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/en/legal/cookies",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/legal/cookies",
              "nl-BE": "http://localhost:3000/nl/legal/cookies",
              "x-default": "http://localhost:3000/nl/legal/cookies",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.3,
          "url": "http://localhost:3000/nl/legal/cookies",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/register",
              "nl-BE": "http://localhost:3000/nl/register",
              "x-default": "http://localhost:3000/nl/register",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.6,
          "url": "http://localhost:3000/en/register",
        },
        {
          "alternates": {
            "languages": {
              "en": "http://localhost:3000/en/register",
              "nl-BE": "http://localhost:3000/nl/register",
              "x-default": "http://localhost:3000/nl/register",
            },
          },
          "changeFrequency": "yearly",
          "lastModified": "2026-04-30T12:00:00.000Z",
          "priority": 0.6,
          "url": "http://localhost:3000/nl/register",
        },
      ]
    `);
  });
});
