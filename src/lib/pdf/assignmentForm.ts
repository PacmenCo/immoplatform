import "server-only";
import {
  PDFDocument,
  PDFPage,
  PDFFont,
  StandardFonts,
  rgb,
  type RGB,
} from "pdf-lib";

/**
 * Programmatic Opdrachtformulier — the assignment-authorisation form a
 * property owner signs when the agency orders inspections. Generated on
 * demand from the assignment + team state; persisted in object storage.
 *
 * Platform equivalent: pdftk fills an AcroForm template + FPDI stamps a
 * handwriting-font signature at fixed coordinates (OpdrachtformulierService
 * lines 18-47). We render from scratch with pdf-lib — zero system deps, one
 * library, no template PDF to version. When a designer-produced template
 * arrives we can switch to PDFDocument.load() + form().fill(). Drawing from
 * scratch today keeps the feature shippable without a template in hand.
 *
 * Layout is portrait A4 (595.28 × 841.89pt). Margins 56pt left/right,
 * header 40pt, body ~720pt. Two pages, conservative spacing — the form is
 * legal-document material; error on the side of legible.
 */

// ─── Input shape ────────────────────────────────────────────────────
//
// Loose types so the caller can pass Prisma objects without jumping
// through type-mapping hoops. We only read what we need — anything
// extra on the object is ignored.

export type AssignmentFormInput = {
  reference: string;
  address: string;
  postal: string;
  city: string;
  propertyType: string | null;
  constructionYear: number | null;
  areaM2: number | null;
  preferredDate: Date | null;

  ownerName: string;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerAddress: string | null;
  ownerPostal: string | null;
  ownerCity: string | null;
  ownerVatNumber: string | null;
  clientType: string | null;         // 'owner' | 'firm' | null

  tenantName: string | null;
  tenantPhone: string | null;

  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;

  services: Array<{
    key: string;
    label: string;
  }>;

  team: {
    name: string;
    city: string | null;
    legalName: string | null;
    vatNumber: string | null;
    kboNumber: string | null;
    billingAddress: string | null;
    billingPostal: string | null;
    billingCity: string | null;
    billingCountry: string | null;
    email: string | null;
    billingPhone: string | null;
  } | null;

  /** PNG or JPG bytes. Embedded on the signature block. Optional. */
  teamLogoBytes?: Buffer | null;
  teamLogoMime?: string | null;
  teamSignatureBytes?: Buffer | null;
  teamSignatureMime?: string | null;
};

// ─── Layout constants ───────────────────────────────────────────────

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const MARGIN_X = 56;
const CONTENT_WIDTH = A4_WIDTH - MARGIN_X * 2;

const INK = rgb(0.05, 0.05, 0.1);
const MUTED = rgb(0.45, 0.45, 0.5);
const LINE = rgb(0.8, 0.8, 0.83);
const ACCENT = rgb(0.09, 0.3, 0.73);

const SIZE = {
  h1: 20,
  h2: 12,
  body: 10,
  small: 9,
  xs: 8,
} as const;

// ─── Drawing helpers ────────────────────────────────────────────────

type Ctx = {
  page: PDFPage;
  regular: PDFFont;
  bold: PDFFont;
  /** Current vertical cursor (y coordinate, top-down feel). */
  y: number;
};

function drawText(
  ctx: Ctx,
  text: string,
  opts: {
    x: number;
    size?: number;
    bold?: boolean;
    color?: RGB;
    maxWidth?: number;
  },
): void {
  const { x, size = SIZE.body, bold = false, color = INK, maxWidth } = opts;
  const font = bold ? ctx.bold : ctx.regular;
  const str = maxWidth ? truncate(text, font, size, maxWidth) : text;
  ctx.page.drawText(str, { x, y: ctx.y, size, font, color });
}

/** Truncate to fit maxWidth in points, appending ellipsis when cut. */
function truncate(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "…";
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const candidate = text.slice(0, mid) + ellipsis;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ellipsis;
}

function moveDown(ctx: Ctx, dy: number): void {
  ctx.y -= dy;
}

