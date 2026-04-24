import { beforeEach, describe, expect, it } from "vitest";
import { requireRoleOrRedirect } from "@/lib/auth";
import { setupTestDb } from "../_helpers/db";
import {
  __resetRequestContext,
  __setCookie,
} from "../_helpers/next-headers-stub";
import { captureRedirect } from "../_helpers/next-navigation-stub";
import { makeSession } from "../_helpers/session";

setupTestDb();

beforeEach(() => {
  __resetRequestContext();
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

  it("redirects disallowed role to /no-access with the given section", async () => {
    const s = await makeSession({ role: "freelancer" });
    __setCookie("immo_session", s.id);

    const url = await captureRedirect(() =>
      requireRoleOrRedirect(["admin", "staff", "realtor"], "invite"),
    );

    expect(url).toBe("/no-access?section=invite");
  });

  it("redirects when no roles are allowed (empty list)", async () => {
    const s = await makeSession({ role: "admin" });
    __setCookie("immo_session", s.id);

    const url = await captureRedirect(() =>
      requireRoleOrRedirect([], "admin"),
    );

    expect(url).toBe("/no-access?section=admin");
  });
});
