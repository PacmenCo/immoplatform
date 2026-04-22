import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { audit, getSession } from "@/lib/auth";
import { canViewAssignment } from "@/lib/permissions";
import { storage } from "@/lib/storage";
import { generateAssignmentFormPdf } from "@/lib/pdf/assignmentForm";
import {
  TEAM_LOGO_EXT_TO_MIME,
  TEAM_SIGNATURE_EXT_TO_MIME,
} from "@/lib/teamBranding";

/**
 * Opdrachtformulier PDF — generated on demand and streamed inline.
 *
 * We don't persist the bytes: pdf-lib runs sub-second so regenerating each
 * request is cheaper than cache-invalidating whenever the assignment or team
 * branding changes.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  const { id } = await params;

  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: {
      team: true,
      services: { include: { service: { select: { label: true } } } },
    },
  });
  if (!assignment) {
    return NextResponse.json({ error: "Assignment not found." }, { status: 404 });
  }
  if (!(await canViewAssignment(session, assignment))) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const store = storage();
  const [logo, signature] = await Promise.all([
    readBrandingImage(store, assignment.team?.logoUrl ?? null, TEAM_LOGO_EXT_TO_MIME),
    readBrandingImage(store, assignment.team?.signatureUrl ?? null, TEAM_SIGNATURE_EXT_TO_MIME),
  ]);

  const pdf = await generateAssignmentFormPdf({
    reference: assignment.reference,
    address: assignment.address,
    postal: assignment.postal,
    city: assignment.city,
    propertyType: assignment.propertyType,
    constructionYear: assignment.constructionYear,
    areaM2: assignment.areaM2,
    preferredDate: assignment.preferredDate,
    ownerName: assignment.ownerName,
    ownerEmail: assignment.ownerEmail,
    ownerPhone: assignment.ownerPhone,
    ownerAddress: assignment.ownerAddress,
    ownerPostal: assignment.ownerPostal,
    ownerCity: assignment.ownerCity,
    ownerVatNumber: assignment.ownerVatNumber,
    clientType: assignment.clientType,
    tenantName: assignment.tenantName,
    tenantPhone: assignment.tenantPhone,
    contactEmail: assignment.contactEmail,
    contactPhone: assignment.contactPhone,
    notes: assignment.notes,
    services: assignment.services.map((s) => ({
      key: s.serviceKey,
      label: s.service.label,
    })),
    team: assignment.team
      ? {
          name: assignment.team.name,
          city: assignment.team.city,
          legalName: assignment.team.legalName,
          vatNumber: assignment.team.vatNumber,
          kboNumber: assignment.team.kboNumber,
          billingAddress: assignment.team.billingAddress,
          billingPostal: assignment.team.billingPostal,
          billingCity: assignment.team.billingCity,
          billingCountry: assignment.team.billingCountry,
          email: assignment.team.email,
          billingPhone: assignment.team.billingPhone,
        }
      : null,
    teamLogoBytes: logo?.bytes ?? null,
    teamLogoMime: logo?.mime ?? null,
    teamSignatureBytes: signature?.bytes ?? null,
    teamSignatureMime: signature?.mime ?? null,
  });

  await audit({
    actorId: session.user.id,
    verb: "assignment.pdf_generated",
    objectType: "assignment",
    objectId: assignment.id,
    metadata: { reference: assignment.reference, sizeBytes: pdf.byteLength },
  });

  const filename = `Opdrachtformulier-${safeFilenameSegment(assignment.reference)}.pdf`;
  const ab = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(ab).set(pdf);
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function readBrandingImage(
  store: ReturnType<typeof storage>,
  key: string | null,
  extToMime: Record<string, string>,
): Promise<{ bytes: Buffer; mime: string } | null> {
  if (!key) return null;
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const mime = extToMime[ext];
  // pdf-lib only embeds PNG / JPG. SVG / WebP / GIF logos upload fine but
  // the PDF just omits the image rather than crash.
  if (mime !== "image/png" && mime !== "image/jpeg") return null;
  const bytes = await store.read(key);
  return bytes ? { bytes, mime } : null;
}

function safeFilenameSegment(s: string): string {
  return s.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}
