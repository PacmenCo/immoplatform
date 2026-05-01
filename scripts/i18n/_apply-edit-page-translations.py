#!/usr/bin/env python3
"""
One-off translation patch: applies hand-written nl-BE values for every
key rendered on the assignment edit page (page itself + AssignmentForm
+ side cards). Idempotent — re-running is safe. Removes itself from the
catalog's TODO surface area only; other namespaces stay TODO.

Run: python3 scripts/i18n/_apply-edit-page-translations.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

# Translations applied to the existing nested catalog. Paths use dot-separated
# keys; the ICU placeholders + rich-text tags have been preserved verbatim.
PATCHES: dict[str, str] = {
    # ── pageTitles ──
    "pageTitles.assignment": "Opdracht",

    # ── assignments.detail ──
    "assignments.detail.cancellationReasonLabel": "Reden van annulatie",
    "assignments.detail.deliverablesTitle": "Opleveringen",
    "assignments.detail.deliverablesDescription": "Certificaat-PDF's en foto's van de toegewezen deskundige.",
    "assignments.detail.deliverablesEmpty": "De deskundige heeft nog geen oplevering geüpload.",
    "assignments.detail.realtorUploadsTitle": "Uploads van de makelaar",
    "assignments.detail.realtorUploadsDescription": "Plattegronden, toegangsnotities en foto's aangeleverd door het kantoor.",
    "assignments.detail.realtorUploadsEmpty": "Nog geen ondersteunende documenten geüpload.",
    "assignments.detail.uploadsClosedNotice": "Deze opdracht is niet meer actief. Uploads en verwijderingen zijn gesloten.",
    "assignments.detail.commentsTitle": "Opmerkingen",
    "assignments.detail.commentsCount": "{count, plural, =0 {0 opmerkingen} =1 {1 opmerking} other {# opmerkingen}}",
    "assignments.detail.commentsEmpty": "Nog geen opmerkingen. Start het gesprek.",
    "assignments.detail.systemAuthor": "Systeem",
    "assignments.detail.teamTitle": "Kantoor",
    "assignments.detail.teamCreatedAt": "Aangemaakt op {date}",
    "assignments.detail.schedulingTitle": "Planning",
    "assignments.detail.commissionTitle": "Commissie",
    "assignments.detail.commissionDescription": "Toegepast bij voltooiing. Vastgelegd op dat moment — latere wijzigingen aan het tarief herschrijven deze regel niet.",
    "assignments.detail.commissionRate": "Tarief",
    "assignments.detail.commissionEarned": "Verdiend",
    "assignments.detail.assignmentFormTitle": "Opdrachtformulier",
    "assignments.detail.assignmentFormDescription": "PDF-opdrachtformulier.",
    "assignments.detail.assignmentFormFilenameSuffix": "Genereren wanneer klaar",
    "assignments.detail.tenantTitle": "Huurder",
    "assignments.detail.timeAgo.justNow": "zonet",
    "assignments.detail.timeAgo.minutes": "{n} min. geleden",
    "assignments.detail.timeAgo.hours": "{n} u geleden",
    "assignments.detail.timeAgo.days": "{n, plural, =1 {1 dag geleden} other {# dagen geleden}}",

    # ── assignments.statusPicker ──
    "assignments.statusPicker.current": "huidig",

    # ── assignments.freelancerEditForm ──
    "assignments.freelancerEditForm.plannedDateLabel": "Geplande datum",
    "assignments.freelancerEditForm.plannedDateHint": "Stel de afspraakdatum in of wijzig die. Een opdracht 'in afwachting' wordt 'ingepland' zodra u opslaat met een datum; wist u de datum van een ingeplande opdracht, dan keert ze terug naar 'in afwachting'.",

    # ── assignments.shared ──
    "assignments.shared.save": "Opslaan",
    "assignments.shared.cancel": "Annuleren",
    "assignments.shared.delete": "Verwijderen",
    "assignments.shared.change": "Wijzigen",
    "assignments.shared.edit": "Bewerken",
    "assignments.shared.close": "Sluiten",
    "assignments.shared.current": "Huidig",
    "assignments.shared.currentLowercase": "huidig",
    "assignments.shared.loading": "Laden…",
    "assignments.shared.unassigned": "Niet toegewezen",
    "assignments.shared.unassignedDashed": "— Niet toegewezen —",

    # ── assignments.notices ──
    "assignments.notices.filesFailed": "Opdracht aangemaakt. Sommige bestanden konden niet geüpload worden — probeer het opnieuw vanuit het tabblad Bestanden.",

    # ── assignments.delete ──
    "assignments.delete.title": "{reference} verwijderen?",
    "assignments.delete.description": "De opdracht, de bestanden, opmerkingen en agenda-events verdwijnen allemaal. Bijhorende commissieregels en facturen worden eveneens verwijderd. Dit kan niet ongedaan gemaakt worden.",
    "assignments.delete.confirmLabel": "Opdracht verwijderen",
    "assignments.delete.cancelLabel": "Behouden",
    "assignments.delete.triggerLabel": "Verwijderen",

    # ── assignments.calendarChips ──
    "assignments.calendarChips.agencyGoogle": "Google van het kantoor",
    "assignments.calendarChips.yourOutlook": "Uw Outlook",
    "assignments.calendarChips.onYourGoogle": "Op uw Google",
    "assignments.calendarChips.removeFromGoogleTitle": "Verwijderen uit mijn Google-agenda",
    "assignments.calendarChips.addToMyGoogle": "+ Toevoegen aan mijn Google",
    "assignments.calendarChips.adding": "Toevoegen…",

    # ── assignments.comments ──
    "assignments.comments.placeholder": "Voeg een opmerking toe…",
    "assignments.comments.submit": "Opmerking plaatsen",

    # ── assignments.keyPickup ──
    "assignments.keyPickup.label": "Sleutelafhaling",
    "assignments.keyPickup.notRequired": "Niet vereist",
    "assignments.keyPickup.required": "Vereist",
    "assignments.keyPickup.addressPending": "adres in afwachting",
    "assignments.keyPickup.agencyOffice": "kantoor van de makelaar",
    "assignments.keyPickup.checkboxLabel": "Een sleutel moet opgehaald worden",
    "assignments.keyPickup.atOffice": "Op het kantoor van de makelaar",
    "assignments.keyPickup.atOther": "Op een ander adres",
    "assignments.keyPickup.addressPlaceholder": "Straat, nummer, postcode, gemeente…",

    # ── assignments.assignedTo ──
    "assignments.assignedTo.title": "Toegewezen aan",
    "assignments.assignedTo.summary": "{assigned} van {total} toegewezen",
    "assignments.assignedTo.noServices": "Selecteer minstens één dienst in het formulier — voor elke dienst verschijnt hier een toewijzingsregel.",
    "assignments.assignedTo.inspector": "Deskundige",
    "assignments.assignedTo.plannedDateAria": "Geplande datum voor {service}",
    "assignments.assignedTo.searchPlaceholder": "Type een naam, regio of e-mail…",
    "assignments.assignedTo.cancelAria": "Annuleren",
    "assignments.assignedTo.noMatches": "Geen freelancers gevonden.",
    "assignments.assignedTo.current": "Huidig",

    # ── assignments.downloadPdf ──
    "assignments.downloadPdf.buttonLabel": "Downloaden",
    "assignments.downloadPdf.fallbackError": "De PDF kon niet gegenereerd worden.",
    "assignments.downloadPdf.defaultFilename": "opdrachtformulier.pdf",

    # ── assignments.files ──
    "assignments.files.labelFreelancer": "Sleep certificaat-PDF('s) hier of klik om te uploaden",
    "assignments.files.labelRealtor": "Sleep plattegronden, foto's of notities hier",
    "assignments.files.uploadedToast": "{count} bestand{count, plural, =1 {} other {en}} geüpload.",
    "assignments.files.mismatchedTickets": "Onverenigbare uploadtickets — probeer het opnieuw.",
    "assignments.files.uploadFailed": "Upload mislukt.",
    "assignments.files.filesFailedFallback": "Een of meer bestanden konden niet geüpload worden.",
    "assignments.files.uploadFailedStatus": "Upload mislukt ({status}).",
    "assignments.files.networkError": "Netwerkfout tijdens upload.",
    "assignments.files.uploadAborted": "Upload geannuleerd.",

    # ── shared.assignmentForm ──
    "shared.assignmentForm.servicesTitle": "Diensten",
    "shared.assignmentForm.servicesSubtitle": "Selecteer er een of meer. Wij regelen de planning en de oplevering.",
    "shared.assignmentForm.odooUnreachable": "Odoo is niet bereikbaar — prijslijstkeuzes laden niet. Nieuwe opdrachten gebruiken de basisprijs van het kantoor als terugval.",
    "shared.assignmentForm.productLabel": "Product uit prijslijst van het kantoor",
    "shared.assignmentForm.productSearchPlaceholder": "Type om te zoeken…",
    "shared.assignmentForm.productClearAriaLabel": "Selectie wissen",
    "shared.assignmentForm.productNoMatches": "Geen overeenkomende producten.",
    "shared.assignmentForm.propertyTitle": "Pand",
    "shared.assignmentForm.propertySubtitle": "Waar vindt de keuring plaats?",
    "shared.assignmentForm.address": "Straat + nummer",
    "shared.assignmentForm.addressPlaceholder": "Meir 34",
    "shared.assignmentForm.postal": "Postcode",
    "shared.assignmentForm.postalPlaceholder": "2000",
    "shared.assignmentForm.city": "Gemeente",
    "shared.assignmentForm.cityPlaceholder": "Antwerpen",
    "shared.assignmentForm.propertyType": "Type pand",
    "shared.assignmentForm.propertyTypeHouse": "Huis",
    "shared.assignmentForm.propertyTypeApartment": "Appartement",
    "shared.assignmentForm.propertyTypeStudio": "Studio",
    "shared.assignmentForm.propertyTypeStudioRoom": "Studentenkamer",
    "shared.assignmentForm.propertyTypeCommercial": "Handelspand",
    "shared.assignmentForm.year": "Bouwjaar",
    "shared.assignmentForm.yearPlaceholder": "1985",
    "shared.assignmentForm.area": "Bewoonbare oppervlakte (m²)",
    "shared.assignmentForm.areaPlaceholder": "120",
    "shared.assignmentForm.photographerLabel": "Contactpersoon voor de fotograaf",
    "shared.assignmentForm.photographerRealtor": "Makelaar",
    "shared.assignmentForm.photographerOwner": "Eigenaar",
    "shared.assignmentForm.photographerTenant": "Huurder",
    "shared.assignmentForm.contactTitle": "Contactpersoon",
    "shared.assignmentForm.contactSubtitle": "De makelaar of medewerker van het kantoor die de deskundige moet contacteren. Wordt op het agenda-event getoond onder \"Makelaar\".",
    "shared.assignmentForm.contactEmail": "E-mail",
    "shared.assignmentForm.contactEmailPlaceholder": "info@vastgoedantwerp.be",
    "shared.assignmentForm.contactPhone": "Telefoon",
    "shared.assignmentForm.contactPhonePlaceholder": "+32 3 123 45 67",
    "shared.assignmentForm.ownerTitle": "Eigenaar",
    "shared.assignmentForm.ownerSubtitle": "De persoon die het opdrachtformulier ondertekent.",
    "shared.assignmentForm.ownerTypeAriaLabel": "Type eigenaar",
    "shared.assignmentForm.ownerParticulier": "Particulier",
    "shared.assignmentForm.ownerFirm": "Bedrijf",
    "shared.assignmentForm.ownerFullName": "Volledige naam",
    "shared.assignmentForm.ownerFullNamePlaceholder": "Els Vermeulen",
    "shared.assignmentForm.ownerEmail": "E-mail",
    "shared.assignmentForm.ownerEmailPlaceholder": "els@example.com",
    "shared.assignmentForm.ownerPhone": "Telefoon",
    "shared.assignmentForm.ownerPhonePlaceholder": "+32 476 12 34 56",
    "shared.assignmentForm.ownerAddress": "Adres",
    "shared.assignmentForm.ownerAddressPlaceholder": "Meir 42",
    "shared.assignmentForm.ownerCity": "Gemeente",
    "shared.assignmentForm.ownerCityPlaceholder": "Antwerpen",
    "shared.assignmentForm.ownerPostal": "Postcode",
    "shared.assignmentForm.ownerPostalPlaceholder": "2000",
    "shared.assignmentForm.ownerVat": "BTW-nummer",
    "shared.assignmentForm.ownerVatHint": "Verplicht voor facturen aan bedrijven (bv. BE 0712.345.678).",
    "shared.assignmentForm.ownerVatPlaceholder": "BE 0712.345.678",
    "shared.assignmentForm.tenantTitle": "Huurder",
    "shared.assignmentForm.tenantSubtitle": "Toevoegen indien het pand momenteel verhuurd is — optioneel.",
    "shared.assignmentForm.tenantFullName": "Volledige naam",
    "shared.assignmentForm.tenantFullNamePlaceholder": "Marc De Smet",
    "shared.assignmentForm.tenantEmail": "E-mail",
    "shared.assignmentForm.tenantEmailPlaceholder": "marc@example.com",
    "shared.assignmentForm.tenantPhone": "Telefoon",
    "shared.assignmentForm.tenantPhonePlaceholder": "+32 479 98 76 54",
    "shared.assignmentForm.schedulingTitle": "Planning",
    "shared.assignmentForm.plannedDate": "Geplande datum",
    "shared.assignmentForm.plannedDateHint": "Wij bevestigen binnen de 24 uur per e-mail.",
    "shared.assignmentForm.keyPickup": "Een sleutel moet opgehaald worden vóór de keuring",
    "shared.assignmentForm.keyPickupWhere": "Waar wordt de sleutel opgehaald?",
    "shared.assignmentForm.keyPickupOffice": "Op het kantoor van de makelaar",
    "shared.assignmentForm.keyPickupOther": "Op een ander adres",
    "shared.assignmentForm.keyPickupAddress": "Ophaaladres",
    "shared.assignmentForm.keyPickupAddressHint": "Volledig adres waar de deskundige de sleutel kan ophalen.",
    "shared.assignmentForm.keyPickupAddressPlaceholder": "Straat, nummer, postcode, gemeente…",
    "shared.assignmentForm.freelancer": "Freelancer toewijzen",
    "shared.assignmentForm.freelancerHint": "Optioneel — laat op Niet toegewezen om later toe te wijzen.",
    "shared.assignmentForm.freelancerUnassigned": "— Niet toegewezen —",
    "shared.assignmentForm.calendarDate": "Interne agendadatum",
    "shared.assignmentForm.calendarDateHint": "Overschrijft de geplande datum bij het pushen naar agenda's. De datum voor de klant blijft onaangeroerd.",
    "shared.assignmentForm.calendarAccount": "Agenda-account (voor de e-mail-CTA)",
    "shared.assignmentForm.calendarAccountHint": "Het Google-account waarop de knop 'Toevoegen aan mijn agenda' in de e-mail aanstuurt.",
    "shared.assignmentForm.calendarAccountPlaceholder": "u@kantoor.be",
    "shared.assignmentForm.notes": "Opmerkingen voor de deskundige",
    "shared.assignmentForm.notesPlaceholder": "Parking, toegangscodes, huisdieren — alles wat goed is om te weten.",
    "shared.assignmentForm.initialComment": "Initiële opmerking",
    "shared.assignmentForm.initialCommentPlaceholder": "Eerste bericht voor de discussie (optioneel) — zichtbaar voor iedereen op de opdracht.",
    "shared.assignmentForm.filesTitle": "Ondersteunende bestanden (optioneel)",
    "shared.assignmentForm.filesSubtitle": "Voeg plattegronden, foto's of notities toe die de deskundige moet zien. U kan later ook bestanden toevoegen via het tabblad Bestanden.",
    "shared.assignmentForm.filesHint": "PDF, JPG, PNG, WebP · max. {maxMB} MB per bestand · max. {maxFiles} bestanden",
    "shared.assignmentForm.filesLabel": "Sleep plattegronden, foto's of notities hier",
    "shared.assignmentForm.filesNone": "Nog geen bestanden geselecteerd.",
    "shared.assignmentForm.filesReady": "{count, plural, one {# bestand klaar om te uploaden.} other {# bestanden klaar om te uploaden.}}",
    "shared.assignmentForm.submitCreate": "Opdracht aanmaken",
    "shared.assignmentForm.submitEdit": "Wijzigingen opslaan",
    "shared.assignmentForm.requiredHint": "Verplicht",
}


def set_path(d: dict, path: str, value: str) -> None:
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main() -> None:
    catalog = json.loads(NL.read_text())
    for path, value in PATCHES.items():
        set_path(catalog, path, value)
    NL.write_text(
        json.dumps(catalog, indent=2, ensure_ascii=False) + "\n",
    )
    print(f"Applied {len(PATCHES)} translations to {NL.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