function drawDivider(ctx: Ctx): void {
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: ctx.y },
    end: { x: A4_WIDTH - MARGIN_X, y: ctx.y },
    thickness: 0.5,
    color: LINE,
  });
  moveDown(ctx, 14);
}

function drawSectionHeading(ctx: Ctx, title: string): void {
  moveDown(ctx, 6);
  drawText(ctx, title.toUpperCase(), {
    x: MARGIN_X,
    size: SIZE.xs,
    bold: true,
    color: ACCENT,
  });
  moveDown(ctx, 16);
}

/** Label/value row — "Address: Meir 42". Handles blank values as "—". */
function drawField(
  ctx: Ctx,
  label: string,
  value: string | null | undefined,
  opts: { labelWidth?: number } = {},
): void {
  const { labelWidth = 110 } = opts;
  drawText(ctx, label, {
    x: MARGIN_X,
    size: SIZE.body,
    color: MUTED,
    maxWidth: labelWidth,
  });
  drawText(ctx, value && value.trim() ? value : "—", {
    x: MARGIN_X + labelWidth,
    size: SIZE.body,
    color: INK,
    maxWidth: CONTENT_WIDTH - labelWidth,
  });
  moveDown(ctx, 16);
}

function drawCheckbox(
  ctx: Ctx,
  x: number,
  checked: boolean,
): void {
  ctx.page.drawRectangle({
    x,
    y: ctx.y - 2,
    width: 10,
    height: 10,
    borderColor: INK,
    borderWidth: 0.8,
  });
  if (checked) {
    // Vector check — two stroked lines. Avoids the WinAnsi encoding gap
    // that Helvetica has for U+2713 (✓).
    const y = ctx.y - 2;
    ctx.page.drawLine({
      start: { x: x + 1.8, y: y + 4.8 },
      end: { x: x + 4, y: y + 2.5 },
      thickness: 1.2,
      color: INK,
    });
    ctx.page.drawLine({
      start: { x: x + 4, y: y + 2.5 },
      end: { x: x + 8.3, y: y + 7.8 },
      thickness: 1.2,
      color: INK,
    });
  }
}

// ─── Header (page 1 top) ────────────────────────────────────────────

async function drawHeader(
  doc: PDFDocument,
  ctx: Ctx,
  input: AssignmentFormInput,
): Promise<void> {
  const team = input.team;

  // Left: team logo (if present) + team name
  let leftCursorX = MARGIN_X;
  if (input.teamLogoBytes && input.teamLogoMime) {
    try {
      const mime = input.teamLogoMime.toLowerCase();
      const img = mime.includes("png")
        ? await doc.embedPng(input.teamLogoBytes)
        : mime.includes("jpeg") || mime.includes("jpg")
          ? await doc.embedJpg(input.teamLogoBytes)
          : null;
      if (img) {
        const maxH = 36;
        const scale = maxH / img.height;
        const w = Math.min(100, img.width * scale);
        const h = img.height * (w / img.width);
        ctx.page.drawImage(img, {
          x: MARGIN_X,
          y: A4_HEIGHT - 40 - h + 10,
          width: w,
          height: h,
        });
        leftCursorX = MARGIN_X + w + 12;
      }
    } catch {
      // Non-fatal: logo failed to embed (corrupt, wrong MIME). Header still
      // renders with just the team name text.
    }
  }
  ctx.page.drawText(team?.legalName ?? team?.name ?? "Immo", {
    x: leftCursorX,
    y: A4_HEIGHT - 34,
    size: 13,
    font: ctx.bold,
    color: INK,
  });
  if (team?.vatNumber) {
    ctx.page.drawText(`VAT ${team.vatNumber}`, {
      x: leftCursorX,
      y: A4_HEIGHT - 48,
      size: SIZE.xs,
      font: ctx.regular,
      color: MUTED,
    });
  }

  // Right: document title (reference, date)
  const rightX = A4_WIDTH - MARGIN_X - 180;
  ctx.page.drawText("OPDRACHTFORMULIER", {
    x: rightX,
    y: A4_HEIGHT - 34,
    size: SIZE.small,
    font: ctx.bold,
    color: ACCENT,
  });
  ctx.page.drawText(input.reference, {
    x: rightX,
    y: A4_HEIGHT - 48,
    size: SIZE.xs,
    font: ctx.regular,
    color: MUTED,
  });

  // Divider under header
  ctx.page.drawLine({
    start: { x: MARGIN_X, y: A4_HEIGHT - 60 },
    end: { x: A4_WIDTH - MARGIN_X, y: A4_HEIGHT - 60 },
    thickness: 0.5,
    color: LINE,
  });

  ctx.y = A4_HEIGHT - 80;
}

