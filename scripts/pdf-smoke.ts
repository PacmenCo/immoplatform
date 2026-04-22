/**
 * Smoke test for the Opdrachtformulier PDF generator. Bypasses Next's
 * `server-only` import guard via a local shim on NODE_PATH — keeps the
 * test runnable under bare tsx.
 *
 *   NODE_PATH=scripts/_shims npx tsx scripts/pdf-smoke.ts
 *
 * Writes the PDF to tmp-opdrachtformulier.pdf. Open it to eyeball the layout.
 */
import { writeFile } from "node:fs/promises";
import { generateAssignmentFormPdf } from "../src/lib/pdf/assignmentForm";

async function main() {
  const pdf = await generateAssignmentFormPdf({
    reference: "ASG-2026-1001",
    address: "Rue des Exemples 42",
    postal: "1000",
    city: "Brussels",
    propertyType: "apartment",
    constructionYear: 1998,
    areaM2: 95,
    preferredDate: new Date("2026-05-15T09:00:00Z"),
    ownerName: "Sophie Van den Berg",
    ownerEmail: "sophie@example.com",
    ownerPhone: "+32 470 12 34 56",
    ownerAddress: "Chaussée de Wavre 200",
    ownerPostal: "1050",
    ownerCity: "Ixelles",
    ownerVatNumber: null,
    clientType: "owner",
    tenantName: "Marc Peeters",
    tenantPhone: "+32 475 98 76 54",
    contactEmail: "sophie@example.com",
    contactPhone: "+32 470 12 34 56",
    notes: "Building accessible via the rear courtyard. Key at concierge.",
    services: [
      { key: "epc", label: "EPC certificate" },
      { key: "asbestos", label: "Asbestos inventory" },
      { key: "electrical", label: "Electrical inspection" },
    ],
    team: {
      name: "Demo Real Estate",
      city: "Brussels",
      legalName: "Demo Real Estate BV",
      vatNumber: "BE0123456789",
      kboNumber: "0123.456.789",
      billingAddress: "Avenue Louise 100",
      billingPostal: "1050",
      billingCity: "Brussels",
      billingCountry: "Belgium",
      email: "billing@demo-re.be",
      billingPhone: "+32 2 555 10 20",
    },
  });

  await writeFile("tmp-opdrachtformulier.pdf", pdf);
  console.log(`OK — wrote tmp-opdrachtformulier.pdf (${pdf.byteLength} bytes)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
