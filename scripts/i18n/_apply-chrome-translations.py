#!/usr/bin/env python3
"""
Translate dashboard chrome (sidebar, topbar, account switcher, mobile topbar,
team switcher, search input, confirm dialog, unsaved-changes dialog, settings
save bar, settings scope banner, announcement banner, shared common labels).

Idempotent. Run:
    python3 scripts/i18n/_apply-chrome-translations.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # shared.sidebar
    "shared.sidebar.homeAriaLabel": "immoplatform.be — dashboard",
    "shared.sidebar.sectionAdmin": "Beheer",
    "shared.sidebar.items.assignments": "Opdrachten",
    "shared.sidebar.items.users": "Gebruikers",
    "shared.sidebar.items.teams": "Kantoren",
    "shared.sidebar.items.overview": "Overzicht",
    "shared.sidebar.items.calendar": "Agenda",
    "shared.sidebar.items.revenue": "Omzet",
    "shared.sidebar.items.commissions": "Commissies",
    "shared.sidebar.items.messages": "Berichten",
    "shared.sidebar.items.announcements": "Aankondigingen",
    "shared.sidebar.items.odooProducts": "Odoo-producten",
    "shared.sidebar.items.settings": "Instellingen",
    "shared.sidebar.items.signOut": "Afmelden",
    "shared.sidebar.userFallbackName": "Jordan Remy",
    "shared.sidebar.userFallbackRole": "beheerder",

    # shared.topbar
    "shared.topbar.newAssignment": "Nieuwe opdracht",

    # shared.accountSwitcher
    "shared.accountSwitcher.ariaLabel": "Account wisselen",
    "shared.accountSwitcher.devTag": "dev",
    "shared.accountSwitcher.trigger": "Gebruiker wisselen",
    "shared.accountSwitcher.currentlyPrefix": "Momenteel:",
    "shared.accountSwitcher.switchFailed": "Wissel mislukt: {error}",

    # shared.mobileTopbar
    "shared.mobileTopbar.open": "Navigatie openen",
    "shared.mobileTopbar.close": "Navigatie sluiten",
    "shared.mobileTopbar.profile": "Uw profiel",
    "shared.mobileTopbar.signOut": "Afmelden",
    "shared.mobileTopbar.homeAriaLabel": "immoplatform.be — dashboard",
    "shared.mobileTopbar.items.overview": "Overzicht",
    "shared.mobileTopbar.items.assignments": "Opdrachten",
    "shared.mobileTopbar.items.teams": "Kantoren",
    "shared.mobileTopbar.items.users": "Gebruikers",
    "shared.mobileTopbar.items.calendar": "Agenda",
    "shared.mobileTopbar.items.revenue": "Omzet",
    "shared.mobileTopbar.items.announcements": "Aankondigingen",
    "shared.mobileTopbar.items.settings": "Instellingen",

    # shared.teamSwitcher
    "shared.teamSwitcher.ariaLabel": "Kantoor wisselen",
    "shared.teamSwitcher.actingAs": "Actief als",
    "shared.teamSwitcher.manageAll": "Alle kantoren beheren",
    "shared.teamSwitcher.createTeam": "Kantoor aanmaken",

    # shared.searchInput
    "shared.searchInput.placeholder": "Zoeken…",

    # shared.confirmDialog
    "shared.confirmDialog.confirm": "Bevestigen",
    "shared.confirmDialog.cancel": "Annuleren",

    # shared.unsavedChanges
    "shared.unsavedChanges.title": "Wegnavigeren zonder op te slaan?",
    "shared.unsavedChanges.description": "U heeft niet-opgeslagen wijzigingen op deze pagina. Als u nu vertrekt, gaan ze verloren.",
    "shared.unsavedChanges.confirmLabel": "Wijzigingen verwerpen",
    "shared.unsavedChanges.cancelLabel": "Doorgaan met bewerken",

    # shared.settingsSaveBar
    "shared.settingsSaveBar.ariaLabel": "Wijzigingen opslaan",
    "shared.settingsSaveBar.title": "Niet-opgeslagen wijzigingen",
    "shared.settingsSaveBar.saving": "Opslaan…",
    "shared.settingsSaveBar.hint": "Vergeet niet op te slaan voordat u de pagina verlaat.",
    "shared.settingsSaveBar.discard": "Verwerpen",
    "shared.settingsSaveBar.save": "Wijzigingen opslaan",

    # shared.settingsScopeBanner
    "shared.settingsScopeBanner.personalTitle": "Persoonlijke instelling",
    "shared.settingsScopeBanner.personalDescription": "Wijzigingen hier hebben enkel betrekking op uw eigen account. Andere kantoorgenoten behouden hun eigen voorkeuren.",
    "shared.settingsScopeBanner.orgTitle": "Organisatie-instelling",
    "shared.settingsScopeBanner.orgDescription": "Wijzigingen hier gelden voor elke medewerker van uw werkruimte. Alleen beheerders kunnen ze wijzigen.",
    "shared.settingsScopeBanner.ariaLabel": "{title} bereik",

    # shared.announcementBanner
    "shared.announcementBanner.ariaLabel": "Aankondigingen",
    "shared.announcementBanner.dismissAriaLabel": "Aankondiging sluiten",

    # shared.common
    "shared.common.cancel": "Annuleren",
    "shared.common.save": "Opslaan",
    "shared.common.saveChanges": "Wijzigingen opslaan",
    "shared.common.discard": "Verwerpen",
    "shared.common.remove": "Verwijderen",
    "shared.common.uploading": "Uploaden…",
    "shared.common.saving": "Opslaan…",
    "shared.common.required": "Verplicht",
    "shared.common.optional": "Optioneel",
}


def set_path(d: dict, path: str, value: str) -> None:
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main() -> None:
    catalog = json.loads(NL.read_text())
    for path, value in PATCHES.items():
        set_path(catalog, path, value)
    NL.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n")
    print(f"Applied {len(PATCHES)} chrome translations to {NL.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
