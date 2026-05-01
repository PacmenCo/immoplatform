#!/usr/bin/env python3
"""Translate dashboard.activity.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # topbar
    "activity.topbar.title": "Activiteitsoverzicht",
    "activity.topbar.subtitle": "{count} recente gebeurtenissen",

    # card
    "activity.card.title": "Gebeurtenissen",

    # empty
    "activity.empty.title": "Nog geen activiteit",
    "activity.empty.description": "Wijzigingen binnen het platform verschijnen hier zodra ze plaatsvinden.",

    # table
    "activity.table.timestamp": "Tijdstip",
    "activity.table.actor": "Actor",
    "activity.table.action": "Actie",
    "activity.table.target": "Onderwerp",

    # kinds (category labels for activity verbs)
    "activity.kinds.auth": "Authenticatie",
    "activity.kinds.create": "Aangemaakt",
    "activity.kinds.update": "Bijgewerkt",
    "activity.kinds.status": "Status gewijzigd",
    "activity.kinds.delete": "Verwijderd",
    "activity.kinds.system": "Systeem",

    # actor
    "activity.actor.system": "Systeem",
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
