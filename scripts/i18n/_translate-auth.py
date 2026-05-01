#!/usr/bin/env python3
"""Translate auth.json to nl-BE. Idempotent.
Auto-generated from plan file."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NL = ROOT / "messages" / "nl-BE" / "auth.json"
HASHES = ROOT / "messages" / "_hashes.json"

PATCHES: dict[str, str] = {
    # common
    "common.back": "Terug",
    "common.backHome": "Terug naar home",
    "common.backToLogin": "Terug naar aanmelden",
    "common.backToSettings": "Terug naar instellingen",
    "common.backToDashboard": "Terug naar dashboard",
    "common.contactSupport": "Contact opnemen met support",
    "common.decline": "Weigeren",
    "common.goBack": "Ga terug",
    "common.tryAgain": "Opnieuw proberen",
    "common.unknownEmail": "Uw adres",

    # shell
    "shell.homeAriaLabel": "immoplatform.be — home",
    "shell.tagline": "Belgische vastgoedcertificaten",
    "shell.headline": "Eén dashboard voor elk certificaat.",
    "shell.lede": "Bestel, plan, volg en factureer elke keuring — alles vanuit één plek.",
    "shell.bullets.epc": "EPC-certificaten",
    "shell.bullets.asbestos": "Asbestinventarisattesten",
    "shell.bullets.electrical": "Elektrische keuringen",
    "shell.bullets.fuel": "Stookolietankcontroles",
    "shell.copyright": "© {year} {brand}. Alle rechten voorbehouden.",

    # login
    "login.title": "Aanmelden",
    "login.heading": "Welkom terug.",
    "login.subtitle": "Meld u aan om uw opdrachten en kantoren te beheren.",
    "login.email": "Werk-e-mailadres",
    "login.emailPlaceholder": "u@kantoor.be",
    "login.password": "Wachtwoord",
    "login.forgotPassword": "Wachtwoord vergeten?",
    "login.submit": "Aanmelden",
    "login.footerPrompt": "Nog geen account?",
    "login.footerCta": "Maak er een aan",

    # register
    "register.title": "Registreren",
    "register.heading": "Maak uw kantooraccount aan.",
    "register.subtitle": "Duurt minder dan 2 minuten. Uw eerste opdracht is van ons.",
    "register.firstName": "Voornaam",
    "register.lastName": "Achternaam",
    "register.agency": "Naam van het kantoor",
    "register.agencyHint": "Optioneel — wordt op uw profiel getoond.",
    "register.agencyPlaceholder": "Vastgoed Antwerpen",
    "register.email": "Werk-e-mailadres",
    "register.emailPlaceholder": "u@kantoor.be",
    "register.password": "Wachtwoord",
    "register.passwordHint": "Minstens 10 tekens.",
    "register.confirmPassword": "Wachtwoord bevestigen",
    "register.region": "Regio",
    "register.regions.flanders": "Vlaanderen",
    "register.regions.brussels": "Brussel",
    "register.regions.wallonia": "Wallonië",
    "register.termsPrefix": "Ik ga akkoord met de",
    "register.termsLink": "Algemene voorwaarden",
    "register.termsAnd": "en",
    "register.privacyLink": "Privacybeleid",
    "register.submit": "Account aanmaken",
    "register.footerPrompt": "Al een account?",
    "register.footerCta": "Aanmelden",

    # forgotPassword
    "forgotPassword.title": "Wachtwoord resetten",
    "forgotPassword.heading": "Reset uw wachtwoord.",
    "forgotPassword.subtitle": "Geef het e-mailadres van uw account op en wij sturen u een beveiligde resetlink.",
    "forgotPassword.sentHeading": "Controleer uw inbox.",
    "forgotPassword.sentSubtitle": "Als er een account met dat e-mailadres bestaat, hebben we u een beveiligde resetlink gestuurd.",
    "forgotPassword.sentBody": "De link verloopt na 1 uur. Controleer uw spammap als hij niet aankomt.",
    "forgotPassword.email": "Werk-e-mailadres",
    "forgotPassword.emailPlaceholder": "u@kantoor.be",
    "forgotPassword.submit": "Resetlink versturen",
    "forgotPassword.expiryHint": "De link verloopt na 1 uur.",
    "forgotPassword.footerPrompt": "Toch herinnerd?",
    "forgotPassword.footerCta": "Terug naar aanmelden",

    # resetPassword
    "resetPassword.title": "Kies een nieuw wachtwoord",
    "resetPassword.heading": "Kies een nieuw wachtwoord.",
    "resetPassword.subtitle": "Gebruik minstens 10 tekens. Een mix van woorden, cijfers en symbolen is ideaal.",
    "resetPassword.missingTokenHeading": "Link mist de token.",
    "resetPassword.missingTokenSubtitle": "Open de resetlink uit uw e-mail of vraag een nieuwe aan.",
    "resetPassword.requestNewLink": "Nieuwe link aanvragen",
    "resetPassword.newPassword": "Nieuw wachtwoord",
    "resetPassword.newPasswordHint": "Minstens 10 tekens.",
    "resetPassword.confirmPassword": "Nieuw wachtwoord bevestigen",
    "resetPassword.submit": "Wachtwoord bijwerken",
    "resetPassword.footerPrompt": "Toch van gedachten veranderd?",
    "resetPassword.footerCta": "Terug naar aanmelden",

    # verifyEmail
    "verifyEmail.title": "E-mailadres bevestigen",
    "verifyEmail.verifiedHeading": "E-mailadres bevestigd.",
    "verifyEmail.verifiedSubtitle": "{email} is nu bevestigd. U bent helemaal klaar.",
    "verifyEmail.verifiedCardTitle": "Bedankt voor het bevestigen",
    "verifyEmail.verifiedCardBody": "Accountmeldingen en wachtwoordresets komen vanaf nu op dit adres aan.",
    "verifyEmail.goToDashboard": "Naar dashboard",
    "verifyEmail.backToSettings": "Terug naar instellingen",
    "verifyEmail.verifiedFooterPrompt": "Klaar hier?",
    "verifyEmail.verifiedFooterCta": "Terug naar instellingen",
    "verifyEmail.errorHeading": "We konden die link niet bevestigen.",
    "verifyEmail.errorBody": "Bevestigingslinks verlopen na 24 uur en kunnen maar één keer gebruikt worden. Meld u aan en vraag een nieuwe link aan via uw instellingen.",
    "verifyEmail.errorRequestNewLink": "Nieuwe link aanvragen",
    "verifyEmail.errorBackToLogin": "Terug naar aanmelden",
    "verifyEmail.errorFooterPrompt": "Hulp nodig?",
    "verifyEmail.errorFooterCta": "Contact opnemen met support",
    "verifyEmail.checkInboxHeading": "Controleer uw inbox.",
    "verifyEmail.checkInboxSubtitle": "We hebben net een bevestigingslink naar uw werk-e-mailadres gestuurd. Klik erop om uw account te activeren.",
    "verifyEmail.checkInboxCardTitle": "De e-mail is onderweg",
    "verifyEmail.checkInboxCardBody": "Hij komt meestal binnen een minuut aan. Controleer uw spammap als hij niet verschijnt.",
    "verifyEmail.checkInboxBackToLogin": "Terug naar aanmelden",
    "verifyEmail.checkInboxFooterPrompt": "Verkeerd e-mailadres?",
    "verifyEmail.checkInboxFooterCta": "Opnieuw beginnen",
    "verifyEmail.checkInboxFallbackPrefix": "Nog steeds niets na 5 minuten? Mail",
    "verifyEmail.checkInboxFallbackSuffix": "en wij bevestigen u handmatig.",

    # noAccess
    "noAccess.title": "Geen toegang",
    "noAccess.topbarTitle": "Niet beschikbaar",
    "noAccess.topbarSubtitle": "Toegang is beperkt",
    "noAccess.returnToDashboard": "Terug naar dashboard",
    "noAccess.contactSupport": "Contact opnemen met support",
    "noAccess.default.title": "Dit onderdeel is niet beschikbaar voor uw rol.",
    "noAccess.default.body": "Als u denkt dat dat niet klopt, neem dan contact op met uw kantooreigenaar of mail ons op support@immo.app.",
    "noAccess.sections.users.title": "Kantoorbeheer wordt geregeld door {brand}.",
    "noAccess.sections.users.body": "De globale gebruikerslijst is enkel beschikbaar voor platformbeheerders en supportmedewerkers. Om collega's binnen uw kantoor toe te voegen of te verwijderen, gebruikt u het tabblad Leden op de detailpagina van uw kantoor, of mailt u ons op support@immo.app.",
    "noAccess.sections.invite.title": "Nieuwe gebruikers uitnodigen is beperkt.",
    "noAccess.sections.invite.body": "Beheerders en makelaar-kantooreigenaars kunnen mensen uitnodigen op het platform. Als u denkt dat u toegang hoort te hebben, vraag dan uw kantooreigenaar om het eigenaarschap aan u over te dragen, of mail ons op support@immo.app.",
    "noAccess.sections.teams.title": "Kantoorbeheer is niet beschikbaar voor uw rol.",
    "noAccess.sections.teams.body": "De kantorenlijst wordt door agentschappen gebruikt om hun bezetting te beheren. Freelancers werken zelfstandig en horen niet bij deze weergave. U kunt nog steeds samenwerken op opdrachten via de pagina Opdrachten.",
    "noAccess.sections.newAssignment.title": "Opdrachten aanmaken is niet beschikbaar voor uw rol.",
    "noAccess.sections.newAssignment.body": "Nieuwe opdrachten worden aangemaakt door de kantoorzijde — beheerder, medewerker of makelaar. Freelancers worden door de boekende partij toegewezen aan keuringen, en die verschijnen onder Opdrachten zodra ze ingepland zijn.",
    "noAccess.sections.commissions.title": "Commissiebeheer is enkel voor beheerders.",
    "noAccess.sections.commissions.body": "Het organisatiebrede commissiedashboard is beschikbaar voor platformbeheerders. U kunt de commissieconfiguratie van uw eigen kantoor nog steeds raadplegen op de detailpagina van uw kantoor.",
    "noAccess.sections.revenue.title": "Platformomzetrapporten zijn enkel voor beheerders.",
    "noAccess.sections.revenue.body": "Organisatiebrede omzetoverzichten zijn voorbehouden aan beheerder en medewerker. De geleverde opdrachten van uw eigen kantoor verschijnen op uw kantoordetailpagina.",
    "noAccess.sections.announcements.title": "Aankondigingen worden beheerd door {brand}.",
    "noAccess.sections.announcements.body": "Enkel beheerders kunnen platformbrede aankondigingen aanmaken. U ziet actieve aankondigingen automatisch in het dashboard.",
    "noAccess.sections.admin.title": "Beheerderstools zijn beperkt.",
    "noAccess.sections.admin.body": "De beheerdersconsole is enkel beschikbaar voor platformbeheerders en supportmedewerkers.",

    # invite
    "invite.title": "U bent uitgenodigd",
    "invite.heading": "U bent uitgenodigd.",
    "invite.subtitle": "Stel uw account in en sluit u aan bij uw collega's op {brand}.",
    "invite.expiresInDays": "Uitnodiging verloopt over {days, plural, one {# dag} other {# dagen}}.",
    "invite.invitedBy": "<name></name> heeft u uitgenodigd",
    "invite.yourAccess": "Uw toegang",
    "invite.role": "Rol",
    "invite.team": "Kantoor",
    "invite.joiningAs": "U sluit zich aan als",
    "invite.teamOwner": "Kantooreigenaar",
    "invite.teamMember": "Kantoorlid",
    "invite.teamOwnerSuffix": " — u kunt dit kantoor uitnodigen, bewerken en beheren.",
    "invite.whatsNext": "Wat volgt",
    "invite.step1": "Maak een wachtwoord aan",
    "invite.step2": "Vul uw profiel aan",
    "invite.step3": "Begin met het beheren van certificaten",
    "invite.accept": "Accepteren en wachtwoord aanmaken",
    "invite.decline": "Weigeren",
    "invite.termsAcceptance": "Door te accepteren gaat u akkoord met de Algemene voorwaarden en het Privacybeleid van <brand></brand>.",
    "invite.roles.admin": "Beheerder",
    "invite.roles.staff": "Medewerker",
    "invite.roles.realtor": "Makelaar",
    "invite.roles.freelancer": "Freelancer",
    "invite.problems.notFound.title": "Uitnodiging niet gevonden.",
    "invite.problems.notFound.body": "Deze link komt niet overeen met een uitnodiging in ons systeem. Controleer de URL of vraag een nieuwe uitnodiging aan.",
    "invite.problems.notFound.ctaLabel": "Contact opnemen met support",
    "invite.problems.expired.title": "Deze uitnodiging is verlopen.",
    "invite.problems.expired.body": "Uitnodigingen zijn slechts 7 dagen geldig. Vraag de persoon die u uitnodigde om een nieuwe te sturen.",
    "invite.problems.expired.ctaLabel": "Contact opnemen met support",
    "invite.problems.revoked.title": "Deze uitnodiging is ingetrokken.",
    "invite.problems.revoked.body": "De persoon die u uitnodigde heeft de uitnodiging geannuleerd. Vraag het hen rechtstreeks als dit een vergissing was.",
    "invite.problems.revoked.ctaLabel": "Terug naar home",
    "invite.problems.accepted.title": "Reeds geaccepteerd.",
    "invite.problems.accepted.body": "Deze uitnodiging is al gebruikt. Als u dat was, meld u dan aan met uw wachtwoord.",
    "invite.problems.accepted.ctaLabel": "Naar aanmelden",
    "invite.problems.returnHome": "Terug naar home",
    "invite.problems.expiredFooterPrompt": "Al een account?",
    "invite.problems.expiredFooterCta": "Aanmelden",
    "invite.alreadySignedIn.title": "U bent al aangemeld.",
    "invite.alreadySignedIn.subtitle": "Deze uitnodiging accepteren zou uw huidige sessie vervangen.",
    "invite.alreadySignedIn.currentlySignedInAs": "Momenteel aangemeld als",
    "invite.alreadySignedIn.inviteIsFor": "Deze uitnodiging is voor",
    "invite.alreadySignedIn.signOutAndContinue": "Afmelden en doorgaan",
    "invite.alreadySignedIn.backToDashboard": "Terug naar dashboard",
    "invite.alreadySignedIn.closeTabHint": "Als deze uitnodiging niet voor u bedoeld is, sluit dan gewoon dit tabblad — uw sessie blijft ongewijzigd.",
    "invite.alreadySignedIn.loginAsSomeoneElse": "Of meld u aan als iemand anders",
    "invite.setPassword.title": "Maak uw wachtwoord aan",
    "invite.setPassword.heading": "Maak uw wachtwoord aan.",
    "invite.setPassword.subtitle": "Nog één laatste stap — kies een wachtwoord om uw account af te ronden.",
    "invite.setPassword.settingUpFor": "Account instellen voor",
    "invite.setPassword.firstName": "Voornaam",
    "invite.setPassword.lastName": "Achternaam",
    "invite.setPassword.email": "Werk-e-mailadres",
    "invite.setPassword.password": "Wachtwoord",
    "invite.setPassword.passwordHint": "Minstens 10 tekens.",
    "invite.setPassword.confirmPassword": "Wachtwoord bevestigen",
    "invite.setPassword.termsPrefix": "Ik ga akkoord met de",
    "invite.setPassword.termsLink": "Algemene voorwaarden",
    "invite.setPassword.termsAnd": "en",
    "invite.setPassword.privacyLink": "Privacybeleid",
    "invite.setPassword.submit": "Account aanmaken",
    "invite.setPassword.footerPrompt": "Verkeerd account?",
    "invite.setPassword.footerCta": "Ga terug",
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
    nl_ns = hashes.get("nl-BE", {}).get("auth", {})
    for path in PATCHES:
        if path in nl_ns:
            del nl_ns[path]
    HASHES.write_text(json.dumps(hashes, indent=2, ensure_ascii=False) + "\n")

    print(f"Applied {len(PATCHES)} translations + cleared hashes.")


if __name__ == "__main__":
    main()
