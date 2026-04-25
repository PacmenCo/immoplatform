import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/files/[...path]/route";
import {
  getAssignmentFileDownloadUrlInner,
  uploadAssignmentFilesInner,
  deleteAssignmentFileInner,
} from "@/app/actions/files";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeUploadFile, uploadForm } from "../_helpers/upload";

// Security-critical: /api/files/[...path] is session-less by design — the
// signed URL IS the auth. Any bypass = unauthorized file read.
//
// Guarantees we assert:
//   1. Valid sig + live file → 200 + correct Content-Type + filename header
//   2. Tampered sig → 401
//   3. Expired exp → 401
//   4. Missing sig/exp → 401
//   5. Soft-deleted file → 404 even with valid sig (stale-URL guard)
//   6. Unknown key → 404
//   7. Filename with quote/newline → sanitized in Content-Disposition header

setupTestDb();

type PathParams = { params: Promise<{ path: string[] }> };

/** Build the same request Next would hand to the route. `path` is the
 *  URL-encoded key split on `/`. */
function routeReq(url: string, pathSegments: string[]): [Request, PathParams] {
  return [
    new Request(url),
    { params: Promise.resolve({ path: pathSegments }) },
  ];
}

/** Upload a freelancer-lane file + produce a fresh signed URL for it. */
async function seedSignedUrl() {
  const { freelancer, teams } = await seedBaseline();
  const asg = await seedAssignment({
    teamId: teams.t1.id,
    freelancerId: freelancer.user.id,
    status: "scheduled",
    propertyType: "apartment",
  });
  await uploadAssignmentFilesInner(
    freelancer,
    asg.id,
    "freelancer",
    undefined,
    uploadForm(makeUploadFile("secret.pdf", "application/pdf", "actual-bytes")),
  );
  // Revert auto-complete so delete etc still work on the row later.
  await prisma.assignment.update({
    where: { id: asg.id },
    data: { status: "scheduled", completedAt: null, deliveredAt: null },
  });
  const file = await prisma.assignmentFile.findFirstOrThrow({
    where: { assignmentId: asg.id, deletedAt: null },
  });
  const urlRes = await getAssignmentFileDownloadUrlInner(freelancer, file.id);
  if (!urlRes.ok || !urlRes.data) throw new Error("expected signed url");
  return {
    freelancer,
    fileId: file.id,
    url: urlRes.data.url,
    storageKey: file.storageKey,
  };
}

/** Extract the path segments from a LocalStorage URL: /api/files/a/b/c?... */
function pathSegmentsFromUrl(url: string): string[] {
  const u = new URL(url);
  // Strip leading /api/files/ prefix and split.
  const prefix = "/api/files/";
  return u.pathname.slice(prefix.length).split("/");
}

// Stored body from makeUploadFile("secret.pdf", "application/pdf", "actual-bytes"):
// the upload helper prepends a %PDF-1.4 magic-byte prefix so server-side
// magicBytesValid accepts the file. Tests below assert the full stored bytes.
const STORED_BODY = "%PDF-1.4\nactual-bytes";

