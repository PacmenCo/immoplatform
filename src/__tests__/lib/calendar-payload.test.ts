import { describe, it, expect } from "vitest";
import { buildEventPayload, type PayloadInput } from "@/lib/calendar/payload";

// Platform parity — ports the field mapping + HTML layout from:
//   Platform/app/Services/GoogleCalendarService.php
//     - buildCalendarEventData (summary, location, start/end, timezone)   lines 221-267
//     - buildEventDescription  (HTML blocks for property/contacts/notes)  lines 273-378
//     - client-name resolution chain                                      lines 234-248
//     - "Sleutel ophalen" (key pickup) conditional block                  lines 344-353
// `createAgencyGoogleEvent` + provider side effects are Phase 3 (integration-tier).

type Assignment = PayloadInput["assignment"];
type Team = PayloadInput["team"];

function assignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "asg_1",
    reference: "IMMO-0001",
    address: "Rue de la Loi 16",
    city: "Brussels",
    postal: "1000",
    propertyType: "apartment",
    areaM2: 120,
    requiresKeyPickup: false,
    keyPickupLocationType: null,
    keyPickupAddress: null,
    notes: null,
    ownerName: "Jane Owner",
    ownerEmail: "jane@example.com",
    ownerPhone: "+32 2 555 0100",
    tenantName: null,
    tenantEmail: null,
    tenantPhone: null,
    contactEmail: null,
    contactPhone: null,
    photographerContactPerson: null,
    isLargeProperty: false,
    preferredDate: new Date("2026-05-14T09:00:00.000Z"),
    calendarDate: null,
    ...overrides,
  };
}

function team(overrides: Partial<NonNullable<Team>> = {}): NonNullable<Team> {
  return {
    name: "Acme Realty",
    legalName: "Acme Realty BV",
    ...overrides,
  };
}

describe("buildEventPayload — date ladder + duration", () => {
  it("returns null when neither calendarDate nor preferredDate is set", () => {
    const payload = buildEventPayload({
      assignment: assignment({ preferredDate: null, calendarDate: null }),
      team: null,
    });
    expect(payload).toBeNull();
  });

  it("returns null for an invalid Date object (NaN timestamp)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ preferredDate: new Date("not-a-date") }),
      team: null,
    });
    expect(payload).toBeNull();
  });

  it("uses preferredDate when calendarDate is null", () => {
    const preferred = new Date("2026-05-14T09:00:00.000Z");
    const payload = buildEventPayload({
      assignment: assignment({ preferredDate: preferred, calendarDate: null }),
      team: null,
    });
    expect(payload?.start).toEqual(preferred);
  });

  it("calendarDate overrides preferredDate (Platform: calendar_date ?: actual_date)", () => {
    const preferred = new Date("2026-05-14T09:00:00.000Z");
    const override = new Date("2026-05-15T14:30:00.000Z");
    const payload = buildEventPayload({
      assignment: assignment({ preferredDate: preferred, calendarDate: override }),
      team: null,
    });
    expect(payload?.start).toEqual(override);
  });

  it("end = start + 90 minutes (Platform default duration)", () => {
    const start = new Date("2026-05-14T09:00:00.000Z");
    const payload = buildEventPayload({
      assignment: assignment({ preferredDate: start }),
      team: null,
    });
    expect(payload!.end.getTime() - payload!.start.getTime()).toBe(90 * 60_000);
  });

  it("emits Europe/Brussels time zone + 10-minute reminder (Platform parity)", () => {
    const payload = buildEventPayload({ assignment: assignment(), team: null });
    expect(payload?.timeZone).toBe("Europe/Brussels");
    expect(payload?.reminderMinutes).toBe(10);
  });
});

