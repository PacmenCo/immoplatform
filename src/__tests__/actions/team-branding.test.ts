import { describe, expect, it } from "vitest";
import {
  uploadTeamBrandingInner,
  removeTeamBrandingInner,
} from "@/app/actions/teamBranding";
import {
  TEAM_LOGO_MAX_BYTES,
  TEAM_SIGNATURE_MAX_BYTES,
} from "@/lib/teamBranding";
import { prisma, setupTestDb, auditMeta } from "../_helpers/db";
import { seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Covers:
//   1. uploadTeamBranding — permission gate (admin/owner only), MIME + size
//      rules, SVG active-content sanitizer, old-key cleanup on replace.
//   2. removeTeamBranding — idempotent no-op when no current key, audit
//      emitted on success.
//
// Platform parity: Platform allows same format set. The SVG sanitizer is
// an immo-side defense-in-depth that Platform doesn't have — we test it
// hard because it's the main attack surface.

setupTestDb();

function form(key: string, file: File): FormData {
  const fd = new FormData();
  fd.set(key, file);
  return fd;
}

function makeImageFile(mime: string, size: number): File {
  return new File([new Uint8Array(size)], "a.png", { type: mime });
}

describe("uploadTeamBrandingInner — logo path", () => {
  it("admin uploads PNG → stored + DB column set + audit", async () => {
    const { admin, teams } = await seedBaseline();
    const png = makeImageFile("image/png", 10_000);
    const res = await uploadTeamBrandingInner(admin, teams.t1.id, "logo", form("logo", png));
    expect(res).toEqual({ ok: true });
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teams.t1.id } });
    expect(team.logoUrl).toMatch(/^teams\//);
    expect(team.logoUrl).toMatch(/\/logo\//);
    expect(team.logoUrl).toMatch(/\.png$/);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { actorId: admin.user.id, verb: "team.updated", objectId: teams.t1.id },
      select: { metadata: true },
    });
    const meta = auditMeta(audit.metadata);
    expect(meta.kind).toBe("logo");
    expect(meta.action).toBe("uploaded");
  });

  it("owner-realtor can upload to their own team", async () => {
    const { realtor, teams } = await seedBaseline();
    const jpg = makeImageFile("image/jpeg", 1_000);
    const res = await uploadTeamBrandingInner(realtor, teams.t1.id, "logo", form("logo", jpg));
    expect(res).toEqual({ ok: true });
  });

  it("outsider (not on team) rejected", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_logo_outsider",
    });
    const png = makeImageFile("image/png", 1_000);
    const res = await uploadTeamBrandingInner(outsider, "t_test_1", "logo", form("logo", png));
    expect(res).toEqual({
      ok: false,
      error: "errors.team.brandingOwnersOnly",
    });
  });

  it("freelancer rejected", async () => {
    const { freelancer, teams } = await seedBaseline();
    const png = makeImageFile("image/png", 1_000);
    const res = await uploadTeamBrandingInner(freelancer, teams.t1.id, "logo", form("logo", png));
    expect(res.ok).toBe(false);
  });

  it("empty form → 'Pick a logo image to upload.'", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await uploadTeamBrandingInner(admin, teams.t1.id, "logo", new FormData());
    expect(res).toEqual({ ok: false, error: "errors.profile.pickBrandingImage" });
  });

  it("oversize logo → rejected with MB hint", async () => {
    const { admin, teams } = await seedBaseline();
    const tooBig = makeImageFile("image/png", TEAM_LOGO_MAX_BYTES + 1);
    const res = await uploadTeamBrandingInner(admin, teams.t1.id, "logo", form("logo", tooBig));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("errors.profile.brandingImageTooLarge");
  });

  it("disallowed MIME (PDF) → 'Use PNG, JPG, WebP, or GIF for the logo.'", async () => {
    const { admin, teams } = await seedBaseline();
    const pdf = new File(["pdfbytes"], "a.pdf", { type: "application/pdf" });
    const res = await uploadTeamBrandingInner(admin, teams.t1.id, "logo", form("logo", pdf));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe("errors.profile.brandingImageWrongFormat");
      // SVG removed from allowlist — the message should no longer mention it.
      expect(res.error).not.toMatch(/SVG/);
    }
  });

  it("replacing an existing logo updates the DB key (old key eligible for cleanup)", async () => {
    const { admin, teams } = await seedBaseline();
    await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "logo",
      form("logo", makeImageFile("image/png", 1000)),
    );
    const firstKey = (
      await prisma.team.findUniqueOrThrow({ where: { id: teams.t1.id } })
    ).logoUrl;
    await new Promise((r) => setTimeout(r, 5));
    await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "logo",
      form("logo", makeImageFile("image/jpeg", 1500)),
    );
    const secondKey = (
      await prisma.team.findUniqueOrThrow({ where: { id: teams.t1.id } })
    ).logoUrl;
    expect(secondKey).not.toBe(firstKey);
    expect(secondKey).toMatch(/\.jpg$/);
  });
});

