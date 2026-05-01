#!/usr/bin/env python3
"""Translate dashboard.teams.list.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "teams.list.topbarTitle": "Kantoren",
    "teams.list.topbarSubtitle": "{count, plural, one {# kantoor} other {# kantoren}}",
    "teams.list.founderBanner.titleFromGate": "U heeft eerst een kantoor nodig om dit onderdeel te kunnen gebruiken.",
    "teams.list.founderBanner.titleDefault": "Uw kantoor is nog niet ingesteld.",
    "teams.list.founderBanner.bodyCanFound": "Maak uw kantoor aan om van start te gaan — daarna kunt u collega's uitnodigen en certificaten bestellen.",
    "teams.list.founderBanner.bodyCannotFound": "Vraag een beheerder om uw kantoor aan te maken, of neem contact op met support als u een nieuwe eigenaar van een makelaarskantoor bent.",
    "teams.list.founderBanner.createOffice": "Uw kantoor aanmaken",
    "teams.list.founderBanner.contactSupport": "Contact opnemen",
    "teams.list.headline": "{count, plural, one {# partnerkantoor} other {# partnerkantoren}} in België",
    "teams.list.createTeam": "Kantoor aanmaken",
    "teams.list.searchPlaceholder": "Zoeken op kantoornaam, gemeente of eigenaar…",
    "teams.list.empty.noMatchTitle": "Geen kantoren gevonden voor die zoekopdracht",
    "teams.list.empty.noMatchDescription": "Niets gevonden voor \"{query}\". Probeer een andere naam, gemeente of eigenaar.",
    "teams.list.empty.noTeamsTitle": "Nog geen kantoren",
    "teams.list.empty.noTeamsDescription": "Maak uw eerste makelaarskantoor aan. U kunt vervolgens leden toevoegen, commissieregels instellen en certificaten in hun naam bestellen.",
    "teams.list.empty.createFirst": "Eerste kantoor aanmaken",
    "teams.list.columns.office": "Kantoor",
    "teams.list.columns.owner": "Eigenaar",
    "teams.list.columns.members": "Leden",
    "teams.list.columns.assignments": "Opdrachten",
    "teams.list.mobile.owner": "Eigenaar",
    "teams.list.mobile.members": "Leden",
    "teams.list.mobile.assignments": "Opdrachten",
    "teams.list.noCity": "—",
    "teams.list.noOwner": "—",
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
