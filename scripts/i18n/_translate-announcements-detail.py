#!/usr/bin/env python3
"""Translate dashboard.announcements.detail.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "announcements.detail.subtitle": "Aankondigingsgegevens",
    "announcements.detail.timing.title": "Timing & zichtbaarheid",
    "announcements.detail.timing.activeWindow": "Actief venster",
    "announcements.detail.timing.activeWindowValue": "{start} → {end}",
    "announcements.detail.timing.published": "Gepubliceerd",
    "announcements.detail.timing.publishedYes": "Ja",
    "announcements.detail.timing.publishedDraft": "Concept",
    "announcements.detail.timing.dismissible": "Wegklikbaar",
    "announcements.detail.timing.dismissibleYes": "Ja · {count} weggeklikt",
    "announcements.detail.timing.dismissibleNo": "Nee (vastgepind)",
    "announcements.detail.timing.author": "Auteur",
    "announcements.detail.timing.created": "Aangemaakt",
    "announcements.detail.timing.lastUpdated": "Laatst bijgewerkt",
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
