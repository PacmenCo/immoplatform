#!/usr/bin/env python3
"""Translate dashboard.freelancer.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "freelancer.topbarTitle": "Freelancer",
    "freelancer.topbarSubtitle": "Uw dag, uw opdrachten, uw uploads",
    "freelancer.ariaStatsTitle": "Kerncijfers",
    "freelancer.stats.todaysJobs": "Opdrachten vandaag",
    "freelancer.stats.thisWeek": "Deze week",
    "freelancer.stats.inProgress": "In uitvoering",
    "freelancer.stats.completedThisMonth": "Voltooid deze maand",
    "freelancer.today.heading": "Planning voor vandaag",
    "freelancer.today.openCalendar": "Agenda openen",
    "freelancer.today.appointmentsCount": "· {count, plural, one {# afspraak} other {# afspraken}}",
    "freelancer.today.onTrack": "Op schema",
    "freelancer.today.emptyTitle": "Geen inspecties ingepland voor vandaag",
    "freelancer.today.emptyDescription": "Geniet van de rustpauze. Komende inspecties verschijnen hier zodra ze worden ingepland.",
    "freelancer.recent.heading": "Recent voltooid",
    "freelancer.recent.viewAll": "Alles bekijken",
    "freelancer.recent.emptyTitle": "Nog niets opgeleverd",
    "freelancer.recent.emptyDescription": "Opdrachten die u als geleverd of voltooid markeert, verschijnen hier zodat u er voor opvolging snel naar kunt terugkeren.",
    "freelancer.recent.signedOff": "Afgetekend",
    "freelancer.recent.datePlaceholder": "—",
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
