import { describe, expect, it } from "vitest";
import { postCommentInner } from "@/app/actions/assignments";
import { prisma, setupTestDb } from "../_helpers/db";
import { seedAssignment, seedBaseline } from "../_helpers/fixtures";
import { makeSession } from "../_helpers/session";

// Platform parity — AssignmentController::addComment.
// postComment gates on canViewAssignment (anyone who can see it can speak on
// it), runs through a zod schema (1..4000 chars, trimmed), and notifies the
// counterpart side (creator + assigned freelancer minus the author).

setupTestDb();

function form(assignmentId: string, body: string): FormData {
  const fd = new FormData();
  fd.set("assignmentId", assignmentId);
  fd.set("body", body);
  return fd;
}

describe("postCommentInner — happy path", () => {
  it("writes a comment row with the author id and trimmed body", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_happy",
      status: "scheduled",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    const res = await postCommentInner(
      realtor,
      undefined,
      form(asg.id, "   Hello team.   "),
    );
    expect(res).toEqual({ ok: true });
    const comments = await prisma.assignmentComment.findMany({
      where: { assignmentId: asg.id },
      select: { authorId: true, body: true },
    });
    expect(comments).toEqual([{ authorId: realtor.user.id, body: "Hello team." }]);
  });

  it("admin can post on any assignment they can view", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_admin",
      teamId: teams.t1.id,
    });
    const res = await postCommentInner(admin, undefined, form(asg.id, "Admin note"));
    expect(res).toEqual({ ok: true });
  });

  it("freelancer on the row can comment", async () => {
    const { freelancer, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_freelancer",
      teamId: teams.t1.id,
      freelancerId: freelancer.user.id,
    });
    const res = await postCommentInner(
      freelancer,
      undefined,
      form(asg.id, "Running 10 min late."),
    );
    expect(res).toEqual({ ok: true });
  });
});

describe("postCommentInner — permission gate", () => {
  it("outsider (can't view assignment) → 'You can\\'t comment on this assignment.'", async () => {
    await seedBaseline();
    const outsider = await makeSession({
      role: "realtor",
      userId: "u_comment_outsider",
    });
    const asg = await seedAssignment({
      id: "a_comment_outsider_target",
      teamId: "t_test_1",
    });
    const res = await postCommentInner(
      outsider,
      undefined,
      form(asg.id, "sneak attack"),
    );
    expect(res).toEqual({
      ok: false,
      error: "You can't comment on this assignment.",
    });
    const comments = await prisma.assignmentComment.count({
      where: { assignmentId: asg.id },
    });
    expect(comments).toBe(0);
  });

  it("non-existent assignment → 'Assignment not found.'", async () => {
    const { admin } = await seedBaseline();
    const res = await postCommentInner(
      admin,
      undefined,
      form("a_missing", "hello"),
    );
    expect(res).toEqual({ ok: false, error: "Assignment not found." });
  });
});

describe("postCommentInner — body validation", () => {
  it("empty body → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_empty",
      teamId: teams.t1.id,
    });
    const res = await postCommentInner(admin, undefined, form(asg.id, ""));
    expect(res).toEqual({ ok: false, error: "Comment can't be empty." });
  });

  it("whitespace-only body → rejected (trimmed before validation)", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_whitespace",
      teamId: teams.t1.id,
    });
    const res = await postCommentInner(admin, undefined, form(asg.id, "    "));
    expect(res).toEqual({ ok: false, error: "Comment can't be empty." });
  });

  it("body > 4000 chars → rejected", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_too_long",
      teamId: teams.t1.id,
    });
    const tooLong = "x".repeat(4001);
    const res = await postCommentInner(admin, undefined, form(asg.id, tooLong));
    expect(res.ok).toBe(false);
  });

  it("body at the 4000-char ceiling → accepted", async () => {
    const { admin, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_at_limit",
      teamId: teams.t1.id,
    });
    const max = "y".repeat(4000);
    const res = await postCommentInner(admin, undefined, form(asg.id, max));
    expect(res).toEqual({ ok: true });
  });
});

describe("postCommentInner — multi-post behavior", () => {
  it("same user can post multiple comments on the same assignment", async () => {
    const { realtor, teams } = await seedBaseline();
    const asg = await seedAssignment({
      id: "a_comment_thread",
      teamId: teams.t1.id,
      createdById: realtor.user.id,
    });
    await postCommentInner(realtor, undefined, form(asg.id, "First."));
    await postCommentInner(realtor, undefined, form(asg.id, "Second."));
    await postCommentInner(realtor, undefined, form(asg.id, "Third."));
    const comments = await prisma.assignmentComment.findMany({
      where: { assignmentId: asg.id },
      orderBy: { createdAt: "asc" },
      select: { body: true },
    });
    expect(comments.map((c) => c.body)).toEqual(["First.", "Second.", "Third."]);
  });
});
