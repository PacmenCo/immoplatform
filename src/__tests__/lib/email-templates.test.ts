import { describe, it, expect } from "vitest";
import {
  addedToTeamEmail,
  assignmentCancelledEmail,
  assignmentCompletedEmail,
  assignmentDateUpdatedEmail,
  assignmentDeliveredEmail,
  assignmentReassignedEmail,
  assignmentScheduledEmail,
  assignmentUnassignedEmail,
  commentPostedEmail,
  emailVerificationEmail,
  filesUploadedEmail,
  inviteEmail,
  monthlyInvoiceReminderEmail,
  passwordResetEmail,
} from "@/lib/email";

// Pure-logic render coverage for every transactional email. Each template
// must produce a non-empty HTML, non-empty plain-text, and a subject that
// reflects the inputs — so a future rename or prop-shape refactor fails
// loudly instead of sending a stub email to real users.
//
// The assertions are deliberately lenient on phrasing (we don't assert exact
// marketing copy) and strict on the *slots* that matter: the user's name,
// the action URL, and any data the recipient needs to act on.

/** Shared assignment-email context — every assignment lifecycle template
 *  accepts this base shape plus template-specific extras. */
const ctx = {
  reference: "ASG-42",
  address: "12 Rue de la Test",
  city: "Brussels",
  postal: "1000",
  assignmentUrl: "https://example.com/dashboard/assignments/abc",
};

function assertShape(out: { subject: string; html: string; text: string }) {
  expect(out.subject.length).toBeGreaterThan(0);
  expect(out.html.length).toBeGreaterThan(0);
  expect(out.text.length).toBeGreaterThan(0);
  // No raw `undefined` / `[object Object]` leakage from a missing prop.
  expect(out.html).not.toMatch(/undefined/i);
  expect(out.text).not.toMatch(/undefined/i);
  expect(out.html).not.toMatch(/\[object Object\]/);
}

describe("inviteEmail", () => {
  it("renders subject, html, and text", async () => {
    const out = await inviteEmail({
      inviterName: "Alice Admin",
      acceptUrl: "https://example.com/invite/accept?token=abc",
      role: "realtor",
      teamName: "Downtown Agency",
      teamRole: "member",
      note: "Welcome aboard.",
      expiresAt: new Date("2026-05-01T00:00:00Z"),
    }, "en");
    assertShape(out);
    expect(out.subject).toMatch(/realtor/i);
    expect(out.html).toContain("Alice Admin");
    expect(out.html).toContain("https://example.com/invite/accept?token=abc");
    expect(out.html).toContain("Downtown Agency");
    expect(out.html).toContain("Welcome aboard");
    // Accept-URL link anchor + sidecar URL both include the URL.
    expect(out.text).toContain("https://example.com/invite/accept?token=abc");
  });

  it("omits note section when note is null", async () => {
    const out = await inviteEmail({
      inviterName: "Alice",
      acceptUrl: "https://example.com/x",
      role: "freelancer",
      teamName: null,
      teamRole: null,
      note: null,
      expiresAt: new Date("2026-05-01T00:00:00Z"),
    }, "en");
    expect(out.html).not.toMatch(/Note from/i);
  });
});

