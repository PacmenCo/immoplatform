import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireAppUrl } from "@/lib/calendar/config";

// `requireAppUrl()` builds calendar OAuth redirect URIs and the success/error
// redirect targets in /api/calendar/add-to-google. The codebase uses two env
// var names interchangeably across files (APP_URL in src/lib/urls.ts +
// src/lib/storage/index.ts vs NEXT_PUBLIC_APP_URL in this helper), and
// .env.example only uncomments APP_URL. Without a fallback, dev admins hit
// a 500 when they hover the "Add to my calendar" button. Production deploys
// generally set NEXT_PUBLIC_APP_URL, so the precedence stays the same: prefer
// NEXT_PUBLIC_APP_URL when present, fall back to APP_URL when only that is
// set, throw only when neither is configured.

describe("requireAppUrl", () => {
  let originalNextPublic: string | undefined;
  let originalApp: string | undefined;

  beforeEach(() => {
    originalNextPublic = process.env.NEXT_PUBLIC_APP_URL;
    originalApp = process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.APP_URL;
  });

  afterEach(() => {
    if (originalNextPublic === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = originalNextPublic;
    if (originalApp === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalApp;
  });

  it("prefers NEXT_PUBLIC_APP_URL when both are set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://nextpublic.example.com";
    process.env.APP_URL = "https://app.example.com";
    expect(requireAppUrl()).toBe("https://nextpublic.example.com");
  });

  it("returns NEXT_PUBLIC_APP_URL with trailing slash stripped", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://nextpublic.example.com/";
    expect(requireAppUrl()).toBe("https://nextpublic.example.com");
  });

  it("falls back to APP_URL when NEXT_PUBLIC_APP_URL is unset", () => {
    process.env.APP_URL = "http://localhost:3000";
    expect(requireAppUrl()).toBe("http://localhost:3000");
  });

  it("falls back to APP_URL with trailing slash stripped", () => {
    process.env.APP_URL = "http://localhost:3000/";
    expect(requireAppUrl()).toBe("http://localhost:3000");
  });

  it("treats empty string as unset (falls back to APP_URL)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.APP_URL = "http://localhost:3000";
    expect(requireAppUrl()).toBe("http://localhost:3000");
  });

  it("throws when neither var is set", () => {
    expect(() => requireAppUrl()).toThrow(/APP_URL/);
  });

  it("throws when both are set to empty strings", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.APP_URL = "";
    expect(() => requireAppUrl()).toThrow(/APP_URL/);
  });
});
