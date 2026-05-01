#!/usr/bin/env python3
"""Translate dashboard.users.list.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "users.list.topbarTitle": "Gebruikers",
    "users.list.topbarSubtitle": "{count, plural, one {# persoon} other {# personen}}",
    "users.list.filterAll": "Alle",
    "users.list.searchPlaceholder": "Zoeken op naam of e-mailadres…",
    "users.list.inviteUser": "Gebruiker uitnodigen",
    "users.list.columns.user": "Gebruiker",
    "users.list.columns.role": "Rol",
    "users.list.columns.team": "Kantoor",
    "users.list.columns.joined": "Lid sinds",
    "users.list.columns.lastSeen": "Laatst gezien",
    "users.list.columns.actions": "Acties",
    "users.list.noTeam": "—",
    "users.list.lastSeen.online": "Online",
    "users.list.lastSeen.never": "Nooit",
    "users.list.lastSeen.justNow": "Zonet",
    "users.list.lastSeen.minutesAgo": "{count} min. geleden",
    "users.list.lastSeen.hoursAgo": "{count} u geleden",
    "users.list.lastSeen.daysAgo": "{count} d geleden",
    "users.list.lastSeen.monthsAgo": "{count} mnd geleden",
    "users.list.lastSeen.yearsAgo": "{count} j geleden",
    "users.list.viewUserAriaLabel": "{name} bekijken",
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
