#!/usr/bin/env python3
"""Translate home.json to nl-BE. Idempotent.
Replaces identity-EN entries (which i18n:check considers 'in-sync'
because hashes were recorded against EN==nl-BE values)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "home.json"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {
    # hero
    "hero.badge": "4 bedrijven. 1 platform.",
    "hero.title": "Eén platform voor elk vastgoedcertificaat.",
    "hero.subtitle": "Energieprestatiecertificaten, asbestinventarisattesten, elektrische keuringen en stookolietankcontroles — besteld, opgevolgd en opgeleverd vanuit één dashboard. Gebouwd voor vastgoedmakelaars in België.",
    "hero.ctaRegister": "Registreer uw kantoor",
    "hero.ctaSeeServices": "Ontdek onze diensten",
    "hero.preview.ref": "ASG-2041",
    "hero.preview.status": "Geleverd",
    "hero.preview.address": "Belliardstraat 12",
    "hero.preview.addressDetail": "1040 Brussel · Appartement, 120 m²",
    "hero.preview.freelancerLabel": "Freelancer",
    "hero.preview.freelancerName": "Tim De Vries",
    "hero.preview.turnaroundLabel": "Doorlooptijd",
    "hero.preview.turnaroundValue": "4 dagen",
    "hero.preview.toastTitle": "Certificaat verzonden",
    "hero.preview.toastBody": "Ondertekend door eigenaar · zonet",
    # services
    "services.eyebrow": "Diensten",
    "services.heading": "Elk certificaat dat een pand nodig heeft, onder één dak.",
    "services.lead": "Kies één dienst of bundel alle vier in dezelfde opdracht. Eén factuur, één aanspreekpunt, één dashboard.",
    "services.whenLabel": "Wanneer",
    "services.validityLabel": "Geldigheid",
    "services.learnMore": "Meer weten",
    "services.cards.epc.title": "Energieprestatiecertificaat",
    "services.cards.epc.tagline": "EPC",
    "services.cards.epc.description": "Energieprestatiebeoordeling die op de pandadvertentie wordt getoond. Het certificaat geeft de energieklasse weer (A → G) en moet beschikbaar zijn voordat het pand te koop of te huur wordt aangeboden.",
    "services.cards.epc.whenNeeded": "Vóór publicatie van een verkoop of verhuur",
    "services.cards.epc.validity": "10 jaar",
    "services.cards.asbestos.title": "Asbestinventarisattest",
    "services.cards.asbestos.tagline": "AIV",
    "services.cards.asbestos.description": "Verplicht in Vlaanderen sinds november 2022 voor de verkoop van elk woongebouw van vóór 2001. Wordt afgeleverd door een door OVAM erkend deskundige na een niet-destructieve plaatsbeschrijving.",
    "services.cards.asbestos.whenNeeded": "Verkoop van gebouwen van vóór 2001 (Vlaanderen)",
    "services.cards.asbestos.validity": "Tot 10 jaar",
    "services.cards.electrical.title": "Elektrische keuring",
    "services.cards.electrical.tagline": "EK",
    "services.cards.electrical.description": "AREI/RGIE-keuring van de installatie waarbij de veiligheid van het elektrische systeem wordt nagekeken. Vereist bij elke woningverkoop en na grondige renovaties van de installatie.",
    "services.cards.electrical.whenNeeded": "Bij elke woningverkoop",
    "services.cards.electrical.validity": "25 jaar bij goedkeuring · 18 maanden om in orde te brengen indien niet conform",
    "services.cards.fuel.title": "Stookolietankcontrole",
    "services.cards.fuel.tagline": "TK",
    "services.cards.fuel.description": "Periodieke controle van residentiële stookolietanks, bovengronds of ondergronds. Het certificaat bevestigt dat de tank voldoet aan de gewestelijke regelgeving en verder mag worden gebruikt.",
    "services.cards.fuel.whenNeeded": "Periodiek — frequentie hangt af van het tanktype",
    "services.cards.fuel.validity": "Opnieuw afgeleverd bij elke controle",
    "services.cards.photos.title": "Pandfotografie",
    "services.cards.photos.tagline": "PH",
    "services.cards.photos.description": "Groothoek- en professioneel uitgelichte advertentiefotografie voor verkoop en verhuur. Nog dezelfde dag bewerkt en opgeleverd, zodat uw advertentie zonder wachttijd online gaat.",
    "services.cards.photos.whenNeeded": "Vóór publicatie van de advertentie",
    "services.cards.photos.validity": "Oplevering dezelfde dag",
    "services.cards.signage.title": "Verkoop-/verhuurbord",
    "services.cards.signage.tagline": "SG",
    "services.cards.signage.description": "Wij leveren en plaatsen een te-koop- of te-huur-bord aan het pand, voorzien van uw kantoorhuisstijl. Het ophalen en verwijderen verzorgen wij wanneer de advertentie afloopt.",
    "services.cards.signage.whenNeeded": "De dag dat de advertentie online gaat",
    "services.cards.signage.validity": "Verwijderd zodra de advertentie afloopt",
    # howItWorks
    "howItWorks.eyebrow": "Hoe het werkt",
    "howItWorks.heading": "Van advertentie tot certificaat, in drie stappen.",
    "howItWorks.steps.register.n": "01",
    "howItWorks.steps.register.title": "Registreer uw kantoor",
    "howItWorks.steps.register.body": "Maak een account aan voor uw kantoor. Nodig uw collega's uit en stel uw huisstijlvoorkeuren in.",
    "howItWorks.steps.create.n": "02",
    "howItWorks.steps.create.title": "Maak een opdracht aan",
    "howItWorks.steps.create.body": "Voeg het pandadres toe, evenals de gegevens van eigenaar en huurder en eventuele opmerkingen — net zoals u dat vandaag doet.",
    "howItWorks.steps.pick.n": "03",
    "howItWorks.steps.pick.title": "Kies de diensten die u nodig heeft",
    "howItWorks.steps.pick.body": "Vink EPC, AIV, EK of TK aan — één, enkele of allemaal. Wij regelen de rest.",
    # merger
    "merger.eyebrow": "Het verhaal",
    "merger.heading": "Vier specialisten. Eén team.",
    "merger.lead1": "Jarenlang jongleerden vastgoedmakelaars met vier verschillende deskundigen, vier facturen en vier mailboxen om één verkoop af te ronden. Wij hebben het beste van elke discipline samengebracht, zodat u dat niet meer hoeft te doen.",
    "merger.lead2": "Eén login, één aanspreekpunt en één opleveringsplanning — gedragen door dezelfde gecertificeerde experts die u al vertrouwde.",
    "merger.stats.oneInvoice.label": "Eén factuur",
    "merger.stats.oneInvoice.body": "Alle diensten, één maandelijks overzicht.",
    "merger.stats.oneContact.label": "Eén aanspreekpunt",
    "merger.stats.oneContact.body": "Eén accountmanager per kantoor.",
    "merger.stats.oneDashboard.label": "Eén dashboard",
    "merger.stats.oneDashboard.body": "Volg elke opdracht in real time op.",
    "merger.brands.asbestos.name": "Asbest Experts",
    "merger.brands.asbestos.service": "Asbestinventarisattest (AIV)",
    "merger.brands.epc.name": "EPC Partner",
    "merger.brands.epc.service": "Energieprestatiecertificaat (EPC)",
    "merger.brands.electrical.name": "Elec Inspect",
    "merger.brands.electrical.service": "Elektrische keuring (EK)",
    "merger.brands.fuel.name": "Tank Check",
    "merger.brands.fuel.service": "Stookolietankcontrole (TK)",
    # cta
    "cta.heading": "Klaar om uw werkproces te vereenvoudigen?",
    "cta.body": "Uw kantoor is in enkele minuten ingericht. De eerste opdracht bieden wij aan.",
    "cta.register": "Registreer uw kantoor",
    "cta.contact": "Neem contact op",
    # about.hero
    "about.hero.badgePrefix": "Over ons",
    "about.hero.title": "Vier specialisten, één team.",
    "about.hero.subtitle": "Wij brachten de vier Belgische certificeringspraktijken samen die onze klanten al gebruikten — en bouwden de administratie opnieuw rond één dashboard. Niet langer jongleren met drie facturen en vier deskundigen voor de verkoop van één pand.",
    # about.timeline
    "about.timeline.heading": "Hoe we hier geraakt zijn",
    "about.timeline.subheading": "Vijftien jaar onafhankelijk vakwerk, drie overnames en één gedeeld platform.",
    "about.timeline.items.founded2011.year": "2011",
    "about.timeline.items.founded2011.title": "Asbest Experts opgericht",
    "about.timeline.items.founded2011.body": "De oudste van de vier — gestart als een tweekoppige asbestinventarispraktijk in Antwerpen en uitgegroeid tot een gewestelijke speler.",
    "about.timeline.items.epc2015.year": "2015",
    "about.timeline.items.epc2015.title": "EPC Partner sluit aan",
    "about.timeline.items.epc2015.body": "Een gespecialiseerde EPC-speler met erkende energiedeskundigen in Vlaanderen en Brussel sluit zich aan om energiecertificaten onder hetzelfde dak aan te bieden.",
    "about.timeline.items.electrical2018.year": "2018",
    "about.timeline.items.electrical2018.title": "Elec Inspect komt erbij",
    "about.timeline.items.electrical2018.body": "AREI-erkende elektrische keurders brengen installatiekeuringen in het portfolio, waardoor pre-verkoopconformiteit een one-stop-dienst wordt.",
    "about.timeline.items.fuel2021.year": "2021",
    "about.timeline.items.fuel2021.title": "Tank Check vervolledigt het team",
    "about.timeline.items.fuel2021.body": "De laatste specialist — erkende stookolietankcontroleurs — sluit aan en dekt zowel bovengrondse als ondergrondse tanks voor particuliere en zakelijke klanten.",
    "about.timeline.items.launch2026.year": "2026",
    "about.timeline.items.launch2026.title": "immoplatform gaat live",
    "about.timeline.items.launch2026.body": "Vier specialisten, één merk, één platform. Wij stellen ons gedeelde dashboard open voor elk vastgoedkantoor in België.",
    # about.values
    "about.values.heading": "Waar wij in geloven",
    "about.values.subheading": "Zes principes die de manier waarop wij bouwen, keuren en factureren bepalen.",
    "about.values.items.oneFile.title": "Eén dossier, één waarheid",
    "about.values.items.oneFile.body": "Elk certificaat, rapport en factuur staat in dezelfde map. Geen e-mailketens, geen rekenbladen.",
    "about.values.items.specialists.title": "Enkel specialisten",
    "about.values.items.specialists.body": "Elke dienst wordt geleverd door een erkende, gecertificeerde deskundige — nooit door een generalist.",
    "about.values.items.transparent.title": "Standaard transparant",
    "about.values.items.transparent.body": "Vaste tarieven, geen verborgen kosten en realtime status zichtbaar voor elke partij in de opdracht.",
    "about.values.items.belgium.title": "België eerst",
    "about.values.items.belgium.body": "Gebouwd voor de regionale eigenheden — Vlaamse EPC, Brusselse keuring, Waalse asbestregels. Lokale regels, nationale dekking.",
    "about.values.items.inspectorFriendly.title": "Vriendelijk voor deskundigen",
    "about.values.items.inspectorFriendly.body": "Onze freelancers krijgen correcte tarieven, een nette planning en hulpmiddelen die op terrein écht helpen.",
    "about.values.items.receipts.title": "Bewaar de bewijsstukken",
    "about.values.items.receipts.body": "Elk bestand wordt 10 jaar bewaard, geïndexeerd en met één klik exporteerbaar.",
    # about.cta
    "about.cta.heading": "Vier certificaten, één werkproces.",
    "about.cta.body": "Registreer uw kantoor en stuur voortaan elke EPC, asbest-, elektrische en stookolietankcontrole vanuit één dashboard.",
    "about.cta.register": "Registreer uw kantoor",
    "about.cta.contact": "Neem contact op",
    # contact
    "contact.hero.badge": "Contact",
    "contact.hero.title": "Spreek met een echte medewerker. Doorgaans binnen het uur.",
    "contact.hero.subtitle": "Of u nu een nieuw kantoor-account voorbereidt, een opgeleverd bestand wilt nakijken of gewoon nieuwsgierig bent naar onze dekking in uw provincie — wij komen nog dezelfde werkdag bij u terug.",
    "contact.form.heading": "Stuur ons een bericht",
    "contact.form.subheading": "Wij antwoorden binnen 4 werkuren op weekdagen.",
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
    nl_home = hashes.get("nl-BE", {}).get("home", {})
    for path in PATCHES:
        if path in nl_home:
            del nl_home[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n")

    print(f"Applied {len(PATCHES)} translations + cleared hashes.")


if __name__ == "__main__":
    main()