describe("passwordResetEmail", () => {
  it("renders with reset URL + user name", async () => {
    const out = await passwordResetEmail({
      name: "Alice",
      resetUrl: "https://example.com/reset?token=xyz",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice");
    expect(out.html).toContain("https://example.com/reset?token=xyz");
  });
});

describe("monthlyInvoiceReminderEmail", () => {
  it("renders month-end reminder with the month + URL", async () => {
    const out = await monthlyInvoiceReminderEmail({
      monthLabel: "April 2026",
      overviewUrl: "https://example.com/dashboard/commissions",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("April 2026");
    expect(out.html).toContain("https://example.com/dashboard/commissions");
    expect(out.subject).toContain("April 2026");
  });
});

describe("emailVerificationEmail", () => {
  it("renders with verify URL + name", async () => {
    const out = await emailVerificationEmail({
      name: "Bob",
      verifyUrl: "https://example.com/verify?token=tok",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Bob");
    expect(out.html).toContain("https://example.com/verify?token=tok");
  });
});

describe("addedToTeamEmail", () => {
  it("renders inviter + team name + login URL", async () => {
    const out = await addedToTeamEmail({
      inviterName: "Alice Admin",
      teamName: "Downtown Agency",
      teamRole: "member",
      loginUrl: "https://example.com/login",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice Admin");
    expect(out.html).toContain("Downtown Agency");
    expect(out.html).toContain("https://example.com/login");
  });
});

// ─── Assignment lifecycle ──────────────────────────────────────────

describe("assignmentScheduledEmail", () => {
  it("renders scheduling info + assignment URL", async () => {
    const out = await assignmentScheduledEmail({
      ...ctx,
      recipientName: "Bob",
      scheduledAt: new Date("2026-05-10T14:30:00Z"),
      freelancerName: "Dana Freelancer",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Bob");
    expect(out.html).toContain("ASG-42");
    expect(out.html).toContain(ctx.assignmentUrl);
    expect(out.html).toContain("Dana Freelancer");
  });

  it("renders cleanly when no freelancerName is known", async () => {
    const out = await assignmentScheduledEmail({
      ...ctx,
      recipientName: "Bob",
      scheduledAt: new Date("2026-05-10T14:30:00Z"),
      freelancerName: null,
    }, "en");
    assertShape(out);
  });
});

describe("assignmentDateUpdatedEmail", () => {
  it("includes previous + new date info", async () => {
    const out = await assignmentDateUpdatedEmail({
      ...ctx,
      recipientName: "Bob",
      previousDate: new Date("2026-05-01T00:00:00Z"),
      newDate: new Date("2026-05-15T00:00:00Z"),
    }, "en");
    assertShape(out);
    expect(out.html).toContain("ASG-42");
  });

  it("renders when previous/new dates are null", async () => {
    const out = await assignmentDateUpdatedEmail({
      ...ctx,
      recipientName: "Bob",
      previousDate: null,
      newDate: null,
    }, "en");
    assertShape(out);
  });
});

describe("assignmentDeliveredEmail", () => {
  it("actor is the freelancer → one-name byline (not 'X marked Y's inspection')", async () => {
    const out = await assignmentDeliveredEmail({
      ...ctx,
      recipientName: "Bob",
      actorName: "Dana Freelancer",
      freelancerName: "Dana Freelancer",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Dana Freelancer marked the inspection");
    expect(out.html).not.toContain("Dana Freelancer marked Dana Freelancer");
  });

  it("actor differs from freelancer → 'X marked Y's inspection'", async () => {
    const out = await assignmentDeliveredEmail({
      ...ctx,
      recipientName: "Bob",
      actorName: "Alice Admin",
      freelancerName: "Dana Freelancer",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice Admin marked Dana Freelancer");
  });

  it("freelancerName is null (unassigned row) → single-name byline", async () => {
    const out = await assignmentDeliveredEmail({
      ...ctx,
      recipientName: "Bob",
      actorName: "Alice Admin",
      freelancerName: null,
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice Admin marked the inspection");
  });
});

describe("assignmentCompletedEmail", () => {
  it("renders completed notification with closer name", async () => {
    const out = await assignmentCompletedEmail({
      ...ctx,
      recipientName: "Bob",
      completedByName: "Alice Admin",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice Admin");
  });
});

describe("assignmentCancelledEmail", () => {
  it("renders cancellation with reason", async () => {
    const out = await assignmentCancelledEmail({
      ...ctx,
      recipientName: "Bob",
      cancelledByName: "Alice Admin",
      reason: "Owner cancelled the sale.",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Alice Admin");
    expect(out.html).toContain("Owner cancelled the sale.");
  });

  it("renders cleanly with no reason", async () => {
    const out = await assignmentCancelledEmail({
      ...ctx,
      recipientName: "Bob",
      cancelledByName: "Alice Admin",
      reason: null,
    }, "en");
    assertShape(out);
  });
});

describe("assignmentReassignedEmail", () => {
  it("renders reassignment to a new freelancer", async () => {
    const out = await assignmentReassignedEmail({
      ...ctx,
      freelancerName: "Dana",
      preferredDate: new Date("2026-05-10T10:00:00Z"),
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Dana");
    expect(out.html).toContain("ASG-42");
  });

  it("renders cleanly with no preferredDate", async () => {
    const out = await assignmentReassignedEmail({
      ...ctx,
      freelancerName: "Dana",
      preferredDate: null,
    }, "en");
    assertShape(out);
  });
});

describe("assignmentUnassignedEmail", () => {
  it("renders courtesy unassign to the outgoing freelancer", async () => {
    const out = await assignmentUnassignedEmail({
      ...ctx,
      freelancerName: "Dana",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Dana");
    expect(out.html).toContain("ASG-42");
  });
});

describe("filesUploadedEmail", () => {
  it("renders upload notification with counts + lane", async () => {
    const out = await filesUploadedEmail({
      ...ctx,
      recipientName: "Bob",
      uploaderName: "Dana Freelancer",
      lane: "freelancer",
      fileCount: 3,
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Dana Freelancer");
    expect(out.html).toMatch(/3/); // file count
  });

  it("singular-noun shape for a single file", async () => {
    const out = await filesUploadedEmail({
      ...ctx,
      recipientName: "Bob",
      uploaderName: "Dana",
      lane: "realtor",
      fileCount: 1,
    }, "en");
    assertShape(out);
  });
});

describe("commentPostedEmail", () => {
  it("renders the comment body + author", async () => {
    const out = await commentPostedEmail({
      ...ctx,
      recipientName: "Bob",
      authorName: "Dana Freelancer",
      body: "Running 10 min late — traffic on R0.",
    }, "en");
    assertShape(out);
    expect(out.html).toContain("Dana Freelancer");
    expect(out.html).toContain("Running 10 min late");
  });

  it("preserves newlines in multi-paragraph comments (rendered as HTML breaks)", async () => {
    const out = await commentPostedEmail({
      ...ctx,
      recipientName: "Bob",
      authorName: "Dana",
      body: "Line one.\n\nLine two.",
    }, "en");
    assertShape(out);
    expect(out.text).toContain("Line one");
    expect(out.text).toContain("Line two");
  });
});

describe("HTML-escape safety", () => {
  it("does not render raw <script> from user-supplied body (comment)", async () => {
    const out = await commentPostedEmail({
      ...ctx,
      recipientName: "Bob",
      authorName: "Attacker",
      body: "<script>alert('xss')</script>",
    }, "en");
    // The payload survives as escaped text, but the raw tag must not.
    expect(out.html).not.toMatch(/<script>alert/);
    expect(out.text).toContain("<script>"); // plaintext is fine, it's not HTML-rendered
  });

  it("does not render raw <script> from reason (cancellation)", async () => {
    const out = await assignmentCancelledEmail({
      ...ctx,
      recipientName: "Bob",
      cancelledByName: "Alice",
      reason: "<script>alert('xss')</script>",
    }, "en");
    expect(out.html).not.toMatch(/<script>alert/);
  });
});