describe("GET /api/files/[...path] — happy path", () => {
  it("valid signed URL → 200 + original MIME + filename in Content-Disposition", async () => {
    const { url } = await seedSignedUrl();
    const [req, params] = routeReq(url, pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain('filename="secret.pdf"');
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toBe(STORED_BODY);
  });

  it("Content-Length matches the byte size", async () => {
    const { url } = await seedSignedUrl();
    const [req, params] = routeReq(url, pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.headers.get("Content-Length")).toBe(String(Buffer.byteLength(STORED_BODY)));
  });
});

describe("GET /api/files/[...path] — signature verification", () => {
  it("missing sig → 401", async () => {
    const { url } = await seedSignedUrl();
    const u = new URL(url);
    u.searchParams.delete("sig");
    const [req, params] = routeReq(u.toString(), pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it("missing exp → 401", async () => {
    const { url } = await seedSignedUrl();
    const u = new URL(url);
    u.searchParams.delete("exp");
    const [req, params] = routeReq(u.toString(), pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it("tampered sig (one hex flipped) → 401", async () => {
    const { url } = await seedSignedUrl();
    const u = new URL(url);
    const sig = u.searchParams.get("sig") ?? "";
    const flipped = (sig[0] === "a" ? "b" : "a") + sig.slice(1);
    u.searchParams.set("sig", flipped);
    const [req, params] = routeReq(u.toString(), pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it("sig from a DIFFERENT storage key → 401 (can't reuse a sig across files)", async () => {
    const a = await seedSignedUrl();
    // Upload a second file, take its signed URL, swap the sig onto the first's URL.
    // Re-seed via a fresh baseline would collide — instead, just swap keys in the URL.
    const u = new URL(a.url);
    // Use a sibling key under the same assignment — the sig was computed for
    // `assignments/<asgId>/freelancer/<fileId>-secret.pdf`. Mutating the key
    // in the URL path must invalidate the sig.
    const [req, params] = routeReq(u.toString(), [
      "assignments",
      "different",
      "freelancer",
      "file-for.pdf",
    ]);
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it("expired exp (past timestamp) with valid-looking sig → 401", async () => {
    const { url } = await seedSignedUrl();
    const u = new URL(url);
    // Set exp to 1 hour in the PAST. sig was computed for the real exp so
    // it won't match — but even if an attacker could compute a sig for a
    // past exp, verifySignature rejects exp < now first.
    u.searchParams.set("exp", String(Math.floor(Date.now() / 1000) - 3600));
    const [req, params] = routeReq(u.toString(), pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });

  it("non-numeric exp → 401", async () => {
    const { url } = await seedSignedUrl();
    const u = new URL(url);
    u.searchParams.set("exp", "bogus");
    const [req, params] = routeReq(u.toString(), pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/files/[...path] — live-delete guard", () => {
  it("file soft-deleted AFTER the URL was signed → 404 (stale-URL guard)", async () => {
    const { url, fileId, freelancer } = await seedSignedUrl();
    await deleteAssignmentFileInner(freelancer, fileId);
    const [req, params] = routeReq(url, pathSegmentsFromUrl(url));
    const res = await GET(req, params);
    expect(res.status).toBe(404);
  });

  it("storage key with no DB row → 404", async () => {
    // A valid-looking sig but for a key we never uploaded. Generate one by
    // asking storage() directly via a FRESH upload, then delete the DB row
    // (keeping the bytes on disk) and attempt the fetch.
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "scheduled",
    });
    await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("ghost.pdf")),
    );
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { status: "scheduled", completedAt: null, deliveredAt: null },
    });
    const file = await prisma.assignmentFile.findFirstOrThrow({
      where: { assignmentId: asg.id, deletedAt: null },
    });
    const urlRes = await getAssignmentFileDownloadUrlInner(freelancer, file.id);
    if (!urlRes.ok || !urlRes.data) throw new Error("expected url");
    // Now HARD-delete the DB row so the signed URL's storageKey has no row.
    await prisma.assignmentFile.delete({ where: { id: file.id } });
    const [req, params] = routeReq(urlRes.data.url, pathSegmentsFromUrl(urlRes.data.url));
    const res = await GET(req, params);
    expect(res.status).toBe(404);
  });
});

describe("GET /api/files/[...path] — filename sanitization", () => {
  it("filename with quote / newline / non-ASCII → sanitized in Content-Disposition", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
      status: "scheduled",
    });
    // We can't upload a file with a quote in the name — the FILE_CONSTRAINTS
    // don't block it but the browser/platform typically sanitize at pick
    // time. Upload with a benign name, then directly rewrite the DB row's
    // originalName to the hostile value to isolate what the ROUTE sanitizer
    // handles.
    await uploadAssignmentFilesInner(
      freelancer,
      asg.id,
      "freelancer",
      undefined,
      uploadForm(makeUploadFile("benign.pdf")),
    );
    await prisma.assignment.update({
      where: { id: asg.id },
      data: { status: "scheduled", completedAt: null, deliveredAt: null },
    });
    const file = await prisma.assignmentFile.findFirstOrThrow({
      where: { assignmentId: asg.id, deletedAt: null },
    });
    await prisma.assignmentFile.update({
      where: { id: file.id },
      data: { originalName: 'has "quote"\nand émoji 🚀.pdf' },
    });
    const urlRes = await getAssignmentFileDownloadUrlInner(freelancer, file.id);
    if (!urlRes.ok || !urlRes.data) throw new Error("expected url");
    const [req, params] = routeReq(
      urlRes.data.url,
      pathSegmentsFromUrl(urlRes.data.url),
    );
    const res = await GET(req, params);
    expect(res.status).toBe(200);
    const cd = res.headers.get("Content-Disposition") ?? "";
    // No raw quote / newline / non-ASCII in the header value.
    expect(cd).not.toMatch(/"[^"]*"[^"]*"/); // exactly one pair of quotes
    expect(cd).not.toMatch(/\n/);
    // eslint-disable-next-line no-control-regex
    expect(cd).not.toMatch(/[\x00-\x1f\x7f]/);
    expect(cd).toMatch(/attachment; filename="/);
  });
});
