#!/usr/bin/env python3
"""Translate teams edit + shared team-form namespaces to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # teams.edit (18)
    "teams.edit.topbarTitle": "{name} bewerken",
    "teams.edit.topbarSubtitle": "Werk de gegevens, facturatie, prijzen en commissie van het kantoor bij.",
    "teams.edit.servicesTitle": "Diensten & prijzen",
    "teams.edit.servicesDescription": "Eigen prijzen per dienst. Sommige diensten zijn gekoppeld aan een Odoo-prijslijst; andere gebruiken een vaste afwijkende prijs (laat leeg voor de basisprijs). Bestaande opdrachten behouden hun vastgelegde prijs — wijzigingen gelden enkel voor nieuwe opdrachten.",
    "teams.edit.priceOverrides.odooUnreachable": "Odoo is onbereikbaar — prijslijstkoppelingen kunnen momenteel niet worden geladen of gewijzigd. Bestaande koppelingen blijven actief.",
    "teams.edit.priceOverrides.basePrice": "Basisprijs {price}",
    "teams.edit.priceOverrides.save": "Opslaan",
    "teams.edit.priceOverrides.reset": "Resetten",
    "teams.edit.priceOverrides.overrideAriaLabel": "Afwijkende prijs voor {label}",
    "teams.edit.priceOverrides.overrideError": "Geef een positief getal in (bv. 145 of 145,50).",
    "teams.edit.priceOverrides.pricelistLabel": "Prijslijst",
    "teams.edit.priceOverrides.pricelistNone": "— Geen —",
    "teams.edit.priceOverrides.pricelistMissing": "#{id} (ontbreekt in Odoo)",
    "teams.edit.priceOverrides.pricelistEmpty": "Geen prijslijsten in Odoo (of Odoo is onbereikbaar).",
    "teams.edit.priceOverrides.itemsHeading": "Items in deze prijslijst",
    "teams.edit.priceOverrides.itemsEmpty": "Geen items geconfigureerd in Odoo voor deze prijslijst.",
    "teams.edit.priceOverrides.itemsColumnProduct": "Product",
    "teams.edit.priceOverrides.itemsColumnPrice": "Prijs",

    # shared.teamForm (56)
    "shared.teamForm.basicsTitle": "Basisgegevens kantoor",
    "shared.teamForm.basicsDescription": "Naam, locatie en het label dat op kaarten in het dashboard verschijnt.",
    "shared.teamForm.name": "Naam kantoor",
    "shared.teamForm.namePlaceholder": "Vastgoed Antwerp",
    "shared.teamForm.city": "Gemeente",
    "shared.teamForm.cityPlaceholder": "Antwerpen",
    "shared.teamForm.email": "E-mailadres kantoor",
    "shared.teamForm.emailHint": "Gedeelde inbox — wordt op facturen vermeld.",
    "shared.teamForm.emailPlaceholder": "contact@agency.be",
    "shared.teamForm.shortDescription": "Korte omschrijving",
    "shared.teamForm.shortDescriptionPlaceholder": "bv. Specialist in residentieel vastgoed in Vlaanderen",
    "shared.teamForm.badge": "Label",
    "shared.teamForm.badgeHint": "1–3 letters die op kantoorkaarten verschijnen zolang er geen logo is geüpload. Laat leeg om automatisch af te leiden uit de naam van het kantoor.",
    "shared.teamForm.badgePlaceholder": "VA",
    "shared.teamForm.color": "Kleur",
    "shared.teamForm.stampLogo": "Kantoorlogo op pandfoto's plaatsen",
    "shared.teamForm.stampLogoDescription": "Indien actief wordt de huisstijl van het kantoor over de pandfoto's gelegd die door het platform worden gegenereerd.",
    "shared.teamForm.legalTitle": "Juridisch + facturatie",
    "shared.teamForm.legalDescription": "Wordt vermeld op uitgaande facturen en het opdrachtformulier. Momenteel optioneel, maar vereist voor facturatie.",
    "shared.teamForm.legalName": "Juridische benaming",
    "shared.teamForm.legalNamePlaceholder": "Vastgoed Antwerp BV",
    "shared.teamForm.vatNumber": "BTW-nummer",
    "shared.teamForm.vatPlaceholder": "BE 0712.345.678",
    "shared.teamForm.kboNumber": "Kamer van Koophandel (KBO)",
    "shared.teamForm.kboPlaceholder": "0712345678",
    "shared.teamForm.iban": "IBAN",
    "shared.teamForm.ibanPlaceholder": "BE68 5390 0754 7034",
    "shared.teamForm.billingEmail": "E-mailadres facturatie",
    "shared.teamForm.billingEmailPlaceholder": "billing@agency.be",
    "shared.teamForm.billingPhone": "Telefoonnummer facturatie",
    "shared.teamForm.billingPhonePlaceholder": "+32 3 234 56 78",
    "shared.teamForm.billingAddress": "Facturatieadres",
    "shared.teamForm.billingAddressPlaceholder": "Straat + nummer",
    "shared.teamForm.billingPostal": "Postcode",
    "shared.teamForm.billingPostalPlaceholder": "2000",
    "shared.teamForm.billingCity": "Gemeente facturatie",
    "shared.teamForm.billingCityPlaceholder": "Antwerpen",
    "shared.teamForm.country": "Land",
    "shared.teamForm.countryPlaceholder": "België",
    "shared.teamForm.invoiceRecipient": "Standaard factuurontvanger",
    "shared.teamForm.invoiceRecipientHint": "Bepaalt welk contactblok op de facturen wordt afgedrukt. Per opdracht aanpasbaar.",
    "shared.teamForm.noDefault": "Geen standaard",
    "shared.teamForm.particulier": "Particulier (eigenaar)",
    "shared.teamForm.firm": "Bedrijf",
    "shared.teamForm.commissionTitle": "Commissie",
    "shared.teamForm.commissionDescription": "Hoeveel het kantoor inhoudt per opgeleverde opdracht. Eenmaal ingesteld, geldt platformbreed.",
    "shared.teamForm.commissionModel": "Model",
    "shared.teamForm.commissionNone": "Geen commissie",
    "shared.teamForm.commissionPercentage": "Percentage van de opdracht",
    "shared.teamForm.commissionFixed": "Vast bedrag per opdracht",
    "shared.teamForm.commissionValue": "Waarde",
    "shared.teamForm.commissionValueHint": "Percentage: basispunten (1500 = 15%). Vast: in centen (2500 = € 25,00).",
    "shared.teamForm.submitCreate": "Kantoor aanmaken",
    "shared.teamForm.submitEdit": "Wijzigingen opslaan",
    "shared.teamForm.cancel": "Annuleren",
    "shared.teamForm.requiredHint": "Verplicht",

    # shared.legalBillingFields (35)
    "shared.legalBillingFields.title": "Juridisch & facturatie",
    "shared.legalBillingFields.intro": "Wordt vermeld op uitgaande facturen en het opdrachtformulier. Momenteel optioneel, maar vereist voor facturatie.",
    "shared.legalBillingFields.optionalBadge": "Optioneel",
    "shared.legalBillingFields.businessType": "Type onderneming",
    "shared.legalBillingFields.businessTypeAriaLabel": "Type onderneming",
    "shared.legalBillingFields.soleTrader": "Eenmanszaak",
    "shared.legalBillingFields.soleTraderDescription": "Eenmanszaak — facturen worden uitgereikt op persoonlijke naam.",
    "shared.legalBillingFields.company": "Vennootschap",
    "shared.legalBillingFields.companyDescription": "BV / SRL of andere rechtspersoon.",
    "shared.legalBillingFields.legalName": "Juridische benaming",
    "shared.legalBillingFields.legalNameHint": "Zoals geregistreerd bij de KBO/BCE.",
    "shared.legalBillingFields.legalNamePlaceholder": "bv. Acme Inspections BV",
    "shared.legalBillingFields.vatNumber": "BTW-nummer",
    "shared.legalBillingFields.vatHint": "Belgisch formaat: BE + 10 cijfers",
    "shared.legalBillingFields.vatPlaceholder": "BE 0712.345.678",
    "shared.legalBillingFields.vatError": "Formaat moet BE + 10 cijfers zijn.",
    "shared.legalBillingFields.kboNumber": "KBO/BCE-nummer",
    "shared.legalBillingFields.kboHint": "Dezelfde cijfers als het BTW-nummer, zonder het voorvoegsel BE.",
    "shared.legalBillingFields.kboPlaceholder": "0712345678",
    "shared.legalBillingFields.iban": "IBAN",
    "shared.legalBillingFields.ibanHint": "Belgische IBAN: BE + 14 cijfers.",
    "shared.legalBillingFields.ibanPlaceholder": "BE68 5390 0754 7034",
    "shared.legalBillingFields.ibanError": "Het formaat klopt niet — verwacht BE + 14 cijfers.",
    "shared.legalBillingFields.billingEmail": "E-mailadres facturatie",
    "shared.legalBillingFields.billingEmailHint": "Waar facturen en overzichten naartoe worden gestuurd.",
    "shared.legalBillingFields.billingEmailPlaceholder": "billing@agency.be",
    "shared.legalBillingFields.billingPhone": "Telefoonnummer facturatie",
    "shared.legalBillingFields.billingPhonePlaceholder": "+32 3 234 56 78",
    "shared.legalBillingFields.billingAddress": "Facturatieadres",
    "shared.legalBillingFields.billingAddressPlaceholder": "Straat + nummer",
    "shared.legalBillingFields.billingPostal": "Postcode",
    "shared.legalBillingFields.billingPostalPlaceholder": "2000",
    "shared.legalBillingFields.billingCity": "Gemeente",
    "shared.legalBillingFields.billingCityPlaceholder": "Antwerpen",
    "shared.legalBillingFields.country": "Land",

    # shared.legalBillingDisplay (12)
    "shared.legalBillingDisplay.title": "Juridisch & facturatie",
    "shared.legalBillingDisplay.incompleteTitle": "Facturatiegegevens onvolledig",
    "shared.legalBillingDisplay.incompleteBody": "Vereist voordat uitbetalingen kunnen plaatsvinden. Voeg het BTW-nummer, IBAN en facturatieadres van de deskundige toe.",
    "shared.legalBillingDisplay.addDetailsCta": "Facturatiegegevens toevoegen →",
    "shared.legalBillingDisplay.labelLegalName": "Juridische benaming",
    "shared.legalBillingDisplay.labelVatKbo": "BTW / KBO",
    "shared.legalBillingDisplay.labelIban": "IBAN",
    "shared.legalBillingDisplay.labelBillingEmail": "E-mailadres facturatie",
    "shared.legalBillingDisplay.labelBillingPhone": "Telefoonnummer facturatie",
    "shared.legalBillingDisplay.labelBillingAddress": "Facturatieadres",
    "shared.legalBillingDisplay.company": "Vennootschap",
    "shared.legalBillingDisplay.soleTrader": "Eenmanszaak",

    # shared.brandingCard (15)
    "shared.brandingCard.logoTitle": "Kantoorlogo",
    "shared.brandingCard.logoDescription": "Wordt gebruikt in de hoofding van het opdrachtformulier en op de detailpagina van het kantoor.",
    "shared.brandingCard.logoNoneAlt": "Geen logo",
    "shared.brandingCard.logoConstraints": "PNG, JPG, WebP of GIF — max. {max} MB.",
    "shared.brandingCard.logoUpdated": "Logo bijgewerkt.",
    "shared.brandingCard.logoRemoved": "Logo verwijderd.",
    "shared.brandingCard.logoAlt": "Logo van {teamName}",
    "shared.brandingCard.signatureTitle": "Handtekeningafbeelding",
    "shared.brandingCard.signatureDescription": "Wordt afgedrukt in het handtekeningvak van het opdrachtformulier-PDF. PNG met transparante achtergrond geeft het strakste resultaat.",
    "shared.brandingCard.signatureNoneAlt": "Geen handtekening",
    "shared.brandingCard.signatureConstraints": "PNG of JPG — max. {max} MB. SVG niet ondersteund — PDF's gebruiken een rasterafbeelding.",
    "shared.brandingCard.signatureUpdated": "Handtekening bijgewerkt.",
    "shared.brandingCard.signatureRemoved": "Handtekening verwijderd.",
    "shared.brandingCard.signatureAlt": "Handtekening van {teamName}",
    "shared.brandingCard.remove": "Verwijderen",

    # shared.pricingCard (6)
    "shared.pricingCard.title": "Prijzen",
    "shared.pricingCard.intro": "Prijzen worden vastgelegd bij aanmaak — latere wijzigingen aan de prijslijst hebben geen invloed op deze factuur.",
    "shared.pricingCard.subtotal": "Subtotaal",
    "shared.pricingCard.surchargeLabel": "Toeslag groot pand",
    "shared.pricingCard.discount": "Korting",
    "shared.pricingCard.total": "Totaal",
}


def set_path(d, path, value):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    catalog = json.loads(NL.read_text())
    for path, value in PATCHES.items():
        set_path(catalog, path, value)
    NL.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied {len(PATCHES)} translations to {NL.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
