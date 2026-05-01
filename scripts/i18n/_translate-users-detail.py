#!/usr/bin/env python3
"""Translate dashboard.users.detail.* to nl-BE. Idempotent."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "dashboard.json"

PATCHES: dict[str, str] = {
    # Top-level
    "users.detail.breadcrumbUsers": "Gebruikers",
    "users.detail.subtitleNoTeam": "Geen kantoor",
    "users.detail.online": "Nu online",
    "users.detail.lastSeen": "Laatst gezien {when}",
    "users.detail.neverSignedIn": "Nog nooit aangemeld",
    "users.detail.about": "Over",

    # actions
    "users.detail.actions.message": "Berichten",
    "users.detail.actions.edit": "Bewerken",

    # certifications
    "users.detail.certifications.title": "Certificeringen",
    "users.detail.certifications.description": "Diensten waarvoor deze deskundige gecertificeerd is.",

    # recentWork
    "users.detail.recentWork.title": "Recente opdrachten",
    "users.detail.recentWork.showingOf": "Laatste {shown} van {total} weergegeven",
    "users.detail.recentWork.emptyAdminStaff": "Beheerders- en medewerkersaccounts hebben geen rechtstreekse opdrachten.",
    "users.detail.recentWork.emptyDefault": "Nog geen opdrachten gekoppeld aan deze gebruiker.",

    # recentActivity
    "users.detail.recentActivity.title": "Recente activiteit",
    "users.detail.recentActivity.empty": "Geen recente activiteit.",

    # contact
    "users.detail.contact.title": "Contact",
    "users.detail.contact.membershipsExtra": "+{count} meer",
    "users.detail.contact.joined": "Lid sinds {date}",

    # atAGlance
    "users.detail.atAGlance.title": "In één oogopslag",
    "users.detail.atAGlance.active": "Actief",
    "users.detail.atAGlance.delivered": "Geleverd",
    "users.detail.atAGlance.closed": "Afgesloten",
    "users.detail.atAGlance.services": "Diensten",
    "users.detail.atAGlance.teams": "Kantoren",
    "users.detail.atAGlance.total": "Totaal",

    # roleAccess
    "users.detail.roleAccess.title": "Rol & toegang",
    "users.detail.roleAccess.yes": "Ja",
    "users.detail.roleAccess.admin.fullAccess": "Volledige platformtoegang",
    "users.detail.roleAccess.admin.manageUsersTeams": "Gebruikers & kantoren beheren",
    "users.detail.roleAccess.admin.billingPriceLists": "Facturatie & prijslijsten",
    "users.detail.roleAccess.staff.createAssign": "Werk aanmaken & toewijzen",
    "users.detail.roleAccess.staff.viewAllTeams": "Alle kantoren bekijken",
    "users.detail.roleAccess.staff.supportConsole": "Supportconsole",
    "users.detail.roleAccess.realtor.createAssignments": "Opdrachten aanmaken",
    "users.detail.roleAccess.realtor.seeTeamActivity": "Kantooractiviteit bekijken",
    "users.detail.roleAccess.realtor.inviteTeammates": "Kantoorgenoten uitnodigen",
    "users.detail.roleAccess.freelancer.acceptAssignments": "Opdrachten aanvaarden",
    "users.detail.roleAccess.freelancer.uploadDeliverables": "Opleveringen uploaden",
    "users.detail.roleAccess.freelancer.setAvailability": "Beschikbaarheid instellen",

    # verbs
    "users.detail.verbs.assignmentCreated": "Opdracht aangemaakt",
    "users.detail.verbs.assignmentUpdated": "Opdracht bijgewerkt",
    "users.detail.verbs.assignmentStarted": "Inspectie gestart",
    "users.detail.verbs.assignmentDelivered": "Inspectie geleverd",
    "users.detail.verbs.assignmentCompleted": "Opdracht afgetekend",
    "users.detail.verbs.assignmentCancelled": "Opdracht geannuleerd",
    "users.detail.verbs.assignmentDeleted": "Opdracht verwijderd",
    "users.detail.verbs.assignmentReassigned": "Deskundige opnieuw toegewezen",
    "users.detail.verbs.assignmentFileUploaded": "Bestanden geüpload",
    "users.detail.verbs.assignmentFileDeleted": "Bestand verwijderd",
    "users.detail.verbs.assignmentCommissionApplied": "Commissie geregistreerd",
    "users.detail.verbs.commissionQuarterPaid": "Kwartaal als betaald gemarkeerd",
    "users.detail.verbs.commissionQuarterUnpaid": "Kwartaal heropend",
    "users.detail.verbs.teamCreated": "Kantoor aangemaakt",
    "users.detail.verbs.teamUpdated": "Kantoor bijgewerkt",
    "users.detail.verbs.teamDeleted": "Kantoor verwijderd",
    "users.detail.verbs.teamMemberAdded": "Kantoorlid toegevoegd",
    "users.detail.verbs.teamMemberRemoved": "Kantoorlid verwijderd",
    "users.detail.verbs.teamOwnershipTransferred": "Eigendom overgedragen",
    "users.detail.verbs.userCreated": "Gebruiker aangemaakt",
    "users.detail.verbs.userDeleted": "Gebruiker verwijderd",
    "users.detail.verbs.userProfileUpdated": "Profiel bijgewerkt",
    "users.detail.verbs.userPasswordChanged": "Wachtwoord gewijzigd",
    "users.detail.verbs.userEmailChanged": "E-mailadres gewijzigd",
    "users.detail.verbs.userRoleChanged": "Rol gewijzigd",
    "users.detail.verbs.userSignedIn": "Aangemeld",
    "users.detail.verbs.userSignedOut": "Afgemeld",
    "users.detail.verbs.inviteSent": "Uitnodiging verstuurd",
    "users.detail.verbs.inviteAccepted": "Uitnodiging aanvaard",
    "users.detail.verbs.announcementCreated": "Mededeling gepubliceerd",
    "users.detail.verbs.revenueAdjustmentCreated": "Omzetcorrectie toegevoegd",
    "users.detail.verbs.calendarConnected": "Agenda gekoppeld",
    "users.detail.verbs.calendarDisconnected": "Agenda ontkoppeld",

    # relativeTime
    "users.detail.relativeTime.justNow": "zonet",
    "users.detail.relativeTime.minutesAgo": "{count} min. geleden",
    "users.detail.relativeTime.hoursAgo": "{count} u geleden",
    "users.detail.relativeTime.daysAgo": "{count} d geleden",
    "users.detail.relativeTime.monthsAgo": "{count} mnd geleden",
    "users.detail.relativeTime.yearsAgo": "{count} j geleden",
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
