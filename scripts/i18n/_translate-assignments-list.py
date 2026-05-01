#!/usr/bin/env python3
"""Translate assignments list-cluster namespaces to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # assignments.list (31)
    "assignments.list.title": "Opdrachten",
    "assignments.list.subtitle.totalOnly": "{count} in totaal",
    "assignments.list.subtitle.filtered": "{filtered} {statusLabel} · {total} in totaal",
    "assignments.list.newCta": "Nieuw",
    "assignments.list.createCta": "Opdracht aanmaken",
    "assignments.list.resetFilters": "Filters wissen",
    "assignments.list.showOdoo": "Odoo tonen",
    "assignments.list.hideOdoo": "Odoo verbergen",
    "assignments.list.showOdooTitle": "Odoo-kolom tonen",
    "assignments.list.hideOdooTitle": "Odoo-kolom verbergen",
    "assignments.list.odooHeader": "Odoo",
    "assignments.list.odooHeaderTitle": "Synchronisatiestatus van Odoo",
    "assignments.list.filesHeader": "Bestanden",
    "assignments.list.columns.reference": "Referentie",
    "assignments.list.columns.property": "Pand",
    "assignments.list.columns.services": "Diensten",
    "assignments.list.columns.team": "Kantoor",
    "assignments.list.columns.freelancer": "Freelancer",
    "assignments.list.columns.created": "Aangemaakt",
    "assignments.list.columns.plannedDate": "Geplande datum",
    "assignments.list.columns.status": "Status",
    "assignments.list.emptyMatching.title": "Geen overeenkomsten gevonden",
    "assignments.list.emptyMatching.description": "Probeer de filters ruimer in te stellen — of wis ze om alles te zien.",
    "assignments.list.emptyByRole.admin.title": "Nog geen opdrachten",
    "assignments.list.emptyByRole.admin.description": "Maak uw eerste pandinspectie aan om te starten.",
    "assignments.list.emptyByRole.staff.title": "Nog geen opdrachten",
    "assignments.list.emptyByRole.staff.description": "Maak uw eerste pandinspectie aan om te starten.",
    "assignments.list.emptyByRole.realtor.title": "Nog geen certificaataanvragen voor uw kantoor",
    "assignments.list.emptyByRole.realtor.description": "Klik op Nieuwe opdracht om het eerste certificaat van uw kantoor aan te vragen.",
    "assignments.list.emptyByRole.freelancer.title": "Nog geen inspecties aan u toegewezen",
    "assignments.list.emptyByRole.freelancer.description": "Zodra een makelaar u aan een inspectie toewijst, verschijnt die hier.",

    # assignments.filters (10)
    "assignments.filters.searchPlaceholder": "Zoek op referentie, adres, kantoor, persoon…",
    "assignments.filters.statusAriaLabel": "Filter op status",
    "assignments.filters.teamAriaLabel": "Filter op kantoor",
    "assignments.filters.allStatuses": "Alle statussen",
    "assignments.filters.allTeams": "Alle kantoren",
    "assignments.filters.noTeam": "— Geen kantoor —",
    "assignments.filters.allFreelancers": "Alle freelancers",
    "assignments.filters.freelancerSearchPlaceholder": "Typ een naam…",
    "assignments.filters.freelancerUnassigned": "— Niet toegewezen —",
    "assignments.filters.reset": "Wissen",

    # assignments.pagination (7)
    "assignments.pagination.ariaLabel": "Paginering",
    "assignments.pagination.summary": "Pagina {current} van {total} · {count} opdrachten in totaal",
    "assignments.pagination.prev": "Vorige",
    "assignments.pagination.next": "Volgende",
    "assignments.pagination.previousPageAria": "Vorige pagina",
    "assignments.pagination.nextPageAria": "Volgende pagina",
    "assignments.pagination.pageNumberAria": "Pagina {n}",

    # assignments.actions (13)
    "assignments.actions.edit": "Bewerken",
    "assignments.actions.startInspection": "Inspectie starten",
    "assignments.actions.markDelivered": "Markeren als geleverd",
    "assignments.actions.markNotDelivered": "Markeren als niet geleverd",
    "assignments.actions.markCompleted": "Markeren als voltooid",
    "assignments.actions.cancel": "Annuleren",
    "assignments.actions.cancelDialogTitle": "Deze opdracht annuleren?",
    "assignments.actions.cancelDialogDescription": "Geannuleerde opdrachten kunnen niet meer worden bewerkt. Dit is zichtbaar in het activiteitenlogboek van het kantoor.",
    "assignments.actions.cancelDialogKeepIt": "Behouden",
    "assignments.actions.cancelDialogConfirm": "Opdracht annuleren",
    "assignments.actions.cancelReasonLabel": "Reden (optioneel)",
    "assignments.actions.cancelReasonHint": "Wordt als opmerking op de opdracht geplaatst zodat het kantoor context heeft.",
    "assignments.actions.cancelReasonPlaceholder": "Eigenaar bedacht zich, dubbele bestelling, enz.",

    # assignments.reassign (10)
    "assignments.reassign.assignTrigger": "Freelancer toewijzen",
    "assignments.reassign.changeTrigger": "Wijzigen",
    "assignments.reassign.reassignTitle": "Freelancer opnieuw toewijzen",
    "assignments.reassign.assignTitle": "Een freelancer toewijzen",
    "assignments.reassign.description": "Deze opdracht verschijnt dan in zijn of haar inspectielijst.",
    "assignments.reassign.outOfScopeWarning": "De huidige freelancer staat niet meer op de lijst van uw kantoor. Bij opslaan wordt de opdracht toegewezen aan wie u hieronder selecteert.",
    "assignments.reassign.rosterEmpty": "Er staan nog geen freelancers op de lijst van uw kantoor. Nodig er eerst een uit via de pagina Gebruikers.",
    "assignments.reassign.freelancerLabel": "Freelancer",
    "assignments.reassign.pickPlaceholder": "Selecteer een freelancer…",
    "assignments.reassign.searchPlaceholder": "Typ een naam of regio…",

    # assignments.completeForm (9)
    "assignments.completeForm.title": "{reference} voltooien",
    "assignments.completeForm.description": "Sluit de inspectie af en haal deze opdracht uit de actieve wachtrij.",
    "assignments.completeForm.submit": "Markeren als voltooid",
    "assignments.completeForm.servicesLabel": "Diensten",
    "assignments.completeForm.notesLabel": "Opmerkingen bij voltooiing",
    "assignments.completeForm.notesHint": "Wordt als opmerking op de opdracht geplaatst. Optioneel.",
    "assignments.completeForm.notesPlaceholder": "Alles verliep vlot. Eigenaar was ter plaatse, toegang was in orde.",
    "assignments.completeForm.finishedAtLabel": "Afgerond op",
    "assignments.completeForm.finishedAtHint": "Datum en tijdstip waarop het werk ter plaatse werd afgerond.",

    # assignments.filesButton (10)
    "assignments.filesButton.ariaLabelEmpty": "Geen bestanden voor {reference}",
    "assignments.filesButton.ariaLabelHasFiles": "Bestanden voor {reference}",
    "assignments.filesButton.titleEmpty": "Nog geen bestanden geüpload",
    "assignments.filesButton.modalTitle": "Bestanden",
    "assignments.filesButton.modalAriaLabel": "Bestanden voor {reference}",
    "assignments.filesButton.loading": "Laden…",
    "assignments.filesButton.empty": "Nog geen bestanden geüpload.",
    "assignments.filesButton.freelancerLane": "Lijn freelancer",
    "assignments.filesButton.realtorLane": "Lijn makelaar",
    "assignments.filesButton.download": "Downloaden",

    # assignments.odooSync (5)
    "assignments.odooSync.syncedTooltip": "Gesynchroniseerd — partner #{partnerId}, bestelling #{orderId}",
    "assignments.odooSync.warningFallback": "Gesynchroniseerd met waarschuwingen",
    "assignments.odooSync.failedFallback": "Synchronisatie mislukt — klik om opnieuw te proberen",
    "assignments.odooSync.pendingTooltip": "In afwachting — klik om nu te synchroniseren",
    "assignments.odooSync.requestFailed": "Verzoek mislukt",
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