// ─── Sections ───────────────────────────────────────────────────────

function drawDocumentTitle(ctx: Ctx, input: AssignmentFormInput): void {
  drawText(ctx, "Assignment authorisation form", {
    x: MARGIN_X,
    size: SIZE.h1,
    bold: true,
  });
  moveDown(ctx, 22);
  drawText(
    ctx,
    "The client below authorises the agency to carry out the inspections listed on the property described here.",
    {
      x: MARGIN_X,
      size: SIZE.small,
      color: MUTED,
      maxWidth: CONTENT_WIDTH,
    },
  );
  moveDown(ctx, 20);
  if (input.preferredDate) {
    drawText(ctx, `Preferred inspection date: ${formatDate(input.preferredDate)}`, {
      x: MARGIN_X,
      size: SIZE.small,
      color: INK,
    });
    moveDown(ctx, 16);
  }
  drawDivider(ctx);
}

function drawPropertySection(ctx: Ctx, input: AssignmentFormInput): void {
  drawSectionHeading(ctx, "Property");
  drawField(ctx, "Address", `${input.address}, ${input.postal} ${input.city}`);
  drawField(ctx, "Property type", input.propertyType);
  drawField(ctx, "Built", input.constructionYear ? String(input.constructionYear) : null);
  drawField(ctx, "Living area", input.areaM2 ? `${input.areaM2} m²` : null);
  moveDown(ctx, 6);
  drawDivider(ctx);
}

function drawClientSection(ctx: Ctx, input: AssignmentFormInput): void {
  drawSectionHeading(ctx, "Client (opdrachtgever)");

  // Invoice recipient — checkbox row
  const firmChecked = input.clientType === "firm";
  drawCheckbox(ctx, MARGIN_X, !firmChecked);
  drawText(ctx, "Particulier (owner)", { x: MARGIN_X + 16, size: SIZE.body });
  drawCheckbox(ctx, MARGIN_X + 170, firmChecked);
  drawText(ctx, "Firm (bedrijf)", { x: MARGIN_X + 186, size: SIZE.body });
  moveDown(ctx, 20);

  drawField(ctx, "Name", input.ownerName);
  drawField(ctx, "Email", input.ownerEmail);
  drawField(ctx, "Phone", input.ownerPhone);
  drawField(
    ctx,
    "Invoicing address",
    [input.ownerAddress, [input.ownerPostal, input.ownerCity].filter(Boolean).join(" ")]
      .filter(Boolean)
      .join(", ") || null,
  );
  if (firmChecked || input.ownerVatNumber) {
    drawField(ctx, "VAT number", input.ownerVatNumber);
  }
  moveDown(ctx, 6);
  drawDivider(ctx);
}

function drawTenantSection(ctx: Ctx, input: AssignmentFormInput): void {
  if (!input.tenantName && !input.tenantPhone) return;
  drawSectionHeading(ctx, "Tenant contact (for key handover)");
  drawField(ctx, "Name", input.tenantName);
  drawField(ctx, "Phone", input.tenantPhone);
  moveDown(ctx, 6);
  drawDivider(ctx);
}

