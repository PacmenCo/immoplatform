import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { SessionWithUser } from "@/lib/auth";
import { resetDb, disconnectDb } from "../_helpers/db";
import { makeSession } from "../_helpers/session";
import { captureRedirect } from "../_helpers/next-navigation-stub";

// v1 parity (Platform/routes/web.php:67-74): personal Google calendar OAuth
// is gated to `admin` and `medewerker` roles. v2 mirrors via `admin` and
// `staff`. Realtors and freelancers do NOT get personal calendar OAuth in
// v1; the v2 route at /api/oauth/google/initiate enforces this with a 403
// before any state cookie is written or any Google redirect URL is built.
//
// Flow-parity batch 6 verified Tim (freelancer) is correctly blocked
// end-to-end via Playwright. These tests pin the contract at the unit
// level so a permission refactor can't silently regress it.

let currentSession: SessionWithUser | null = null;

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    requireSession: async () => {
      if (!currentSession) throw new Error("UNAUTHENTICATED");
      return currentSession;
    },
    getSession: async () => currentSession,
  };
});

import { GET } from "@/app/api/oauth/google/initiate/route";

describe("GET /api/oauth/google/initiate — role gate", () => {
  beforeEach(async () => {
    await resetDb();
    currentSession = null;
  });
  afterAll(async () => {
    await disconnectDb();
  });

  it("freelancer → 403 with role-gated message", async () => {
    currentSession = await makeSession({ role: "freelancer", userId: "u_fr_oauth" });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/admin and staff/i);
  });

  it("realtor → 403 with role-gated message", async () => {
    currentSession = await makeSession({ role: "realtor", userId: "u_re_oauth" });
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.text()).toMatch(/admin and staff/i);
  });

  it("admin → 501 when GOOGLE_OAUTH_CLIENT_ID is unset (passes role gate, fails config check)", async () => {
    // Test env doesn't set GOOGLE_OAUTH_CLIENT_ID, so isGooglePersonalConfigured()
    // returns false. Admin clears the role gate but lands on the config gate.
    // This proves the role gate runs FIRST (no info leak about config status
    // to non-admin users).
    currentSession = await makeSession({ role: "admin", userId: "u_admin_oauth" });
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "");
    try {
      const res = await GET();
      expect(res.status).toBe(501);
      expect(await res.text()).toMatch(/not configured/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("staff → 501 when GOOGLE_OAUTH_CLIENT_ID is unset (passes role gate, fails config check)", async () => {
    currentSession = await makeSession({ role: "staff", userId: "u_staff_oauth" });
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "");
    try {
      const res = await GET();
      expect(res.status).toBe(501);
      expect(await res.text()).toMatch(/not configured/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("admin with full config → redirects to accounts.google.com with state param + scope", async () => {
    currentSession = await makeSession({ role: "admin", userId: "u_admin_oauth_ok" });
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "test-client-id");
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test-client-secret");
    try {
      const target = await captureRedirect(() => GET());
      expect(target).toMatch(/^https:\/\/accounts\.google\.com\//);
      expect(target).toContain("state=");
      expect(target).toContain("calendar.events");
      expect(target).toContain("access_type=offline");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
