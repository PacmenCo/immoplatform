#!/usr/bin/env python3
"""Translate common.json + emails.json + calendar.json identity-EN leftovers
to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
HASHES = ROOT / "messages" / "_hashes.json"

NL_COMMON = ROOT / "messages" / "nl-BE" / "common.json"
NL_EMAILS = ROOT / "messages" / "nl-BE" / "emails.json"

COMMON_PATCHES: dict[str, str] = {
    "actions.login": "Aanmelden",
    "actions.register": "Registreren",
    "actions.about": "Over ons",
    "actions.contact": "Contact",
    "nav.homeAriaLabel": "immoplatform.be — home",
    "nav.services": "Diensten",
    "nav.howItWorks": "Hoe het werkt",
    "nav.register": "Registreren als makelaar",
    "footer.tagline": "Eén platform voor elk vastgoedcertificaat in België.",
    "footer.columns.services.title": "Diensten",
    "footer.columns.services.links.epc": "Energieprestatiecertificaat (EPC)",
    "footer.columns.services.links.asbestos": "Asbestinventarisattest (AIV)",
    "footer.columns.services.links.electrical": "Elektrische keuring (EK)",
    "footer.columns.services.links.fuel": "Stookolietankcontrole (TK)",
    "footer.columns.company.title": "Bedrijf",
    "footer.columns.account.title": "Account",
    "footer.columns.legal.title": "Juridisch",
    "footer.columns.legal.links.privacy": "Privacybeleid",
    "footer.columns.legal.links.terms": "Algemene voorwaarden",
    "footer.columns.legal.links.cookies": "Cookies",
    "footer.copyright": "© {year} {brand}. Alle rechten voorbehouden.",
    # Brand names — stay untranslated per don't-translate list
    "footer.brandsLine": "Asbest Experts · EPC Partner · Elec Inspect · Tank Check",
    "localeSwitcher.label": "Taal",
    # Language names — keep self-referential ("English" is what English speakers
    # see; "Nederlands" is what Dutch speakers see)
    "localeSwitcher.en": "English",
    "localeSwitcher.nl-BE": "Nederlands",
}

EMAILS_PATCHES: dict[str, str] = {
    "common.hi": "Beste {name},",
    "invite.teamLine": "Kantoor: {teamName}",
    "invite.teamLineWithRole": "Kantoor: {teamName} ({teamRole})",
    # "Onbekend" / "Niet opgegeven" / "Niet aangemaakt" are already correct Dutch
    # in the EN catalog — leave them, they're appropriate for both languages.
}


def set_path(d, path, value):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    for catalog_path, namespace, patches in [
        (NL_COMMON, "common", COMMON_PATCHES),
        (NL_EMAILS, "emails", EMAILS_PATCHES),
    ]:
        if not patches:
            continue
        catalog = json.loads(catalog_path.read_text())
        for path, value in patches.items():
            set_path(catalog, path, value)
        catalog_path.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")

        # Clear stale hashes
        hashes = json.loads(HASHES.read_text())
        nl_ns = hashes.get("nl-BE", {}).get(namespace, {})
        for path in patches:
            if path in nl_ns:
                del nl_ns[path]
        HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n")

    print(
        f"Applied {len(COMMON_PATCHES)} common + {len(EMAILS_PATCHES)} emails translations."
    )


if __name__ == "__main__":
    main()
