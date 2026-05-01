#!/usr/bin/env python3
"""Translate dashboard.commissions.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "commissions.topbarTitle": "Commissies",
    "commissions.topbarSubtitle": "{year} · K{quarter} · {total} totaal",
    "commissions.yearLabel": "Jaar",
    "commissions.quarterLabel": "Kwartaal",
    "commissions.markPaid": "Markeren als uitbetaald",
    "commissions.markUnpaid": "Markeren als niet-uitbetaald",
    "commissions.stats.accrued": "Opgebouwd dit kwartaal",
    "commissions.stats.accruedSubtitle": "Verdeeld over {count, plural, one {# kantoor} other {# kantoren}}",
    "commissions.stats.outstanding": "Openstaand",
    "commissions.stats.outstandingSubtitle": "In afwachting van bevestiging van uitbetaling",
    "commissions.stats.paidOut": "Uitbetaald",
    "commissions.stats.paidOutSubtitle": "{paid} van {total} kantoren uitbetaald",
    "commissions.table.title": "Kantoren",
    "commissions.table.subtitle": "Klik op een rij om het overzicht per opdracht voor dat kantoor te bekijken.",
    "commissions.table.emptyTitle": "Nog geen commissies voor K{quarter} {year}",
    "commissions.table.emptyDescription": "Commissieregels worden aangemaakt zodra een opdracht de status 'voltooid' bereikt. Er is dit kwartaal nog niets voltooid — of geen enkele voltooide opdracht bevatte een asbestdienst.",
    "commissions.table.headerTeam": "Kantoor",
    "commissions.table.headerLines": "Regels",
    "commissions.table.headerTotal": "Totaal",
    "commissions.table.headerStatus": "Status",
    "commissions.table.headerAction": "Actie",
    "commissions.table.statusOutstanding": "Openstaand",
    "commissions.table.statusPaidOn": "Uitbetaald op {date}",
    "commissions.table.statusPaidBy": "door {name}",
    "commissions.breakdown.title": "Overzicht",
    "commissions.breakdown.subtitle": "Elke commissieregel voor {team} in K{quarter} {year}.",
    "commissions.breakdown.headerAssignment": "Opdracht",
    "commissions.breakdown.headerProperty": "Pand",
    "commissions.breakdown.headerCompleted": "Voltooid",
    "commissions.breakdown.headerTotal": "Totaal",
    "commissions.breakdown.headerRate": "Tarief",
    "commissions.breakdown.headerCommission": "Commissie",
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