describe("uploadTeamBrandingInner — SVG dropped from logo allowlist (security)", () => {
  // SVG was an XSS vector when served from S3 / DO Spaces (the IMAGE_SAFETY_HEADERS
  // CSP only applies on the local-storage path, not on presigned-URL redirects).
  // The PDF generator already silently omits SVG logos (pdf-lib only embeds
  // PNG/JPG), so removing SVG support is consistent with effective behavior.
  // Callers who relied on SVG must rasterize.
  it("SVG logo upload rejected at the MIME allowlist (no longer in the allowed set)", async () => {
    const { admin, teams } = await seedBaseline();
    const svg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>'],
      "a.svg",
      { type: "image/svg+xml" },
    );
    const res = await uploadTeamBrandingInner(admin, teams.t1.id, "logo", form("logo", svg));
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Generic MIME-allowlist message — should NOT mention SVG anymore.
      expect(res.error).toBe("errors.profile.brandingImageWrongFormat");
      expect(res.error).not.toMatch(/SVG/);
    }
  });

  it("source contract: image/svg+xml is removed from TEAM_LOGO_MIME_TO_EXT", async () => {
    const { TEAM_LOGO_MIME_TO_EXT, TEAM_SIGNATURE_MIME_TO_EXT } = await import(
      "@/lib/teamBranding"
    );
    expect(TEAM_LOGO_MIME_TO_EXT["image/svg+xml"]).toBeUndefined();
    // Signature was already raster-only, but pin it so it stays that way.
    expect(TEAM_SIGNATURE_MIME_TO_EXT["image/svg+xml"]).toBeUndefined();
  });
});

describe.skip("uploadTeamBrandingInner — SVG active-content sanitizer (skipped: SVG no longer accepted)", () => {
  async function uploadSvgBytes(contents: string) {
    const { admin, teams } = await seedBaseline();
    const svg = new File([contents], "a.svg", { type: "image/svg+xml" });
    return uploadTeamBrandingInner(admin, teams.t1.id, "logo", form("logo", svg));
  }

  it("clean SVG accepted", async () => {
    const res = await uploadSvgBytes(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>',
    );
    expect(res).toEqual({ ok: true });
  });

  it("SVG with <script> → rejected", async () => {
    const res = await uploadSvgBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scripts or event handlers/);
  });

  it("SVG with inline event handler (onload) → rejected", async () => {
    const res = await uploadSvgBytes(
      '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect/></svg>',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scripts or event handlers/);
  });

  it("SVG with <foreignObject> → rejected (HTML injection vector)", async () => {
    const res = await uploadSvgBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div>x</div></foreignObject></svg>',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scripts or event handlers/);
  });

  it("SVG with javascript: href → rejected", async () => {
    const res = await uploadSvgBytes(
      '<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><rect/></a></svg>',
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/scripts or event handlers/);
  });

  it("sanitizer is CASE-INSENSITIVE — <SCRIPT> (uppercase) caught", async () => {
    const res = await uploadSvgBytes('<svg><SCRIPT>alert(1)</SCRIPT></svg>');
    expect(res.ok).toBe(false);
  });

  it("case-insensitive ON handler (ONCLICK) caught", async () => {
    const res = await uploadSvgBytes('<svg ONCLICK="x()"><rect/></svg>');
    expect(res.ok).toBe(false);
  });
});

describe("uploadTeamBrandingInner — signature path (raster-only)", () => {
  it("PNG signature accepted", async () => {
    const { admin, teams } = await seedBaseline();
    const png = makeImageFile("image/png", 5000);
    const res = await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "signature",
      form("signature", png),
    );
    expect(res).toEqual({ ok: true });
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teams.t1.id } });
    expect(team.signatureUrl).toMatch(/\/signature\//);
  });

  it("SVG signature REJECTED (signature is raster-only)", async () => {
    const { admin, teams } = await seedBaseline();
    const svg = new File(['<svg/>'], "a.svg", { type: "image/svg+xml" });
    const res = await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "signature",
      form("signature", svg),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) {
      // Signature format list should NOT include SVG.
      expect(res.error).not.toMatch(/SVG/);
      expect(res.error).toBe("errors.profile.brandingImageWrongFormat");
    }
  });

  it("oversize signature → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const tooBig = makeImageFile("image/png", TEAM_SIGNATURE_MAX_BYTES + 1);
    const res = await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "signature",
      form("signature", tooBig),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("errors.profile.brandingImageTooLarge");
  });
});

describe("removeTeamBrandingInner", () => {
  it("team with logo → cleared + audit emitted", async () => {
    const { admin, teams } = await seedBaseline();
    await uploadTeamBrandingInner(
      admin,
      teams.t1.id,
      "logo",
      form("logo", makeImageFile("image/png", 500)),
    );
    const res = await removeTeamBrandingInner(admin, teams.t1.id, "logo");
    expect(res).toEqual({ ok: true });
    const team = await prisma.team.findUniqueOrThrow({ where: { id: teams.t1.id } });
    expect(team.logoUrl).toBeNull();
    const audits = await prisma.auditLog.findMany({
      where: { actorId: admin.user.id, verb: "team.updated", objectId: teams.t1.id },
      orderBy: { at: "asc" },
      select: { metadata: true },
    });
    const removalAudit = audits.find(
      (a) => auditMeta(a.metadata).action === "removed",
    );
    expect(removalAudit).toBeTruthy();
  });

  it("team with NO logo → no-op (ok, no audit)", async () => {
    const { admin, teams } = await seedBaseline();
    const res = await removeTeamBrandingInner(admin, teams.t1.id, "logo");
    expect(res).toEqual({ ok: true });
    const audits = await prisma.auditLog.count({
      where: { actorId: admin.user.id, verb: "team.updated", objectId: teams.t1.id },
    });
    expect(audits).toBe(0);
  });

  it("outsider rejected", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_remove_outsider",
    });
    const res = await removeTeamBrandingInner(outsider, "t_test_1", "logo");
    expect(res).toEqual({
      ok: false,
      error: "errors.team.brandingOwnersOnly",
    });
  });
});
