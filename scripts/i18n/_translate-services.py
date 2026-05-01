#!/usr/bin/env python3
"""Translate services.json (marketing service detail pages) to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "services.json"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {
    # shared
    "shared.backLink": "← Alle diensten",
    "shared.orderPrefix": "Bestellen",
    "shared.howItWorks": "Hoe het werkt",
    "shared.whatYouGet": "Wat u ontvangt",
    "shared.everythingHandled": "Alles geregeld, niets vergeten.",
    "shared.turnaroundLabel": "Doorlooptijd",
    "shared.regulationLabel": "Regelgeving",
    "shared.whoLabel": "Voor wie",
    "shared.bundleHeading": "Combineren & besparen",
    "shared.bundleBody": "Bestel deze samen met andere certificaten en geniet van een gebundelde korting op elke opdracht.",

    # epc
    "epc.hero": "Energieprestatiecertificaten, snel afgeleverd.",
    "epc.body": "Het Energieprestatiecertificaat (EPC) is verplicht bij elke verkoop of verhuur van een woning in België. Onze gecertificeerde deskundigen leveren de documentatie binnen enkele dagen — uw makelaars houden nooit meer een ondertekening op.",
    "epc.bullet1": "Gecertificeerde EPC-deskundigen in Vlaanderen, Brussel & Wallonië",
    "epc.bullet2": "Digitale oplevering (PDF + VEKA-melding) binnen 3 werkdagen",
    "epc.bullet3": "Combinatiekorting bij bestelling samen met andere diensten",
    "epc.bullet4": "Ondersteuning voor herkeuring na renovatie",
    "epc.turnaround": "3 werkdagen",
    "epc.regulation": "Verplicht volgens de regelgeving van het Vlaams Energieagentschap (VEKA)",
    "epc.who": "Elke woning die in België verkocht of verhuurd wordt",

    # asbestos
    "asbestos.hero": "Asbestinventarisattesten, zonder verrassingen.",
    "asbestos.body": "Het Asbestinventarisattest (AIV) is wettelijk verplicht bij de verkoop van elk gebouw van vóór 2001. Onze gecertificeerde asbestdeskundigen inspecteren, bemonsteren en certificeren met doorlooptijden waar de meeste kantoren enkel van kunnen dromen.",
    "asbestos.bullet1": "Gecertificeerde OVAM-deskundigen",
    "asbestos.bullet2": "Niet-destructieve bemonstering waar mogelijk",
    "asbestos.bullet3": "Wettelijk geldig attest, ondertekend binnen 5 werkdagen",
    "asbestos.bullet4": "Gekoppeld aan uw opdracht — geen dubbele invoer",
    "asbestos.turnaround": "5 werkdagen",
    "asbestos.regulation": "Verplicht volgens de Vlaamse OVAM-regelgeving voor gebouwen van vóór 2001",
    "asbestos.who": "Elke verkoper van een residentieel of commercieel gebouw van vóór 2001",

    # electrical
    "electrical.hero": "AREI-conforme elektrische keuringen.",
    "electrical.body": "De Elektrische keuring (EK) waarborgt dat het pand voldoet aan de Belgische AREI-veiligheidsvoorschriften. Verplicht bij verkoop en na grondige renovatiewerken — en het eerste waar de notaris van de koper naar zal vragen.",
    "electrical.bullet1": "AGORIA-gecertificeerde elektrische deskundigen",
    "electrical.bullet2": "Conform keuringsverslag volgens de AREI-normen",
    "electrical.bullet3": "Herkeuring na herstelling",
    "electrical.bullet4": "Geïntegreerd in hetzelfde dashboard als uw andere certificaten",
    "electrical.turnaround": "4 werkdagen",
    "electrical.regulation": "Conformiteit met het AREI (Algemeen Reglement op de Elektrische Installaties)",
    "electrical.who": "Elk pand dat verkocht wordt of waar recent elektrische werken zijn uitgevoerd",

    # fuel
    "fuel.hero": "Stookolietankcontroles, correct uitgevoerd.",
    "fuel.body": "Stookolietankcontroles (TK) zijn periodiek verplicht voor bovengrondse en ondergrondse stookolietanks in Vlaanderen. Wij plannen, inspecteren, leveren het attest af en verwittigen u vóór de volgende keuring vervalt — zo houdt een routinecontrole nooit een verkoop op.",
    "fuel.bullet1": "Gecertificeerde stookolietank-deskundigen",
    "fuel.bullet2": "Specialisaties voor ondergrondse en bovengrondse tanks",
    "fuel.bullet3": "Automatische herinneringen vóór herkeuringsvervaldatums",
    "fuel.bullet4": "Milieuconformiteit standaard inbegrepen",
    "fuel.turnaround": "5 werkdagen",
    "fuel.regulation": "Periodieke keuringsvereisten volgens VLAREM II",
    "fuel.who": "Eigenaars en makelaars met stookolietanks op het pand",

    # photos
    "photos.hero": "Pandfotografie die sneller verkoopt.",
    "photos.body": "Professionele pandfotografie voor residentieel en commercieel vastgoed — groothoekopnamen, uitgebalanceerde belichting en een doorlooptijd die past bij het tempo van uw publicatiestroom.",
    "photos.bullet1": "Groothoekopnamen interieur + exterieur",
    "photos.bullet2": "Bewerkte, publicatieklare JPEG's nog dezelfde dag opgeleverd",
    "photos.bullet3": "Optionele drone-opnamen voor villa's en grote panden",
    "photos.bullet4": "Geïntegreerd in uw bestaande opdrachtworkflow",
    "photos.turnaround": "Oplevering dezelfde dag",
    "photos.regulation": "—",
    "photos.who": "Makelaars die residentieel of commercieel vastgoed publiceren",

    # signage
    "signage.hero": "Borden ter plaatse, geplaatst en klaar.",
    "signage.body": "Wij leveren en plaatsen Te-koop- en Te-huur-borden bij het pand, en fotograferen ze na plaatsing zodat uw publicatie online kan op dezelfde dag als de inspectie.",
    "signage.bullet1": "Standaard A-frames en paalborden",
    "signage.bullet2": "Voorzien van de huisstijl en contactgegevens van uw kantoor",
    "signage.bullet3": "Plaatsingsfoto voor uw dossier",
    "signage.bullet4": "Ophalen + verwijderen aan het einde van de publicatie",
    "signage.turnaround": "Plaatsing dezelfde dag",
    "signage.regulation": "—",
    "signage.who": "Makelaars die zichtbaarheid willen ter plaatse op het pand",
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

    hashes = json.loads(HASHES.read_text())
    nl_services = hashes.get("nl-BE", {}).get("services", {})
    for path in PATCHES:
        if path in nl_services:
            del nl_services[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n")

    print(f"Applied {len(PATCHES)} translations + cleared hashes.")

if __name__ == "__main__":
    main()