function drawServicesSection(ctx: Ctx, input: AssignmentFormInput): void {
  drawSectionHeading(ctx, "Inspections ordered");
  if (input.services.length === 0) {
    drawText(ctx, "— No services selected —", {
      x: MARGIN_X,
      size: SIZE.body,
      color: MUTED,
    });
    moveDown(ctx, 16);
  } else {
    for (const svc of input.services) {
      drawCheckbox(ctx, MARGIN_X, true);
      drawText(ctx, svc.label, {
        x: MARGIN_X + 16,
        size: SIZE.body,
      });
      drawText(ctx, svc.key.toUpperCase(), {
        x: MARGIN_X + 250,
        size: SIZE.xs,
        color: MUTED,
      });
      moveDown(ctx, 18);
    }
  }
  moveDown(ctx, 4);
  drawDivider(ctx);
}

async function drawSignatureSection(
  doc: PDFDocument,
  ctx: Ctx,
  input: AssignmentFormInput,
): Promise<void> {
  drawSectionHeading(ctx, "Signatures");

  const dateStr = formatDate(new Date());
  const signedAtCity = input.team?.city ?? input.city;

  // Two-column signature layout: left = client, right = agency
  const colWidth = (CONTENT_WIDTH - 24) / 2;
  const leftX = MARGIN_X;
  const rightX = MARGIN_X + colWidth + 24;
  const baseY = ctx.y;

  // Client column
  drawText(ctx, "Client (opdrachtgever)", {
    x: leftX,
    size: SIZE.xs,
    color: MUTED,
  });
  ctx.y -= 48;
  ctx.page.drawLine({
    start: { x: leftX, y: ctx.y },
    end: { x: leftX + colWidth, y: ctx.y },
    thickness: 0.5,
    color: LINE,
  });
  ctx.y -= 12;
  drawText(ctx, input.ownerName, {
    x: leftX,
    size: SIZE.small,
    bold: true,
    color: INK,
    maxWidth: colWidth,
  });
  ctx.y -= 12;
  drawText(ctx, `${signedAtCity} — ${dateStr}`, {
    x: leftX,
    size: SIZE.xs,
    color: MUTED,
  });

  // Agency column
  ctx.y = baseY;
  drawText(ctx, "Agency (on behalf of client)", {
    x: rightX,
    size: SIZE.xs,
    color: MUTED,
  });
  ctx.y -= 12;

  // If we have a signature image, embed it in the signature box.
  if (input.teamSignatureBytes && input.teamSignatureMime) {
    try {
      const mime = input.teamSignatureMime.toLowerCase();
      const img = mime.includes("png")
        ? await doc.embedPng(input.teamSignatureBytes)
        : mime.includes("jpeg") || mime.includes("jpg")
          ? await doc.embedJpg(input.teamSignatureBytes)
          : null;
      if (img) {
        const maxH = 36;
        const scale = Math.min(maxH / img.height, colWidth / img.width);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.page.drawImage(img, { x: rightX, y: ctx.y - h, width: w, height: h });
      }
    } catch {
      // Silently fall through — the typed name below is the source of truth.
    }
  }
  ctx.y -= 36;
  ctx.page.drawLine({
    start: { x: rightX, y: ctx.y },
    end: { x: rightX + colWidth, y: ctx.y },
    thickness: 0.5,
    color: LINE,
  });
  ctx.y -= 12;
  drawText(ctx, input.team?.legalName ?? input.team?.name ?? "Agency", {
    x: rightX,
    size: SIZE.small,
    bold: true,
    color: INK,
    maxWidth: colWidth,
  });
  ctx.y -= 12;
  drawText(ctx, `${signedAtCity} — ${dateStr}`, {
    x: rightX,
    size: SIZE.xs,
    color: MUTED,
  });
}

// ─── Page 2: agency block + notes ──────────────────────────────────

