#!/usr/bin/env python3
"""
Adds dashboard-side per-service titles + descriptions to messages/{en,nl-BE}/services.json.

The marketing site already uses keys like services.epc.hero / .body. The
dashboard surfaces (assignment form service-cards, AssignedToCard chips)
need shorter title + description fields. Add these as siblings under each
service's namespace; they are independent from marketing content.

EN values mirror the current DB seed (which mirrors mockData.ts SERVICES).
nl-BE values use the v1 vocabulary plus official Belgian terms (AIV =
Asbestinventarisattest, EPC = Energieprestatiecertificaat, AREI keuring,
etc.).

Idempotent. Run:
    python3 scripts/i18n/_apply-service-translations.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
EN = ROOT / "messages" / "en" / "services.json"
NL = ROOT / "messages" / "nl-BE" / "services.json"

EN_PATCH = {
    "epc": {
        "title": "Energy Performance Certificate",
        "dashboardDescription": "Legally required energy rating for every sale or rental.",
    },
    "asbestos": {
        "title": "Asbestos Inventory Attest",
        "dashboardDescription": "Mandatory asbestos inventory for buildings from before 2001.",
    },
    "electrical": {
        "title": "Electrical Inspection",
        "dashboardDescription": "AREI installation inspection for safe electrical systems.",
    },
    "fuel": {
        "title": "Fuel Tank Check",
        "dashboardDescription": "Periodic inspection for above-ground and buried fuel tanks.",
    },
    "photos": {
        "title": "Property Photography",
        "dashboardDescription": "Professional listing photography for sales and rentals.",
    },
    "signage": {
        "title": "On-site Signage",
        "dashboardDescription": "Mounted For-Sale / For-Rent signage at the property.",
    },
}

NL_PATCH = {
    "epc": {
        "title": "Energieprestatiecertificaat",
        "dashboardDescription": "Wettelijk verplichte energiebeoordeling voor elke verkoop of verhuur.",
    },
    "asbestos": {
        "title": "Asbestinventarisattest",
        "dashboardDescription": "Verplichte asbestinventaris voor gebouwen van vóór 2001.",
    },
    "electrical": {
        "title": "Elektrische keuring",
        "dashboardDescription": "AREI-keuring voor veilige elektrische installaties.",
    },
    "fuel": {
        "title": "Stookolietankcontrole",
        "dashboardDescription": "Periodieke controle voor bovengrondse en ondergrondse stookolietanks.",
    },
    "photos": {
        "title": "Pandfotografie",
        "dashboardDescription": "Professionele fotografie voor verkoop en verhuur.",
    },
    "signage": {
        "title": "Verkoop-/verhuurbord",
        "dashboardDescription": "Geplaatst Te-koop/Te-huur-bord op het pand.",
    },
}


def patch(path: Path, additions: dict[str, dict[str, str]]) -> None:
    catalog = json.loads(path.read_text())
    for service_key, fields in additions.items():
        catalog.setdefault(service_key, {}).update(fields)
    path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")


def main() -> None:
    patch(EN, EN_PATCH)
    patch(NL, NL_PATCH)
    pairs = sum(len(v) for v in EN_PATCH.values())
    print(f"Wrote {pairs} per-service title/description pairs to both catalogs.")


if __name__ == "__main__":
    main()