describe("buildEventPayload — title + location", () => {
  it("title = UPPERCASE(clientName) - address, city (Platform summary line 251)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ address: "Rue Belliard 12", city: "Brussels" }),
      team: team({ name: "Acme Realty" }),
    });
    expect(payload?.title).toBe("ACME REALTY - Rue Belliard 12, Brussels");
  });

  it("location = address, postal city (Platform line 258)", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        address: "Rue Belliard 12",
        postal: "1040",
        city: "Brussels",
      }),
      team: null,
    });
    expect(payload?.location).toBe("Rue Belliard 12, 1040 Brussels");
  });
});

describe("buildEventPayload — client-name fallback chain", () => {
  it("prefers team.name over every other candidate", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "Jane Owner", tenantName: "Tom Tenant" }),
      team: team({ name: "Acme Realty", legalName: "Acme Realty BV" }),
    });
    expect(payload?.title.startsWith("ACME REALTY - ")).toBe(true);
  });

  it("falls back to team.legalName when team.name is empty", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "Jane Owner" }),
      team: team({ name: "", legalName: "Acme Realty BV" }),
    });
    expect(payload?.title.startsWith("ACME REALTY BV - ")).toBe(true);
  });

  it("falls back to ownerName when no team is provided", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "Jane Owner", tenantName: "Tom Tenant" }),
      team: null,
    });
    expect(payload?.title.startsWith("JANE OWNER - ")).toBe(true);
  });

  it("falls back to tenantName when team + ownerName are empty", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "", tenantName: "Tom Tenant" }),
      team: null,
    });
    expect(payload?.title.startsWith("TOM TENANT - ")).toBe(true);
  });

  it('final fallback = "CLIENT" when every candidate is empty (Platform: KLANT)', () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "", tenantName: null }),
      team: null,
    });
    expect(payload?.title.startsWith("CLIENT - ")).toBe(true);
  });

  it("uppercases the resolved name even when input is mixed case", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "jane OWNER" }),
      team: null,
    });
    expect(payload?.title.startsWith("JANE OWNER - ")).toBe(true);
  });

  it("whitespace-only candidate is treated as empty (trim then test)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "   ", tenantName: "Real Name" }),
      team: null,
    });
    expect(payload?.title.startsWith("REAL NAME - ")).toBe(true);
  });
});

