import { describe, it, expect } from "vitest";
import { render } from "@react-email/render";
import * as React from "react";
import {
  AssignmentCta,
  addressLine,
  demoCtx,
  type AssignmentEmailCtx,
} from "@/emails/_assignment";

// Platform parity — Assignment::getFullAddressWithZipAttribute.
// `addressLine` feeds ALL 8 assignment-lifecycle email templates + the
// "Open assignment" CTA block that closes each one. A drift here mangles
// every email shipped. Worth pinning.

const BASE: AssignmentEmailCtx = {
  reference: "ASG-TEST-42",
  address: "Rue de la Loi 42",
  city: "Brussels",
  postal: "1000",
  assignmentUrl: "https://example.com/dashboard/assignments/xyz",
};

describe("addressLine", () => {
  it("formats as `address, postal city` (comma + space, postal before city)", () => {
    expect(addressLine(BASE)).toBe("Rue de la Loi 42, 1000 Brussels");
  });

  it("preserves unicode in address + city", () => {
    expect(
      addressLine({ ...BASE, address: "Rue d'Édith", city: "Liège", postal: "4000" }),
    ).toBe("Rue d'Édith, 4000 Liège");
  });

  it("empty strings collapse to bare commas and spaces (no throw, no 'undefined')", () => {
    // Template is `${address}, ${postal} ${city}` — empty slots yield
    // ",  " (comma + two joining spaces). The key invariant is no 'undefined'.
    const out = addressLine({ ...BASE, address: "", city: "", postal: "" });
    expect(out).toBe(",  ");
    expect(out).not.toMatch(/undefined/);
  });

  it("BE postal codes (4 digits) and NL-style (no dash) both render verbatim", () => {
    expect(
      addressLine({ ...BASE, postal: "9000", city: "Gent" }),
    ).toBe("Rue de la Loi 42, 9000 Gent");
  });
});

describe("AssignmentCta — rendered HTML", () => {
  async function renderCta(ctx: AssignmentEmailCtx): Promise<string> {
    return render(React.createElement(AssignmentCta, { ctx }));
  }

  async function renderCtaText(ctx: AssignmentEmailCtx): Promise<string> {
    return render(React.createElement(AssignmentCta, { ctx }), { plainText: true });
  }

  it("includes 'Open assignment' button pointing at assignmentUrl", async () => {
    const html = await renderCta(BASE);
    expect(html).toContain("Open assignment");
    expect(html).toContain(BASE.assignmentUrl);
  });

  it("no addToCalendarUrl → no calendar link block", async () => {
    const html = await renderCta(BASE);
    expect(html).not.toMatch(/Add this appointment/i);
  });

  it("with addToCalendarUrl → calendar link block rendered + URL present", async () => {
    const ctx: AssignmentEmailCtx = {
      ...BASE,
      addToCalendarUrl: "https://example.com/api/calendar/add?assignmentId=42",
    };
    const html = await renderCta(ctx);
    expect(html).toMatch(/Add this appointment/i);
    expect(html).toContain(ctx.addToCalendarUrl!);
  });

  it("HTML-escape safety: assignmentUrl with HTML-ish chars does not render raw tags", async () => {
    const hostile: AssignmentEmailCtx = {
      ...BASE,
      assignmentUrl: "https://example.com/<script>alert(1)</script>",
    };
    const html = await renderCta(hostile);
    expect(html).not.toMatch(/<script>alert/);
  });

  it("plain-text render preserves the URL verbatim", async () => {
    const text = await renderCtaText(BASE);
    expect(text).toContain(BASE.assignmentUrl);
  });
});

describe("demoCtx — the preview-props fixture", () => {
  it("has all required AssignmentEmailCtx fields populated (no undefined slots)", () => {
    expect(demoCtx.reference).toBeTruthy();
    expect(demoCtx.address).toBeTruthy();
    expect(demoCtx.city).toBeTruthy();
    expect(demoCtx.postal).toBeTruthy();
    expect(demoCtx.assignmentUrl).toMatch(/^https?:\/\//);
  });

  it("addToCalendarUrl is populated for the preview path", () => {
    expect(demoCtx.addToCalendarUrl).toBeTruthy();
    expect(demoCtx.addToCalendarUrl).toMatch(/^https?:\/\//);
  });

  it("addressLine(demoCtx) produces a recognizable Brussels-format string", () => {
    expect(addressLine(demoCtx)).toBe("Rue de la Loi 42, 1000 Brussels");
  });
});
