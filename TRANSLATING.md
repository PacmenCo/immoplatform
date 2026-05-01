# Translating immoplatform

The single source of truth for **how** we translate copy in this repo. Anyone (Claude, future-you, a hired translator) adding strings to `messages/nl-BE/*.json` or `messages/en/*.json` reads this first.

It exists because:

- The v1 codebase (`../Platform`, the existing Asbestexperts CRM in production) already established the Belgian-Dutch vocabulary our customer base recognizes. Migrating users will feel any drift.
- v1's tone register is solid in places and broken in others (it mixes formal `u` and informal `je` inside the same email). v2 commits to **formal `u` everywhere** and won't reproduce the mistake.
- The Belgian regulatory landscape has fixed terms (Asbestinventarisattest, AREI, OVAM, VEKA) that translators unfamiliar with the domain frequently get wrong.

**When in doubt about a term, search this file first. If the term isn't here, search `messages/nl-BE/*.json` for prior precedent before inventing your own.**

---

## 1. Locked glossary

These pairings are **not negotiable**. Search-and-replace across `messages/nl-BE/*` if a translator drifts. Each entry shows the v2 catalog example so the surrounding tone is also visible.

### Domain nouns

| EN | nl-BE | Notes |
|---|---|---|
| Team | **Kantoor** | Real-estate office. NEVER "team". v1 convention. Used in: sidebar nav (`Kantoren`), team detail page, sidebar card on assignment edit (`Kantoor`). |
| Assignment | **Opdracht** | NEVER "taak", NEVER "assignment". The whole CRM lifecycle is built around the word. Plural: `Opdrachten`. |
| Realtor / Agent | **Makelaar** | NEVER "vastgoedmakelaar", NEVER "agent". Refers to the agency person on a deal. |
| Inspector | **Deskundige** (generic) / **Asbestdeskundige** (asbestos-specific only) | Use `deskundige` for cross-service contexts (assignment form, calendar). Use `asbestdeskundige` only when the service is asbestos. |
| Owner (of property) | **Eigenaar** | The person signing the assignment form. |
| Tenant | **Huurder** | If property is currently leased. |
| Tenant (firm/company owner) | **Bedrijf** | As an owner-type radio (`particulier` / `bedrijf`). |
| Owner (private person) | **Particulier** | As an owner-type radio. Belgian-Dutch loanword from French; standard in BE invoicing context. |
| Property | **Pand** | NEVER "woning" or "eigendom" generically. v1 + Belgian real-estate convention. |
| File / Document | **Bestand** | Plural: `bestanden`. NEVER "document(en)" — "documenten" implies legal/contractual docs in BE Dutch. |
| Calendar | **Agenda** | NEVER "kalender" — `kalender` means a wall-calendar, not a scheduling app. |
| Appointment / Meeting | **Afspraak** | NEVER "vergadering" or "meeting". |
| Office (the agency's physical office) | **Kantoor** | Doubles as "team" — disambiguate by context. |
| Comment (on assignment) | **Opmerking** | Plural: `opmerkingen`. NEVER "bemerking" / "commentaar" mixed. Pick one and stick. |
| City / Town | **Gemeente** | Belgian Dutch favors `gemeente` over `stad`. Postal-address fields use `Gemeente`. |
| Deliverable / Output | **Oplevering** | What the inspector hands back (PDF + photos). NEVER "levering" or "aflevering". |
| Key pickup | **Sleutelafhaling** | The key-pickup workflow before a site visit. |
| Discount | **Korting** | (when re-enabled) |
| Commission | **Commissie** | Loanword OK; `commissieregels` for line items. |
| Revenue | **Omzet** | Sidebar nav. |

### Action verbs (button labels — use infinitive)

| EN | nl-BE |
|---|---|
| Save | **Opslaan** |
| Cancel | **Annuleren** |
| Delete | **Verwijderen** |
| Edit | **Bewerken** |
| Change | **Wijzigen** |
| Confirm | **Bevestigen** |
| Discard | **Verwerpen** |
| Close | **Sluiten** |
| Sign in | **Aanmelden** |
| Sign out | **Afmelden** |
| Switch (account/team) | **Wisselen** |
| Send | **Versturen** |
| Upload | **Uploaden** (loanword OK) |
| Download | **Downloaden** |
| Pick / Select | **Selecteren** |
| Search | **Zoeken** |
| Open | **Openen** |
| Pickup (key) | **Ophalen** |

### Status labels (assignment lifecycle)

Source of truth: `dashboard.assignments.statuses` in `messages/{en,nl-BE}/dashboard.json`. Code lives in `src/lib/mockData.ts`.

| EN | nl-BE | Hue |
|---|---|---|
| Draft | **Concept** | slate |
| Awaiting | **In afwachting** | slate-darker |
| Scheduled | **Ingepland** | blue |
| In progress | **In uitvoering** | amber |
| Delivered | **Geleverd** | green |
| Completed | **Voltooid** | lime |
| On hold | **Geparkeerd** | zinc |
| Cancelled | **Geannuleerd** | red |

### User roles

Source of truth: `dashboard.users.roles` in `messages/nl-BE/dashboard.json`.

| EN | nl-BE |
|---|---|
| Admin | **Beheerder** |
| Staff | **Medewerker** |
| Realtor | **Makelaar** |
| Freelancer | **Freelancer** (loanword; no idiomatic Belgian replacement) |

### Service labels (regulatory/official BE terminology)

Source of truth: `services.<key>.title` and `services.<key>.dashboardDescription` in `messages/{en,nl-BE}/services.json`.

| Key | Short code (don't translate) | nl-BE long form |
|---|---|---|
| `epc` | EPC | **Energieprestatiecertificaat** |
| `asbestos` | AIV | **Asbestinventarisattest** |
| `electrical` | EK | **Elektrische keuring** |
| `fuel` | TK | **Stookolietankcontrole** |
| `photos` | PH | **Pandfotografie** |
| `signage` | SG | **Verkoop-/verhuurbord** |

The **short codes** (EPC, AIV, EK, TK, PH, SG) are visual identifiers. NEVER translate — they appear on service pills and color-coded badges across the app.

For the regulatory long forms: these are the names used by **OVAM** (asbestos), **VEKA** (energy), **AREI/RGIE** (electrical) in their own publications — using anything else (e.g. "elektrische inspectie" instead of "elektrische keuring") makes the copy feel non-Belgian.

---

## 2. Tone register

### Always formal. Never mix.

- **Use `u` / `uw`** in every customer-facing string. NEVER `je` / `jij` / `jouw`.
- **One register per message.** v1 broke this rule in emails ("Beste {name}, kunt u…" then later "we sturen je een bericht"). Don't reproduce. Pick `u` and commit, every sentence.
- Internal admin/dev tools (audit log details, debug pages) can stay English — they're not customer-facing.

### Greetings + closings (emails, formal correspondence)

| Slot | nl-BE |
|---|---|
| Greeting | **Beste {firstName}**, |
| Closing | **Met vriendelijke groet,** |
| Signature line | **Het immoplatform-team** (if generic) or specific team member name |

### Button voice — infinitive, not imperative

| Right | Wrong |
|---|---|
| `Opslaan` | `Sla op` |
| `Annuleren` | `Annuleer` |
| `Bewerken` | `Bewerk` |
| `Verwijderen` | `Verwijder` |

This matches Belgian web/SaaS convention. Imperative ("Sla op") sounds barked.

### Sentence-level voice

Belgian Dutch leans **passive + conditional** more than Netherlands Dutch:

- "**Wordt** op het agenda-event getoond onder Makelaar." (preferred) vs "We tonen dit op het agenda-event…" (more NL-Dutch)
- "**Wordt** toegepast bij voltooiing." vs "We passen dit toe bij voltooiing."
- "**Normaliter zou u…**" — softens an instruction
- "**Vergeet niet om…**" — gentle imperative
- "**Nog niet ingepland**" — for empty states

Read longer paragraphs aloud. If they sound brisk and Hollands-Dutch, rephrase passively.

### Compact dashboard copy precedent

These actual nl-BE catalog values illustrate the tone we ship:

```
shared.assignmentForm.servicesSubtitle →
  "Selecteer er een of meer. Wij regelen de planning en de oplevering."

assignments.detail.commissionDescription →
  "Toegepast bij voltooiing. Vastgelegd op dat moment — latere
   wijzigingen aan het tarief herschrijven deze regel niet."

shared.unsavedChanges.description →
  "U heeft niet-opgeslagen wijzigingen op deze pagina. Als u nu
   vertrekt, gaan ze verloren."

shared.settingsScopeBanner.personalDescription →
  "Wijzigingen hier hebben enkel betrekking op uw eigen account.
   Andere kantoorgenoten behouden hun eigen voorkeuren."

assignments.detail.timeAgo.justNow → "zonet"
```

Match this register when adding new dashboard copy.

---

## 3. Belgian-Dutch idiomatic preferences (vs. Netherlands Dutch)

| Domain | BE preferred | NL-Dutch (avoid) |
|---|---|---|
| City/town field label | `Gemeente` | `Stad` |
| Real-estate office | `het kantoor` | `het bureau` |
| Apartment | `appartement` | (same — but BE colloquial `flat` is also OK in customer copy if context warrants; default to `appartement`) |
| Car park / parking | `parking` (loanword OK) | `parkeerplaats` |
| Currency format | `€ 1.250,00` (period thousand, comma decimal) | (same — but ensure ICU number format respects nl-BE locale) |
| Date format | `d-m-Y` or `d/m/Y` (e.g. `28-04-2026`) | (same; both regions use European order) |
| `enkel` (BE) | preferred over `alleen` | `alleen` (more NL) |
| `momenteel` (BE) | preferred over `op dit moment` | `op dit moment` |
| `vergeet niet om…` | preferred over `denk eraan om…` | (NL also uses both — BE leans former) |

---

## 4. Don't-translate list

These tokens stay **English / unchanged** regardless of locale. If you find them in nl-BE values, it's a bug.

### Brand identifiers

`immoplatform`, `immoplatform.be`, `Immoplatform BV`, `Asbest Experts`, `Asbestexperts`, `EPC Partner`, `Elec Inspect`, `Tank Check`, `Eyefine` (the ancestor codebase), `Winergy`.

### Service codes

`EPC`, `AIV`, `EK`, `TK`, `PH`, `SG`, `OPDRACHTFORMULIER` (filename + PDF banner).

### Regulatory bodies + standards

`OVAM`, `AREI`, `RGIE`, `KBO`, `VEKA`, `EU`, `GDPR`, `AVG` (the Dutch acronym for GDPR — use this in nl context only when the surrounding sentence is Dutch).

### Geography

`Belgium`, `Belgique` (no — use `België` in nl), `Flanders` → `Vlaanderen`, `Wallonia` → `Wallonië`, `Brussels` → `Brussel`. (These ARE translatable to nl forms — only the `EN` originals are don't-translate placeholders. The nl forms above are the canonical Belgian Dutch spellings.)

### Audit log content

The `verb` field of `audit({ verb, metadata })` is an enum (`assignment.created`, etc.). NEVER translate the verb identifier itself. The catalog at `dashboard.users.detail.verbs.<verb>` carries the human-readable rendering — that's the translatable surface.

### External system identifiers

Odoo product IDs / pricelist IDs / sale order IDs. These are stable cross-system references. Their human-readable names ARE translatable; the IDs are not.

### Technical strings

Email addresses, URLs, file paths, environment variable names (`CALENDAR_ENCRYPTION_KEY`, `S3_ENDPOINT`, etc.), code identifiers, log strings.

### Test fixture data

Any value containing `@immo.test` or matching `Test * Team` / `Test * User` / `ASG-2026-9XXX` — these are seed-data fixtures, not user-facing copy.

---

## 5. ICU + rich-text rules

Catalog values can carry placeholders + tags. These rules are non-negotiable; breaking them surfaces as runtime errors or silent UI bugs.

### Placeholders — preserve verbatim

```
"teamCreatedAt": "Aangemaakt op {date}"
"plannedDateAria": "Geplande datum voor {service}"
"summary": "{assigned} van {total} toegewezen"
```

If the EN original has `{count}`, the nl-BE value MUST have `{count}`. NEVER translate the placeholder name (`{name}` ↛ `{naam}`) — the runtime ICU lookup is by literal key.

### Plurals — use the `plural` ICU form

```
"commentsCount": "{count, plural, =0 {0 opmerkingen} =1 {1 opmerking} other {# opmerkingen}}"
"days": "{n, plural, =1 {1 dag geleden} other {# dagen geleden}}"
"filesReady": "{count, plural, one {# bestand klaar om te uploaden.} other {# bestanden klaar om te uploaden.}}"
```

- `=N` matches a specific number (`=0`, `=1`, `=2`).
- `one` / `other` are CLDR plural categories. nl-BE uses the same `one` / `other` split as English.
- `#` inside the branch is replaced by the variable's value.
- `.toLowerCase()` is fine for inline status labels (e.g. `t("subtitle.filtered", { statusLabel: tStatuses(status).toLowerCase() })`).

### Rich-text tags — preserve `<tag></tag>` shape

```
"intro": "Read-only view of pricelists in <db></db>. Edit in Odoo."
```

The catalog value contains `<db></db>` — a placeholder tag the React side replaces via `t.rich("intro", { db: () => <code>…</code> })`. The nl-BE value must keep `<db></db>` in the same position. NEVER replace it with text or rename the tag.

If you need the tag to wrap different copy in nl-BE, you can shift it within the sentence — just keep the `<db></db>` shape.

### `markTodoLeaves` ⚠ markers — your dev-mode signal

In dev, any `messages/nl-BE/*.json` value that starts with `[TODO en: …]` renders wrapped in `⚠ ⚠` and logs `[i18n] untranslated leaf at nl-BE:<path> → <value>` to the browser console.

When you're translating: open the page in the browser, scan for `⚠`, fix the corresponding catalog entry, hot-reload, repeat. Console warnings without ⚠ markers are usually from chunks for routes you haven't visited — ignore those unless you're translating that route.

---

## 6. Workflow

```bash
# 1. Pull latest. Catalog drift surfaces here:
npm run i18n:check
# Reports: missing / stale / todo / orphan / extra / namespace-missing.
# Exits non-zero if drift exists — CI runs this on every PR touching i18n.

# 2. After editing messages/en/*.json (adding new keys), mirror to nl-BE
#    as TODO placeholders + record sidecar hashes for already-translated entries:
npm run i18n:sync

# 3. Codegen runs whenever you ADD a new namespace file (messages/en/<ns>.json)
#    — keeps the generated namespace list + AppConfig augmentation honest:
npm run i18n:codegen
#  (CI also runs `npm run i18n:codegen -- --check` to detect drift)

# 4. Edit messages/nl-BE/*.json directly. Save. Hot-reload.
#    Boot dev server and navigate the affected route.
npm run dev
#    Look for ⚠ markers (untranslated leaves) and read browser console for
#    [i18n] warnings. Fix until clean.

# 5. Before commit:
npm run i18n:check     # MUST pass clean
npx tsc --noEmit       # typed-key access at every callsite
npx vitest run         # framework tests for i18n routing/namespace-loading
```

### Adding a new namespace

1. Create `messages/en/<namespace>.json` with the EN keys.
2. Run `npm run i18n:sync` — generates `messages/nl-BE/<namespace>.json` populated with `[TODO en: …]` placeholders for every leaf.
3. Run `npm run i18n:codegen` — adds the namespace to `src/i18n/_generated/namespaces.ts` + augments `messages.d.ts`.
4. Translate the nl-BE file in place.
5. `npm run i18n:sync` again — records sidecar hashes for the now-translated entries (so future EN edits surface as `stale` if they happen).
6. `npm run i18n:check` — confirm zero drift.

### Acknowledging stale translations

If you edit an EN value and DON'T re-translate the nl-BE side, `i18n:check` flags it as `stale` (sidecar hash mismatch). Two ways forward:

- **Fix it**: edit the nl-BE value to match the new EN intent, then `npm run i18n:sync` records the new hash.
- **Acknowledge "still good"**: delete the entry's hash from `messages/_hashes.json`, then `npm run i18n:sync`.

`npm run i18n:sync` **never auto-overwrites an existing hash** — staleness must surface visibly, not get auto-silenced. (This was the original sync bug; the contract is intentional.)

---

## 7. Per-locale legal pages — not catalog-driven

`src/app/[locale]/legal/{privacy,terms,cookies}/{en,nl-BE}.tsx` are full-document files, NOT translation entries. Each page has a top-of-file comment block explaining the workflow and a `{/* TODO(translator) */}` marker for legal counsel.

**Do NOT** try to fragment legal copy into `messages/nl-BE/legal.json` keys — Belgian legal text is reviewed end-to-end by counsel and shouldn't be split into JSON values.

When translating these:

- Section numbering (1.1, 2.1, …) stays consistent across locales — used for cross-document references.
- Use Belgian regulatory references (`AVG` for GDPR in BE context, **Belgian** Data Protection Authority, OVAM/AREI/RGIE for the relevant compliance domain).
- Legal counsel sign-off required before merging the nl-BE version.

---

## 8. Email + calendar templates

`sendEmail({ ..., locale })` and `buildEventPayload(input, locale)` thread `User.locale` through every transactional template. Build subjects + bodies via `await getTranslations({ locale, namespace })`, NEVER `getLocale()` — emails fire outside a request scope and `getLocale()` won't resolve.

The recipient's `User.locale` was set at registration to the active request locale. Trust it. If a user changes locale in settings, future emails follow.

PDF generation (`opdrachtformulier.pdf`) is intentionally **English-only for now** — deferred until a translator review of legal-document tone is available. Existing nl-BE date/currency formatting inside PDFs is correct and shouldn't be reverted.

---

## 9. When you're not sure

1. **Search the catalog**: `grep -r "<English term>" messages/en/` — see how it's been used elsewhere first.
2. **Search the nl-BE side**: `grep -r "<candidate Dutch term>" messages/nl-BE/` — confirm consistency or find the prior-translator's choice.
3. **Check v1**: `grep -rE "<term>" ../Platform/resources/views/` — the production CRM copy is the reference for tone + vocabulary the existing customer base recognizes.
4. **Match the section's tone**: a transactional email is more formal than a settings tooltip. Read 3–5 nearby entries before writing.
5. **Default to formal `u` + the v1 glossary above.**

If after all that you're still unsure about a domain term, leave a `[TODO en: …]` placeholder in nl-BE and mention it in the PR description — easier to flag than to silently merge a guess.
