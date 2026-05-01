#!/usr/bin/env python3
"""Translate dashboard.announcements.* (list cluster only) to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # types
    "announcements.types.info": "Info",
    "announcements.types.success": "Succes",
    "announcements.types.warning": "Waarschuwing",
    "announcements.types.danger": "Belangrijk",
    # status
    "announcements.status.active": "Actief",
    "announcements.status.scheduled": "Ingepland",
    "announcements.status.expired": "Verlopen",
    "announcements.status.inactive": "Inactief",
    # meta
    "announcements.meta.sticky": "Vastgepind",
    "announcements.meta.systemAuthor": "Systeem",
    "announcements.meta.rangeWithCreator": "{start} → {end} · door {creator}",
    # topbar
    "announcements.topbar.title": "Aankondigingen",
    "announcements.topbar.subtitle": "Bannerberichten die aan gebruikers worden getoond",
    # actions
    "announcements.actions.new": "Nieuwe aankondiging",
    "announcements.actions.edit": "Bewerken",
    # empty
    "announcements.empty.title": "Nog geen aankondigingen",
    "announcements.empty.description": "Publiceer een banner om iedereen op het platform op de hoogte te brengen van updates, onderhoud of nieuwe functies.",
    # delete
    "announcements.delete.trigger": "Verwijderen",
    "announcements.delete.confirmLabel": "Verwijderen",
    "announcements.delete.cancelLabel": "Behouden",
    "announcements.delete.title": "\"{title}\" verwijderen?",
    "announcements.delete.description": "De aankondiging verdwijnt voor iedereen. Sluitingen per gebruiker worden eveneens gewist. Dit kan niet ongedaan worden gemaakt.",
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
