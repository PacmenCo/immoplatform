import { describe, expect, it, vi, beforeEach } from "vitest";

// `notify()` imports from `@/lib/email` at the top. To observe the call
// we mock that module and use `vi.hoisted` so the spy is in scope inside
// the hoisted mock factory (vi.mock runs BEFORE regular top-level code).
const { sendEmailSpy } = vi.hoisted(() => ({
  sendEmailSpy: vi.fn<(args: unknown) => Promise<void>>(),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: sendEmailSpy,
}));

import { notify } from "@/lib/notify";
import type { EmailEventKey } from "@/lib/email-events";

// Key contracts:
//   1. Opt-out → sendEmail NOT called + console.debug with "suppressed"
//   2. Not-opted-out → sendEmail called with payload
//   3. sendEmail throws → notify() does NOT rethrow (fail-open) +
//      console.error logs
//   4. Event key drives the shouldSendEmail lookup — different event,
//      different opt-out reading

const EV = "assignment.completed" as EmailEventKey;

function recipient(overrides: { email?: string; emailPrefs?: string | null } = {}) {
  return {
    email: overrides.email ?? "alice@test.local",
    emailPrefs: overrides.emailPrefs ?? null,
  };
}

describe("notify — opt-out suppression", () => {
  beforeEach(() => {
    sendEmailSpy.mockReset();
    sendEmailSpy.mockResolvedValue(undefined);
  });

  it("null emailPrefs → default-enabled, sendEmail called", async () => {
    await notify({
      to: recipient({ emailPrefs: null }),
      event: EV,
      subject: "s",
      text: "t",
      html: "h",
    });
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });

  it("emailPrefs with explicit false for THIS event → sendEmail NOT called", async () => {
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    await notify({
      to: recipient({ emailPrefs: JSON.stringify({ [EV]: false }) }),
      event: EV,
      subject: "s",
      text: "t",
    });
    expect(sendEmailSpy).not.toHaveBeenCalled();
    // Observable suppression — the module logs a debug line so ops can
    // distinguish "skipped" from "successful but invisible".
    expect(debugSpy).toHaveBeenCalled();
    const arg = String(debugSpy.mock.calls[0]?.[0] ?? "");
    expect(arg).toContain("suppressed");
    expect(arg).toContain(EV);
    debugSpy.mockRestore();
  });

  it("emailPrefs set to `false` for a DIFFERENT event → this event still sends", async () => {
    await notify({
      to: recipient({
        emailPrefs: JSON.stringify({ "assignment.scheduled": false }),
      }),
      event: EV,
      subject: "s",
      text: "t",
    });
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });

  it("malformed JSON emailPrefs → fails open (sends)", async () => {
    await notify({
      to: recipient({ emailPrefs: "{not-valid" }),
      event: EV,
      subject: "s",
      text: "t",
    });
    expect(sendEmailSpy).toHaveBeenCalledTimes(1);
  });
});

describe("notify — sendEmail payload plumbing", () => {
  beforeEach(() => {
    sendEmailSpy.mockReset();
    sendEmailSpy.mockResolvedValue(undefined);
  });

  it("passes subject + text + html + `to` through unchanged", async () => {
    await notify({
      to: recipient({ email: "bob@test.local" }),
      event: EV,
      subject: "Hello",
      text: "text body",
      html: "<p>html body</p>",
    });
    expect(sendEmailSpy).toHaveBeenCalledWith({
      to: "bob@test.local",
      subject: "Hello",
      text: "text body",
      html: "<p>html body</p>",
    });
  });

  it("omits html if the caller didn't provide one", async () => {
    await notify({
      to: recipient(),
      event: EV,
      subject: "Hello",
      text: "text body",
    });
    const call = sendEmailSpy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call).toMatchObject({
      to: "alice@test.local",
      subject: "Hello",
      text: "text body",
    });
    // html was not passed — should reflect that.
    expect(call.html).toBeUndefined();
  });
});

describe("notify — fail-open on sendEmail errors", () => {
  it("sendEmail rejects → notify() does NOT rethrow (fire-and-forget)", async () => {
    const err = new Error("SMTP 421: try later");
    sendEmailSpy.mockReset();
    sendEmailSpy.mockRejectedValue(err);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      notify({
        to: recipient(),
        event: EV,
        subject: "s",
        text: "t",
      }),
    ).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    // The error log should name the event + recipient so we can diagnose.
    const logArgs = errSpy.mock.calls[0] ?? [];
    const joined = logArgs.map(String).join(" ");
    expect(joined).toContain(EV);
    expect(joined).toContain("alice@test.local");
    errSpy.mockRestore();
  });

  it("opted-out recipient short-circuits BEFORE sendEmail runs (not tested via throw)", async () => {
    sendEmailSpy.mockReset();
    sendEmailSpy.mockRejectedValue(new Error("should never fire"));
    await expect(
      notify({
        to: recipient({ emailPrefs: JSON.stringify({ [EV]: false }) }),
        event: EV,
        subject: "s",
        text: "t",
      }),
    ).resolves.toBeUndefined();
    expect(sendEmailSpy).not.toHaveBeenCalled();
  });
});
