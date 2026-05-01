#!/usr/bin/env python3
"""Translate dashboard.overview.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # Topbar
    "overview.topbarTitle": "Omzetoverzicht",

    # Stats cards
    "overview.stats.revenue": "Omzet",
    "overview.stats.revenueHintCompleted": "{count} voltooid",
    "overview.stats.revenueHintCompletedWithAdj": "{count} voltooid · {adjustment} aanp.",
    "overview.stats.commissionAccrued": "Opgebouwde commissie",
    "overview.stats.commissionAccruedHint": "Over alle in aanmerking komende kantoren",
    "overview.stats.commissionPaid": "Uitbetaalde commissie",
    "overview.stats.commissionPaidHint": "Uitbetalingen in deze periode",
    "overview.stats.outstanding": "Openstaand",
    "overview.stats.outstandingHint": "Opgebouwd minus uitbetaald",

    # Period tabs
    "overview.periodTabs.month": "Maand",
    "overview.periodTabs.quarter": "Kwartaal",
    "overview.periodTabs.year": "Jaar",

    # Months (short)
    "overview.months.jan": "jan",
    "overview.months.feb": "feb",
    "overview.months.mar": "mrt",
    "overview.months.apr": "apr",
    "overview.months.may": "mei",
    "overview.months.jun": "jun",
    "overview.months.jul": "jul",
    "overview.months.aug": "aug",
    "overview.months.sep": "sep",
    "overview.months.oct": "okt",
    "overview.months.nov": "nov",
    "overview.months.dec": "dec",

    # Months (long)
    "overview.monthsLong.january": "januari",
    "overview.monthsLong.february": "februari",
    "overview.monthsLong.march": "maart",
    "overview.monthsLong.april": "april",
    "overview.monthsLong.may": "mei",
    "overview.monthsLong.june": "juni",
    "overview.monthsLong.july": "juli",
    "overview.monthsLong.august": "augustus",
    "overview.monthsLong.september": "september",
    "overview.monthsLong.october": "oktober",
    "overview.monthsLong.november": "november",
    "overview.monthsLong.december": "december",

    # By month chart
    "overview.byMonth.title": "Omzet per maand",
    "overview.byMonth.monthsCount": "{count} maanden",

    # By service
    "overview.byService.title": "Per dienst",
    "overview.byService.empty": "Geen dienstomzet in deze periode.",
    "overview.byService.total": "Totaal",

    # By team (Per kantoor)
    "overview.byTeam.title": "Per kantoor",
    "overview.byTeam.subtitle": "Omzet, opgebouwde commissie en uitbetalingen voor {period}.",
    "overview.byTeam.managePayouts": "Uitbetalingen beheren →",
    "overview.byTeam.emptyTitle": "Geen omzet geboekt in {period}",
    "overview.byTeam.emptyDescriptionFiltered": "Geen omzet voor dat kantoor in deze periode. Probeer de kantoorfilter te verwijderen of een andere periode te kiezen.",
    "overview.byTeam.emptyDescriptionDefault": "Omzet wordt geboekt zodra een opdracht de status 'Voltooid' bereikt. In deze periode is nog niets voltooid.",
    "overview.byTeam.headerTeam": "Kantoor",
    "overview.byTeam.headerAssignments": "Opdrachten",
    "overview.byTeam.headerRevenue": "Omzet",
    "overview.byTeam.headerCommission": "Commissie",
    "overview.byTeam.headerPaid": "Uitbetaald",
    "overview.byTeam.headerStatus": "Status",
    "overview.byTeam.headerPayout": "Uitbetaling",
    "overview.byTeam.statusNoCommission": "Geen commissie",
    "overview.byTeam.statusPaid": "Uitbetaald",
    "overview.byTeam.statusPartial": "Gedeeltelijk",
    "overview.byTeam.statusOutstanding": "Openstaand",
    "overview.byTeam.noPayoutDash": "—",

    # Filters
    "overview.filters.filterByTeam": "Filteren op kantoor",
    "overview.filters.allTeams": "Alle kantoren",

    # Adjustments
    "overview.adjustments.title": "Handmatige aanpassingen",
    "overview.adjustments.description": "Boekhoudkundige correcties, bonussen en aftrekposten voor {period}. Negatieve bedragen worden afgetrokken van de geboekte omzet.",
    "overview.adjustments.addAdjustment": "Aanpassing toevoegen",
    "overview.adjustments.fieldTeam": "Kantoor",
    "overview.adjustments.fieldYear": "Jaar",
    "overview.adjustments.fieldMonth": "Maand",
    "overview.adjustments.fieldDescription": "Omschrijving",
    "overview.adjustments.descriptionPlaceholder": "bv. Late factuur vereffend in maart",
    "overview.adjustments.fieldAmount": "Bedrag (€)",
    "overview.adjustments.amountHint": "Gebruik een negatief getal voor aftrekposten",
    "overview.adjustments.amountPlaceholder": "bv. 150 of -50,00",
    "overview.adjustments.save": "Opslaan",
    "overview.adjustments.cancel": "Annuleren",
    "overview.adjustments.emptyForPeriod": "Geen aanpassingen voor {period}.",
    "overview.adjustments.headerTeam": "Kantoor",
    "overview.adjustments.headerMonth": "Maand",
    "overview.adjustments.headerDescription": "Omschrijving",
    "overview.adjustments.headerAmount": "Bedrag",
    "overview.adjustments.headerAddedBy": "Toegevoegd door",
    "overview.adjustments.addedByFallback": "—",
    "overview.adjustments.total": "Totaal",
    "overview.adjustments.deleteTitle": "Deze aanpassing verwijderen?",
    "overview.adjustments.deleteDescription": "{amount} · {team} · {description}. Dit kan niet ongedaan worden gemaakt.",
    "overview.adjustments.deleteNoDescription": "Geen omschrijving",
    "overview.adjustments.deleteConfirm": "Verwijderen",
    "overview.adjustments.deleteCancel": "Behouden",
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
