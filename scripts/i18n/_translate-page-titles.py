#!/usr/bin/env python3
"""Translate dashboard.pageTitles.* to nl-BE. Idempotent.
These were 'translated' as identity-EN earlier; this fixes them properly."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {
    "pageTitles.activity": "Activiteit",
    "pageTitles.assignment": "Opdracht",
    "pageTitles.assignments": "Opdrachten",
    "pageTitles.calendar": "Agenda",
    "pageTitles.commissions": "Commissies",
    "pageTitles.contactMessages": "Contactberichten",
    "pageTitles.dashboard": "Dashboard",
    "pageTitles.emails": "E-mailsjablonen",
    "pageTitles.notFound": "Niet gevonden",
    "pageTitles.odooProducts": "Odoo-productkoppelingen",
    "pageTitles.overview": "Overzicht",
    "pageTitles.settings": "Instellingen",
    "pageTitles.teams": "Kantoren",
    "pageTitles.users": "Gebruikers",
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

    # Clear stale hashes so sync re-records for the new values
    hashes = json.loads(HASHES.read_text())
    nl_dash = hashes.get("nl-BE", {}).get("dashboard", {})
    for path in PATCHES:
        if path in nl_dash:
            del nl_dash[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n")

    print(f"Applied {len(PATCHES)} translations + cleared {len(PATCHES)} hashes.")


if __name__ == "__main__":
    main()
