#!/usr/bin/env python3
"""Translate dashboard.users.edit.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    "users.edit.topbarTitle": "{name} bewerken",
    "users.edit.topbarSubtitle": "Gebruikersbeheer door beheerder",
    "users.edit.breadcrumbUsers": "Gebruikers",
    "users.edit.breadcrumbEdit": "Bewerken",
    "users.edit.profile.title": "Profiel",
    "users.edit.profile.description": "Het wijzigen van het e-mailadres herverifieert het niet — vertrouwde update door beheerder.",
    "users.edit.profile.firstName": "Voornaam",
    "users.edit.profile.lastName": "Achternaam",
    "users.edit.profile.email": "E-mail",
    "users.edit.profile.role": "Rol",
    "users.edit.profile.roleHint": "Bepaalt waartoe deze persoon op het platform toegang heeft.",
    "users.edit.profile.save": "Profiel opslaan",
    "users.edit.passwordReset.title": "Wachtwoord resetten",
    "users.edit.passwordReset.description": "Stelt een nieuw wachtwoord in voor deze gebruiker. Elke actieve sessie wordt ingetrokken zodat het oude wachtwoord onmiddellijk niet meer werkt. De gebruiker krijgt geen e-mail — bezorg het nieuwe wachtwoord buiten het platform om.",
    "users.edit.passwordReset.newPassword": "Nieuw wachtwoord",
    "users.edit.passwordReset.newPasswordHint": "Minstens 8 tekens, met minstens één letter en één cijfer.",
    "users.edit.passwordReset.confirmPassword": "Bevestig nieuw wachtwoord",
    "users.edit.passwordReset.submit": "Wachtwoord resetten",
    "users.edit.passwordReset.success": "Wachtwoord gereset. Andere sessies zijn afgemeld.",
    "users.edit.delete.trigger": "Verwijderen",
    "users.edit.delete.confirmTitle": "{name} verwijderen?",
    "users.edit.delete.confirmDescription": "Het account wordt soft-deleted — de gebruiker kan niet meer aanmelden en elke actieve sessie wordt ingetrokken. Opdrachten en opmerkingen die zij hebben aangemaakt blijven behouden, op naam van de gebruiker.",
    "users.edit.delete.confirmLabel": "Gebruiker verwijderen",
    "users.edit.delete.cancelLabel": "Behouden",
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
