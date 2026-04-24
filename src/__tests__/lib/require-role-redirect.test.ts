import { beforeEach, describe, expect, it } from "vitest";
import { noAccessPath, requireRoleOrRedirect } from "@/lib/auth";
import { setupTestDb } from "../_helpers/db";
import {
  __resetRequestContext,
  __setCookie,
} from "../_helpers/next-headers-stub";
import {
  captureRedirect,
  NextRedirectError,
} from "../_helpers/next-navigation-stub";
import { makeSession } from "../_helpers/session";

// Shared gate helper — replaces the repeated pattern
//   const s = await requireSession();
//   if (!hasRole(s, ...roles)) redirect("/no-access?section=…");
// across dashboard/users/invite, dashboard/teams, dashboard/assignments/new.
// Tests target behavior, not structure: returns session on match, throws
// NextRedirectError with the /no-access URL on mismatch.

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
});

describe("noAccessPath", () => {
  it("builds /no-access?section=<section>", () => {
    expect(noAccessPath("teams")).toBe("/no-access?section=teams");
    expect(noAccessPath("invite")).toBe("/no-access?section=invite");
    expect(noAccessPath("new-assignment")).toBe(
      "/no-access?section=new-assignment",
    );
  });
});

describe("requireRoleOrRedirect", () => {
  it("returns the session when the user has the allowed role", async () => {
    const s = await makeSession({ role: "admin" });
    __setCookie("immo_session", s.id);

    const result = await requireRoleOrRedirect(["admin", "staff"], "users");

    expect(result.id).toBe(s.id);
    expect(result.user.id).toBe(s.user.id);
    expect(result.user.role).toBe("admin");
  });

  it("accepts any role in the list (realtor among admin/staff/realtor)", async () => {
    const s = await makeSession({ role: "realtor" });
    __setCookie("immo_session", s.id);

    const result = await requireRoleOrRedirect(
      ["admin", "staff", "realtor"],
      "new-assignment",
    );

    expect(result.user.role).toBe("realtor");
  });

  it("redirects freelancer to /no-access with the given section", async () => {
    const s = await makeSession({ role: "freelancer" });
    __setCookie("immo_session", s.id);

    const url = await captureRedirect(() =>
      requireRoleOrRedirect(["admin", "staff", "realtor"], "invite"),
    );

    expect(url).toBe("/no-access?section=invite");
  });

  it("preserves the section param verbatim in the redirect URL", async () => {
    const s = await makeSession({ role: "freelancer" });
    __setCookie("immo_session", s.id);

    const url = await captureRedirect(() =>
      requireRoleOrRedirect(["admin"], "teams"),
    );

    expect(url).toBe("/no-access?section=teams");
  });

  it("throws a NextRedirectError (so callers stop executing)", async () => {
    const s = await makeSession({ role: "freelancer" });
    __setCookie("immo_session", s.id);

    await expect(
      requireRoleOrRedirect(["admin"], "teams"),
    ).rejects.toBeInstanceOf(NextRedirectError);
  });

  it("redirects when no roles are allowed (empty list)", async () => {
    const s = await makeSession({ role: "admin" });
    __setCookie("immo_session", s.id);

    const url = await captureRedirect(() =>
      requireRoleOrRedirect([], "anywhere"),
    );

    expect(url).toBe("/no-access?section=anywhere");
  });
});
