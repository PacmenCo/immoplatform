#!/usr/bin/env python3
"""Translate calendar namespaces (dashboard.calendar.* + calendar.json) to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL_DASHBOARD = ROOT / "messages" / "nl-BE" / "dashboard.json"
NL_CALENDAR = ROOT / "messages" / "nl-BE" / "calendar.json"

DASHBOARD_PATCHES: dict[str, str] = {
    "calendar.topbarTitle": "Agenda",
    "calendar.filters.previous": "Vorige",
    "calendar.filters.next": "Volgende",
    "calendar.filters.today": "Vandaag",
    "calendar.filters.viewWeek": "Week",
    "calendar.filters.viewMonth": "Maand",
    "calendar.weekdays.mon": "Ma",
    "calendar.weekdays.tue": "Di",
    "calendar.weekdays.wed": "Wo",
    "calendar.weekdays.thu": "Do",
    "calendar.weekdays.fri": "Vr",
    "calendar.weekdays.sat": "Za",
    "calendar.weekdays.sun": "Zo",
    "calendar.months.january": "Januari",
    "calendar.months.february": "Februari",
    "calendar.months.march": "Maart",
    "calendar.months.april": "April",
    "calendar.months.may": "Mei",
    "calendar.months.june": "Juni",
    "calendar.months.july": "Juli",
    "calendar.months.august": "Augustus",
    "calendar.months.september": "September",
    "calendar.months.october": "Oktober",
    "calendar.months.november": "November",
    "calendar.months.december": "December",
    "calendar.events.noAssignments": "Geen opdrachten",
    "calendar.events.fallbackShort": "—",
}

CALENDAR_PATCHES: dict[str, str] = {
    "eventDescription.addressLabel": "Adres",
    "eventDescription.appointmentLabel": "Afspraak",
    "eventDescription.areaLabel": "Oppervlakte",
    "eventDescription.propertyTypeLabel": "Type pand",
    "eventDescription.keyPickupLabel": "Sleutelafhaling",
    "eventDescription.keyPickupAtOffice": "Op te halen op het kantoor",
    "eventDescription.keyPickupAtAddress": "Op: {address}",
    "eventDescription.keyPickupAtSeparateAddress": "Op een ander adres",
    "eventDescription.realtorLabel": "Makelaar",
    "eventDescription.ownerLabel": "Eigenaar",
    "eventDescription.tenantLabel": "Huurder",
    "eventDescription.yourContactSuffix": "(Uw contactpersoon)",
    "eventDescription.notesLabel": "Opmerkingen",
    "eventDescription.recentActivity": "Recente activiteit:",
    "eventDescription.commentWrote": "schreef",
    "eventDescription.commentAuthorPlaceholder": "—",
    "eventDescription.openAssignmentLink": "Opdracht openen →",
    "eventDescription.largePropertyMarker": "Groot pand (> 300 m²)",
    "eventDescription.standardArea": "Standaard (≤ 300 m²)",
    "eventDescription.standardAreaWithSize": "Standaard (≤ 300 m²) (~ {area} m²)",
    "eventDescription.clientFallback": "KLANT",
    "eventDescription.officeFallback": "KANTOOR",
    "propertyType.house": "Huis",
    "propertyType.apartment": "Appartement",
    "propertyType.studio_appartement": "Studio / appartement",
    "propertyType.studio_room": "Studentenkamer",
    "propertyType.commercial": "Handelspand",
    "propertyType.office": "Kantoor",
    "propertyType.villa": "Villa",
    "propertyType.land": "Grond",
}


def set_path(d, path, value):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    for catalog_path, patches in [(NL_DASHBOARD, DASHBOARD_PATCHES), (NL_CALENDAR, CALENDAR_PATCHES)]:
        catalog = json.loads(catalog_path.read_text())
        for path, value in patches.items():
            set_path(catalog, path, value)
        catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied {len(DASHBOARD_PATCHES)} dashboard + {len(CALENDAR_PATCHES)} calendar translations.")


if __name__ == "__main__":
    main()
