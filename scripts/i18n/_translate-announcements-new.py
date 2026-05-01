#!/usr/bin/env python3
"""Translate dashboard.announcements.new.* and dashboard.shared.announcementForm.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # announcements.new.*
    "announcements.new.title": "Nieuwe aankondiging",
    "announcements.new.subtitle": "Maak een banner-bericht aan voor gebruikers",

    # shared.announcementForm.*
    "shared.announcementForm.contentTitle": "Inhoud",
    "shared.announcementForm.title": "Titel",
    "shared.announcementForm.titleHint": "Wordt vetgedrukt getoond op de banner",
    "shared.announcementForm.titlePlaceholder": "bv. Gepland onderhoud op 20 april",
    "shared.announcementForm.body": "Bericht",
    "shared.announcementForm.bodyHint": "Een of twee korte zinnen werken het best",
    "shared.announcementForm.bodyPlaceholder": "Beschrijf wat er gebeurt, wanneer, en wat gebruikers moeten doen.",
    "shared.announcementForm.type": "Type",
    "shared.announcementForm.typeInfo": "Info",
    "shared.announcementForm.typeSuccess": "Succes",
    "shared.announcementForm.typeWarning": "Waarschuwing",
    "shared.announcementForm.typeDanger": "Gevaar",
    "shared.announcementForm.startDate": "Startdatum",
    "shared.announcementForm.endDate": "Einddatum",
    "shared.announcementForm.visibilityTitle": "Zichtbaarheid",
    "shared.announcementForm.active": "Actief",
    "shared.announcementForm.activeDescription": "Vink uit om als concept op te slaan zonder te publiceren.",
    "shared.announcementForm.dismissible": "Sluitbaar door gebruiker",
    "shared.announcementForm.dismissibleDescription": "Laat elke gebruiker de banner zelf sluiten. Vastgepinde aankondigingen kunnen enkel door een beheerder gesloten worden.",
    "shared.announcementForm.previewTitle": "Voorbeeld",
    "shared.announcementForm.previewTitleFallback": "Uw titel verschijnt hier",
    "shared.announcementForm.previewBodyFallback": "Berichttekst wordt op deze manier getoond aan alle gebruikers binnen het actieve venster.",
    "shared.announcementForm.submitCreate": "Aankondiging publiceren",
    "shared.announcementForm.submitEdit": "Wijzigingen opslaan",
    "shared.announcementForm.cancel": "Annuleren",
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