function drawAgencyBlock(ctx: Ctx, input: AssignmentFormInput): void {
  drawSectionHeading(ctx, "Agency");
  if (!input.team) {
    drawText(ctx, "— No agency attached to this assignment —", {
      x: MARGIN_X,
      size: SIZE.body,
      color: MUTED,
    });
    moveDown(ctx, 16);
    return;
  }
  drawField(ctx, "Name", input.team.legalName ?? input.team.name);
  drawField(ctx, "VAT", input.team.vatNumber);
  drawField(ctx, "KBO / KvK", input.team.kboNumber);
  drawField(
    ctx,
    "Billing address",
    [
      input.team.billingAddress,
      [input.team.billingPostal, input.team.billingCity].filter(Boolean).join(" "),
      input.team.billingCountry,
    ]
      .filter(Boolean)
      .join(", ") || null,
  );
  drawField(ctx, "Billing phone", input.team.billingPhone);
  drawField(ctx, "Team email", input.team.email);
  moveDown(ctx, 6);
  drawDivider(ctx);
}

function drawNotesSection(ctx: Ctx, input: AssignmentFormInput): void {
  drawSectionHeading(ctx, "Notes");
  if (input.notes && input.notes.trim().length > 0) {
    const lines = wrapText(input.notes.trim(), 90);
    for (const line of lines) {
      drawText(ctx, line, { x: MARGIN_X, size: SIZE.small, color: INK });
      moveDown(ctx, 14);
    }
  } else {
    drawText(ctx, "—", { x: MARGIN_X, size: SIZE.small, color: MUTED });
    moveDown(ctx, 14);
  }
  moveDown(ctx, 6);
  drawDivider(ctx);
}

/** Crude line wrap — character-count based, fine for typical notes fields. */
function wrapText(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (paragraph.length <= maxChars) {
      out.push(paragraph);
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).trim().length > maxChars) {
        out.push(line.trim());
        line = w;
      } else {
        line = (line + " " + w).trim();
      }
    }
    if (line) out.push(line);
  }
  return out;
}

// ─── Footer ─────────────────────────────────────────────────────────

function drawFooter(ctx: Ctx, pageNum: number, pageCount: number, reference: string): void {
  const y = 32;
  ctx.page.drawText(`${reference} — page ${pageNum} of ${pageCount}`, {
    x: MARGIN_X,
    y,
    size: SIZE.xs,
    font: ctx.regular,
    color: MUTED,
  });
  ctx.page.drawText(`Generated ${formatDate(new Date())}`, {
    x: A4_WIDTH - MARGIN_X - 120,
    y,
    size: SIZE.xs,
    font: ctx.regular,
    color: MUTED,
  });
}

// ─── Dates ──────────────────────────────────────────────────────────

const BE_FMT = new Intl.DateTimeFormat("nl-BE", {
  timeZone: "Europe/Brussels",
  day: "2-digit",
  month: "long",
  year: "numeric",
});
function formatDate(d: Date): string {
  return BE_FMT.format(d);
}

// ─── Public entry ───────────────────────────────────────────────────

export async function generateAssignmentFormPdf(
  input: AssignmentFormInput,
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Opdrachtformulier ${input.reference}`);
  doc.setAuthor(input.team?.legalName ?? input.team?.name ?? "Immo");
  doc.setSubject("Assignment authorisation");
  doc.setProducer("Immo");
  doc.setCreator("Immo");
  doc.setCreationDate(new Date());

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1 — property + client + services + signatures
  const page1 = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  let ctx: Ctx = { page: page1, regular, bold, y: A4_HEIGHT - 40 };
  await drawHeader(doc, ctx, input);
  drawDocumentTitle(ctx, input);
  drawPropertySection(ctx, input);
  drawClientSection(ctx, input);
  drawTenantSection(ctx, input);
  drawServicesSection(ctx, input);
  await drawSignatureSection(doc, ctx, input);

  // Page 2 — agency block + notes
  const page2 = doc.addPage([A4_WIDTH, A4_HEIGHT]);
  ctx = { page: page2, regular, bold, y: A4_HEIGHT - 40 };
  await drawHeader(doc, ctx, input);
  drawAgencyBlock(ctx, input);
  drawNotesSection(ctx, input);

  // Footers — after all content is drawn so page-count is known.
  drawFooter({ ...ctx, page: page1 }, 1, 2, input.reference);
  drawFooter(ctx, 2, 2, input.reference);

  const bytes = await doc.save();
  return Buffer.from(bytes);
}
