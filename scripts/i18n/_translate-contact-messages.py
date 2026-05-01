#!/usr/bin/env python3
"""Translate dashboard.contactMessages.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # topbar
    "contactMessages.topbar.title": "Contactberichten",
    "contactMessages.topbar.subtitleEmpty": "Inzendingen van bezoekers via het publieke /contact-formulier komen hier terecht.",
    "contactMessages.topbar.subtitleCount": "{total} in totaal · {unhandled} in afwachting van antwoord",
    # empty
    "contactMessages.empty.title": "Nog geen berichten",
    "contactMessages.empty.description": "Wanneer iemand het contactformulier op immoplatform.be invult, verschijnt het bericht hier.",
    "contactMessages.empty.inboxZeroTitle": "Inbox zero",
    "contactMessages.empty.inboxZeroDescription": "Elk bericht is afgehandeld. Schakel over naar Alle om de volledige geschiedenis te zien.",
    # filterTabs
    "contactMessages.filterTabs.ariaLabel": "Berichten filteren",
    "contactMessages.filterTabs.all": "Alle",
    "contactMessages.filterTabs.unhandled": "In afwachting van antwoord",
    # row
    "contactMessages.row.expandAria": "Bericht uitvouwen",
    "contactMessages.row.collapseAria": "Bericht invouwen",
    "contactMessages.row.statusHandled": "Afgehandeld",
    "contactMessages.row.statusNew": "Nieuw",
    "contactMessages.row.markHandled": "Markeren als afgehandeld",
    "contactMessages.row.reopen": "Heropenen",
    "contactMessages.row.replyViaEmail": "Antwoorden via e-mail",
    "contactMessages.row.replyDefaultSubject": "uw bericht aan immoplatform",
    "contactMessages.row.replySubjectPrefix": "Re: {subject}",
    "contactMessages.row.fields.from": "Van",
    "contactMessages.row.fields.phone": "Telefoon",
    "contactMessages.row.fields.subject": "Onderwerp",
    "contactMessages.row.fields.message": "Bericht",
    "contactMessages.row.fields.ip": "IP",
    "contactMessages.row.fields.handledBy": "Afgehandeld door",
    "contactMessages.row.notes.label": "Interne opmerkingen",
    "contactMessages.row.notes.placeholder": "Alles wat het kantoor over deze lead moet weten…",
    "contactMessages.row.notes.save": "Opmerkingen opslaan",
    "contactMessages.row.notes.saved": "Opgeslagen.",
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