describe("buildDescription — always-rendered blocks", () => {
  it("opens with the assignment reference in bold", () => {
    const payload = buildEventPayload({
      assignment: assignment({ reference: "IMMO-4242" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<p><strong>IMMO-4242</strong></p>");
  });

  it("includes the Address block (always)", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        address: "Rue Belliard 12",
        postal: "1040",
        city: "Brussels",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Address:</strong> Rue Belliard 12, 1040 Brussels",
    );
  });

  it("includes the Appointment block with formatted local time", () => {
    const payload = buildEventPayload({ assignment: assignment(), team: null });
    // Europe/Brussels zone + dd-mm-YYYY HH:MM shape.
    expect(payload?.descriptionHtml).toMatch(
      /<strong>Appointment:<\/strong>\s+\d{2}-\d{2}-\d{4}\s\d{2}:\d{2}/,
    );
  });

  it("renders the property block with the labelled property type", () => {
    const payload = buildEventPayload({
      assignment: assignment({ propertyType: "apartment" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Property type:</strong> Apartment");
  });

  it("unknown propertyType gets title-cased fallback", () => {
    const payload = buildEventPayload({
      assignment: assignment({ propertyType: "warehouse" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Property type:</strong> Warehouse");
  });

  it("underscored propertyType key is humanised", () => {
    const payload = buildEventPayload({
      assignment: assignment({ propertyType: "semi_detached" }),
      team: null,
    });
    // First char upper, underscores → spaces.
    expect(payload?.descriptionHtml).toContain("<strong>Property type:</strong> Semi detached");
  });

  it("omits the Property type line when propertyType is null (Area still rendered)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ propertyType: null }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("Property type:");
    expect(payload?.descriptionHtml).toContain("<strong>Area:</strong>");
  });

  it("ends the description with an Open-assignment link", () => {
    const payload = buildEventPayload({
      assignment: assignment({ id: "asg_abcd1234" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      'href="http://localhost:3000/dashboard/assignments/asg_abcd1234"',
    );
    expect(payload?.descriptionHtml).toContain("Open assignment");
  });
});

describe("buildDescription — area label logic (Platform lines 356-360)", () => {
  it('isLargeProperty=true → "Large property (> 300 m²)" regardless of areaM2', () => {
    const payload = buildEventPayload({
      assignment: assignment({ isLargeProperty: true, areaM2: 500 }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Area:</strong> Large property (&gt; 300 m²)",
    );
    // The numeric annotation is only for the Standard branch.
    expect(payload?.descriptionHtml).not.toContain("(~ 500 m²)");
  });

  it('isLargeProperty=false + areaM2 set → "Standard (≤ 300 m²) (~ X m²)"', () => {
    const payload = buildEventPayload({
      assignment: assignment({ isLargeProperty: false, areaM2: 150 }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Area:</strong> Standard (≤ 300 m²) (~ 150 m²)",
    );
  });

  it("isLargeProperty=false + areaM2=null → bare Standard label (no annotation)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ isLargeProperty: false, areaM2: null }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Area:</strong> Standard (≤ 300 m²)");
    expect(payload?.descriptionHtml).not.toContain("(~");
  });

  it("isLargeProperty=false + areaM2=0 → treated as null (no annotation)", () => {
    // areaM2 is falsy → no annotation branch, same as null.
    const payload = buildEventPayload({
      assignment: assignment({ isLargeProperty: false, areaM2: 0 }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Area:</strong> Standard (≤ 300 m²)");
    expect(payload?.descriptionHtml).not.toContain("(~ 0 m²)");
  });
});

describe("buildDescription — key-pickup block (Platform lines 344-353)", () => {
  it("requiresKeyPickup=false → NO key-pickup line at all", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: false,
        keyPickupLocationType: "office",
        keyPickupAddress: "Rue X 1",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("Key pickup:");
  });

  it('requiresKeyPickup=true + locationType=office → "Pick up at the office"', () => {
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: true,
        keyPickupLocationType: "office",
        keyPickupAddress: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Key pickup:</strong> Pick up at the office",
    );
  });

  it('requiresKeyPickup=true + locationType=null → defaults to "Pick up at the office"', () => {
    // Platform: keyPickupLocationType ?? 'office' — null is office.
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: true,
        keyPickupLocationType: null,
        keyPickupAddress: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Key pickup:</strong> Pick up at the office",
    );
  });

  it('requiresKeyPickup=true + locationType=other + address → "At: <address>"', () => {
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: true,
        keyPickupLocationType: "other",
        keyPickupAddress: "Chaussée de Louvain 500",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Key pickup:</strong> At: Chaussée de Louvain 500",
    );
  });

  it('requiresKeyPickup=true + locationType=other + no address → "At a separate address"', () => {
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: true,
        keyPickupLocationType: "other",
        keyPickupAddress: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Key pickup:</strong> At a separate address",
    );
  });
});

describe("buildDescription — contact blocks (Platform lines 299-341)", () => {
  it("realtor block renders when team is present", () => {
    const payload = buildEventPayload({
      assignment: assignment({ contactEmail: null, contactPhone: null }),
      team: team({ name: "Acme Realty" }),
    });
    expect(payload?.descriptionHtml).toContain("<strong>Realtor");
    expect(payload?.descriptionHtml).toContain("Acme Realty");
  });

  it("realtor block renders when contactEmail is present even without team", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        contactEmail: "agent@acme.example",
        contactPhone: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Realtor");
    expect(payload?.descriptionHtml).toContain("agent@acme.example");
  });

  it("realtor block omitted when team is null AND no contact details", () => {
    const payload = buildEventPayload({
      assignment: assignment({ contactEmail: null, contactPhone: null }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("<strong>Realtor");
  });

  it("owner block renders when any of ownerName / ownerEmail / ownerPhone is set", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        ownerName: "Jane Owner",
        ownerEmail: null,
        ownerPhone: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Owner");
    expect(payload?.descriptionHtml).toContain("Jane Owner");
  });

  it("owner block is omitted only when ALL three owner fields are empty", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        ownerName: "",
        ownerEmail: null,
        ownerPhone: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("<strong>Owner");
  });

  it("tenant block renders when tenantName is set", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        tenantName: "Tom Tenant",
        tenantEmail: "tom@example.com",
        tenantPhone: "+32 2 555 0200",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>Tenant");
    expect(payload?.descriptionHtml).toContain("Tom Tenant");
    expect(payload?.descriptionHtml).toContain("tom@example.com");
    expect(payload?.descriptionHtml).toContain("+32 2 555 0200");
  });

  it("tenant block omitted when tenant fields are all empty", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        tenantName: null,
        tenantEmail: null,
        tenantPhone: null,
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("<strong>Tenant");
  });

  it.each([
    ["realtor", "Realtor"],
    ["owner", "Owner"],
    ["tenant", "Tenant"],
  ])(
    "photographerContactPerson=%s → only that block gets the (Your contact) marker",
    (role, label) => {
      const payload = buildEventPayload({
        assignment: assignment({
          // Make sure all three blocks render so we can see which is marked.
          contactEmail: "agent@acme.example",
          ownerName: "Jane Owner",
          tenantName: "Tom Tenant",
          photographerContactPerson: role,
        }),
        team: team(),
      });
      const html = payload!.descriptionHtml;
      // The marker must appear exactly once, and it must be on the expected block.
      const markerRegex = /\(Your contact\)/g;
      expect(html.match(markerRegex)?.length ?? 0).toBe(1);
      // The opening tag for the labelled block must contain the marker near the label.
      expect(html).toMatch(
        new RegExp(`<strong>${label}\\s+<em[^>]*>\\(Your contact\\)</em>:</strong>`),
      );
    },
  );

  it("photographerContactPerson=null → no (Your contact) marker anywhere", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        contactEmail: "agent@acme.example",
        tenantName: "Tom Tenant",
        photographerContactPerson: null,
      }),
      team: team(),
    });
    expect(payload?.descriptionHtml).not.toContain("(Your contact)");
  });
});

describe("buildDescription — notes + comments (Platform lines 364-373)", () => {
  it("notes block renders when notes is set and preserves newlines as <br />", () => {
    const payload = buildEventPayload({
      assignment: assignment({ notes: "First line\nSecond line" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain(
      "<strong>Notes:</strong><br />First line<br />Second line",
    );
  });

  it("notes block omitted when notes is null", () => {
    const payload = buildEventPayload({
      assignment: assignment({ notes: null }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("Notes:");
  });

  it("comments block omitted when comments array is missing", () => {
    const payload = buildEventPayload({
      assignment: assignment({ comments: undefined }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("Recent activity:");
  });

  it("comments block omitted when comments array is empty", () => {
    const payload = buildEventPayload({
      assignment: assignment({ comments: [] }),
      team: null,
    });
    expect(payload?.descriptionHtml).not.toContain("Recent activity:");
  });

  it("comments block renders with author name, timestamp, and body", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        comments: [
          {
            createdAt: new Date("2026-05-10T10:30:00.000Z"),
            body: "Call ahead",
            author: { firstName: "Alice", lastName: "Agent" },
          },
        ],
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("Recent activity:");
    expect(payload?.descriptionHtml).toContain("<strong>Alice Agent</strong>");
    expect(payload?.descriptionHtml).toContain("Call ahead");
  });

  it('author is "—" placeholder when author is null', () => {
    const payload = buildEventPayload({
      assignment: assignment({
        comments: [
          {
            createdAt: new Date("2026-05-10T10:30:00.000Z"),
            body: "System comment",
            author: null,
          },
        ],
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("<strong>—</strong>");
  });

  it("limits to the last 5 comments (chronological tail)", () => {
    const comments = Array.from({ length: 7 }, (_, i) => ({
      createdAt: new Date(`2026-05-0${i + 1}T10:00:00.000Z`),
      body: `comment-${i + 1}`,
      author: { firstName: "A", lastName: "Bot" },
    }));
    const payload = buildEventPayload({
      assignment: assignment({ comments }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    // First two dropped, last five kept.
    expect(html).not.toContain("comment-1");
    expect(html).not.toContain("comment-2");
    for (let i = 3; i <= 7; i++) expect(html).toContain(`comment-${i}`);
  });

  it("comment body newlines flatten to single spaces (not <br />)", () => {
    // Comments use single-line bullet form; notes use <br />. Don't mix.
    const payload = buildEventPayload({
      assignment: assignment({
        comments: [
          {
            createdAt: new Date("2026-05-10T10:30:00.000Z"),
            body: "line1\nline2",
            author: { firstName: "A", lastName: "B" },
          },
        ],
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("line1 line2");
    expect(payload?.descriptionHtml).not.toContain("line1<br />line2");
  });
});

describe("buildDescription — HTML escaping (security-critical)", () => {
  it("escapes <script> in notes so injected HTML is rendered inert", () => {
    const payload = buildEventPayload({
      assignment: assignment({ notes: "<script>alert('x')</script>" }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    // The raw script tag must NOT appear; the escaped form must.
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes ampersands in address/postal/city (no double-escape of &amp;)", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        address: "Rue Smith & Jones 7",
        postal: "1000",
        city: "Brussels",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("Rue Smith &amp; Jones 7");
  });

  it("escapes double quotes in notes", () => {
    const payload = buildEventPayload({
      assignment: assignment({ notes: 'He said "hello"' }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("&quot;hello&quot;");
    expect(payload?.descriptionHtml).not.toContain('"hello"');
  });

  it("escapes single quotes in notes (XSS-hardened)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ notes: "it's important" }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("it&#39;s important");
  });

  it("escapes owner name containing HTML", () => {
    const payload = buildEventPayload({
      assignment: assignment({ ownerName: "<b>Jane</b> Owner" }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    expect(html).toContain("&lt;b&gt;Jane&lt;/b&gt; Owner");
    // Raw <b> after `Owner:` block must not re-open a bold span.
    expect(html).not.toContain("<b>Jane</b> Owner");
  });

  it("escapes reference (IMMO code may be attacker-influenced via import)", () => {
    const payload = buildEventPayload({
      assignment: assignment({ reference: "IMMO-<svg/onload=x>" }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    expect(html).toContain("IMMO-&lt;svg/onload=x&gt;");
  });

  it("escapes mailto/tel values inside href attributes (attr-safe)", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        ownerName: "Jane",
        ownerEmail: 'jane@example.com"><script>x</script>',
        ownerPhone: null,
      }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    // The closing-quote break-out must be escaped in the href.
    expect(html).not.toContain('"><script>');
    expect(html).toContain("&quot;&gt;&lt;script&gt;");
  });

  it("escapes key-pickup address", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        requiresKeyPickup: true,
        keyPickupLocationType: "other",
        keyPickupAddress: "<b>Secret</b> & Co",
      }),
      team: null,
    });
    expect(payload?.descriptionHtml).toContain("At: &lt;b&gt;Secret&lt;/b&gt; &amp; Co");
  });

  it("escapes comment body even though newlines flatten", () => {
    const payload = buildEventPayload({
      assignment: assignment({
        comments: [
          {
            createdAt: new Date("2026-05-10T10:30:00.000Z"),
            body: "<img src=x onerror=alert(1)>",
            author: { firstName: "A", lastName: "B" },
          },
        ],
      }),
      team: null,
    });
    const html = payload!.descriptionHtml;
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
