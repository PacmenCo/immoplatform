#!/usr/bin/env python3
"""Translate users.invite.* + users.pendingInvites.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # users.invite.*
    "users.invite.topbarTitle": "Gebruiker uitnodigen",
    "users.invite.topbarSubtitle": "Verstuur een e-mailuitnodiging om toegang te krijgen tot uw werkruimte",
    "users.invite.breadcrumbUsers": "Gebruikers",
    "users.invite.breadcrumbInvite": "Uitnodigen",
    "users.invite.needTeamFirst.title": "U dient eerst eigenaar te zijn van een kantoor voordat u iemand kunt uitnodigen",
    "users.invite.needTeamFirst.body": "Makelaars kunnen enkel personen uitnodigen voor kantoren waarvan zij eigenaar zijn. U bent momenteel van geen enkel kantoor eigenaar — vraag uw agentschapsbeheerder om het eigenaarschap aan u over te dragen, of maak een nieuw kantoor aan.",
    "users.invite.needTeamFirst.createTeam": "Kantoor aanmaken",
    "users.invite.needTeamFirst.backToDashboard": "Terug naar dashboard",
    "users.invite.whoCard.title": "Wie nodigt u uit?",
    "users.invite.whoCard.description": "Wij sturen hen per e-mail een beveiligde link om hun account aan te maken.",
    "users.invite.whoCard.emailLabel": "Zakelijk e-mailadres",
    "users.invite.whoCard.emailPlaceholder": "collega@kantoor.be",
    "users.invite.whoCard.noteLabel": "Notitie (optioneel)",
    "users.invite.whoCard.noteHint": "Wordt getoond op de aanvaardingspagina. Handig voor context.",
    "users.invite.whoCard.notePlaceholder": "Hallo Lucas — welkom in onze immoplatform-werkruimte.",
    "users.invite.roleCard.title": "Rol",
    "users.invite.roleCard.description": "Bepaalt wat zij op het platform kunnen zien en doen.",
    "users.invite.roleCard.roles.realtor.label": "Makelaar",
    "users.invite.roleCard.roles.realtor.description": "Maakt opdrachten aan, volgt het werk van het agentschap op en nodigt collega's uit.",
    "users.invite.roleCard.roles.freelancer.label": "Freelancer",
    "users.invite.roleCard.roles.freelancer.description": "Erkend deskundige — aanvaardt opdrachten en uploadt opleveringen.",
    "users.invite.roleCard.roles.staff.label": "Medewerker",
    "users.invite.roleCard.roles.staff.description": "immoplatform-ondersteuning — kan alle kantoren bekijken en gebruikers helpen.",
    "users.invite.roleCard.roles.admin.label": "Beheerder",
    "users.invite.roleCard.roles.admin.description": "Volledige platformtoegang — facturatie, prijslijsten, gebruikersbeheer.",
    "users.invite.teamCard.title": "Kantoor",
    "users.invite.teamCard.titleOptional": "Kantoor (optioneel)",
    "users.invite.teamCard.descriptionLocked": "U nodigt uit voor {teamName}. Open de uitnodiging via de pagina Gebruikers als u een ander kantoor wenst te kiezen.",
    "users.invite.teamCard.descriptionLockedFallback": "U nodigt uit voor dit kantoor. Open de uitnodiging via de pagina Gebruikers als u een ander kantoor wenst te kiezen.",
    "users.invite.teamCard.descriptionRealtor": "Koppel deze makelaar aan een kantoor van het agentschap.",
    "users.invite.teamCard.descriptionFreelancer": "Koppel deze freelancer aan een kantoor waarmee hij of zij regelmatig samenwerkt.",
    "users.invite.teamCard.teamFieldLabel": "Kantoor",
    "users.invite.teamCard.teamPlaceholder": "Zoek een kantoor…",
    "users.invite.teamCard.teamSearchPlaceholder": "Typ een kantoornaam of gemeente…",
    "users.invite.teamCard.noTeamOption": "Geen kantoor (optioneel)",
    "users.invite.teamCard.teamRoleHeading": "Kantoorrol",
    "users.invite.teamCard.teamRoles.member.label": "Lid",
    "users.invite.teamCard.teamRoles.member.description": "Kan opdrachten voor het kantoor aanmaken en bekijken.",
    "users.invite.teamCard.teamRoles.owner.label": "Eigenaar",
    "users.invite.teamCard.teamRoles.owner.description": "Lid + kan uitnodigen, kantoorinstellingen bewerken en anderen verwijderen.",
    "users.invite.teamCard.ownerTakenLabel": "Bezet",
    "users.invite.teamCard.ownerTakenReason": "{ownerName} is reeds eigenaar van dit kantoor",
    "users.invite.teamCard.ownerTakenExplain": "{ownerName} is reeds eigenaar van {teamName}. Nieuwe uitnodigingen kunnen enkel als lid toetreden. Om de eigenaar te wijzigen, dient u eerst het eigenaarschap over te dragen via de kantoorinstellingen.",
    "users.invite.footer.requiredHint": "Verplicht",
    "users.invite.footer.cancel": "Annuleren",
    "users.invite.footer.submit": "Uitnodiging versturen",
    "users.invite.preview.title": "Voorbeeld van e-mail",
    "users.invite.preview.description": "Dit is wat zij zullen ontvangen.",
    "users.invite.preview.to": "Aan:",
    "users.invite.preview.toFallback": "collega@kantoor.be",
    "users.invite.preview.from": "Van:",
    "users.invite.preview.subject": "U bent uitgenodigd om deel te nemen aan <brand></brand>",
    "users.invite.preview.bodyWithTeam": "U bent uitgenodigd om deel te nemen aan <brand></brand> als <strong>{role}</strong> bij kantoor <strong>{team}</strong> ({teamRole}).",
    "users.invite.preview.bodyWithoutTeam": "U bent uitgenodigd om deel te nemen aan <brand></brand> als <strong>{role}</strong>.",
    "users.invite.preview.cta": "Uitnodiging aanvaarden →",
    "users.invite.preview.expiry": "Deze link verloopt binnen 7 dagen.",

    # users.pendingInvites.*
    "users.pendingInvites.title": "Openstaande uitnodigingen",
    "users.pendingInvites.ariaLabel": "Openstaande uitnodigingen · {count} in afwachting van aanvaarding",
    "users.pendingInvites.inviteUser": "Gebruiker uitnodigen",
    "users.pendingInvites.showingRange": "{start}–{end} van {total} weergegeven",
    "users.pendingInvites.previous": "Vorige",
    "users.pendingInvites.next": "Volgende",
    "users.pendingInvites.row.metaSentBy": "Verzonden door {name} op {date}",
    "users.pendingInvites.row.resend": "Opnieuw versturen",
    "users.pendingInvites.row.revoke": "Intrekken",
    "users.pendingInvites.row.confirmTitle": "Uitnodiging voor {email} intrekken?",
    "users.pendingInvites.row.confirmDescription": "De aanvaardingslink kan dan niet meer gebruikt worden. Een nieuwe uitnodiging versturen blijft nadien mogelijk.",
    "users.pendingInvites.row.confirmLabel": "Uitnodiging intrekken",
    "users.pendingInvites.row.cancelLabel": "Behouden",
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
