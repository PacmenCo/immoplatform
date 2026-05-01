@AGENTS.md

# Immo Platform

Public marketing site + (eventually) agent portal for a merged-entity real-estate certification service. Four companies under one brand: EPC certificates, asbestos attests, electrical inspections, fuel-tank checks. Primary market: Belgium. Language: English for now.

Related codebases (for domain reference only, do **not** copy code from them):
- `../Platform` — Asbestexperts closed CRM (Laravel + Livewire). Fork of Eyefine.
- `../app.winergy/winergy` — Winergy CRM (Laravel + Livewire). Same lineage.

This project deliberately starts fresh in Node/TS/Next.js — do not reintroduce Laravel.

## Stack

- **Next.js 16** (App Router, Turbopack) — read `node_modules/next/dist/docs/01-app/` before writing Next-specific code, APIs have shifted from earlier major versions
- **React 19**, **TypeScript**
- **Tailwind CSS 4** — tokens live in `src/app/globals.css` under `:root`; the `@theme inline` block exposes them to Tailwind
- **Prisma 6** — dev + prod both run on **PostgreSQL** (dev uses local `immo_dev`; prod uses the droplet's `immo` DB). The schema's `provider` is `"postgresql"`; `prisma/dev.db` is a leftover empty file from the SQLite era. Migrations in `prisma/migrations/`. Re-run `npx prisma db seed` after schema changes — the seed is idempotent (upserts) and password-rotates every dummy user to `Jordan1234` on each run.

## Project layout

```
src/
├── app/
│   ├── (marketing)     # homepage, /services/[slug], /legal/*, /pricing, /login, /register
│   ├── dashboard/      # authenticated CRM — sections per route segment
│   ├── api/oauth/…     # per-provider OAuth route handlers (google, outlook)
│   ├── actions/        # server actions (withSession-wrapped, ActionResult<T>)
│   ├── layout.tsx      # root metadata + fonts + UnsavedChangesProvider
│   └── globals.css     # design tokens + resets
├── components/         # marketing sections + shared dashboard + ui/ primitives
└── lib/                # auth, db, pricing, commission, calendar, financial, …
```

Keep page files thin (composition only). Business logic lives in `src/lib/*`; server-action-facing glue lives in `src/app/actions/*`.

## Backend reality (as of this session)

- **Auth:** cookie-based session (see `src/lib/auth.ts`); roles `admin | staff | realtor | freelancer`. Permission gates in `src/lib/permissions.ts` (`hasRole`, `canEditAssignment`, scope helpers). Use `withSession` from `src/app/actions/_types.ts` to wrap any mutation.
- **Money math:** integer cents everywhere; percentages are basis points (15% = `1500`). Never store float prices. Pricing engine `src/lib/pricing.ts`; commission `src/lib/commission.ts`; financial overview `src/lib/financial.ts`.
- **Audit:** `audit({actorId, verb, ...})` from `src/lib/auth.ts` — the `AuditVerb` union is compile-time-enforced. Extend the union when adding a new mutation.
- **Emails:** `src/lib/email.tsx` wraps dev-console / Postmark / Resend behind `sendEmail`. Event templates live in the same file; user opt-outs via `emailPrefs` JSON + `shouldSendEmail` (`src/lib/email-events.ts`).
- **Calendar sync:** `src/lib/calendar/*` — agency Google (service account) + per-user Google + Outlook via MSAL/Graph directly (no n8n). Tokens AES-GCM-encrypted using `CALENDAR_ENCRYPTION_KEY`. `syncAssignmentToCalendars(id, action)` is best-effort and called from assignment lifecycle actions.
- **Forms:** `useFormDirty(ref)` + `useUnsavedChanges(dirty)` (from `src/components/dashboard/UnsavedChangesProvider`) wire an unsaved-changes guard. Use `ConfirmDialog` (`src/components/ui/ConfirmDialog.tsx`), never `window.confirm`.
- **Prisma-server-only separation:** anything under `src/lib/*` that imports `prisma` or emits queries starts with `import "server-only"`. Keep pure helpers (date math, Period types, etc.) in separate server-safe files so client components can reuse them — see `src/lib/period.ts` as the pattern.

Related codebase to consult for domain parity: **Platform** at `../Platform`. Read its `app/Services/*` + `app/Http/Controllers/*` when porting a feature. Never copy code — port the concept in TypeScript.

## Design tokens

Defined in `globals.css` as CSS custom properties. Use via arbitrary Tailwind values (`bg-[var(--color-brand)]`) rather than hardcoded hex. Service accents are semantic, not decorative — every service keeps its own color across the site:

- EPC → `--color-epc` (emerald)
- Asbestos → `--color-asbestos` (rose)
- Electrical → `--color-electrical` (amber)
- Fuel Tank → `--color-fuel` (sky)

## Internationalization (i18n)

`next-intl` powers EN + Flemish (`nl-BE`), structured so adding more locales is a one-line change in `src/i18n/routing.ts`.

> **Translation style guide:** read `TRANSLATING.md` (repo root) before writing any nl-BE values. It locks the v1-derived glossary (kantoor / opdracht / makelaar / deskundige / pand / agenda), the formal `u` register, regulatory long-forms (Asbestinventarisattest, Energieprestatiecertificaat, AREI, OVAM), the don't-translate list, and ICU + rich-text rules. Every translator-facing convention lives there.

- **URL shape:** `/en/...` and `/nl/...`. Internal locale IDs are `en` and `nl-BE` (region-tagged so copy can lean Flemish; `fr-BE` slots in symmetrically later). The `[locale]` segment lives at `src/app/[locale]/`; API routes, server actions, and root metadata files (`manifest.ts`, `sitemap.ts`, `robots.ts`, `opengraph-image.tsx`) stay at `src/app/`.
- **Default + negotiation:** `src/middleware.ts` wraps `next-intl/middleware` with a `Vary: Accept-Language, Cookie` append. First-hit negotiation reads `Accept-Language`, persists choice via `NEXT_LOCALE` cookie, and falls back to `nl-BE`.
- **Build wiring:** `next.config.ts` wraps the config with `createNextIntlPlugin("./src/i18n/request.ts")`. Without this, server-side translation lookups (`getTranslations`, `useTranslations`) throw at request time.
- **Message catalog:** `messages/<locale>/<namespace>.json`. Namespaces (`common`, `home`, `services`, `legal`, `auth`, `dashboard`, `errors`, `emails`, `calendar`) are loaded by `src/i18n/request.ts`. The list + the `AppConfig.Messages` augmentation are CODEGEN'd from `messages/en/*.json` — drop a new namespace JSON file, run `npm run i18n:codegen`, and both register automatically.
- **Type-safe keys:** `src/types/messages.d.ts` (generated) augments `use-intl`'s `AppConfig` with the EN catalog shape. `t('cards.epc.titel')` is a compile error, not a runtime `MISSING_MESSAGE`.
- **In components:**
  ```ts
  import { useTranslations } from "next-intl";
  const t = useTranslations("home.hero");
  return <h1>{t("title")}</h1>;
  ```
  Outside the request scope (emails, route handlers, calendar payloads): `await getTranslations({ locale, namespace })`. Pass the recipient's `User.locale` explicitly — `getLocale()` won't resolve outside a request.
- **Internal links and redirects:** import `Link`, `usePathname`, `useRouter` from `@/i18n/navigation` instead of `next/link` / `next/navigation`. For server-side redirects from anywhere inside a request scope (server actions, server components under `[locale]/`), use `localeRedirect(href)` from `@/i18n/navigation` — it resolves the active locale and prefixes the path for you. The lower-level `redirect({ href, locale })` from `@/i18n/navigation` is still exported for outside-request-scope callers (emails, cron) where you must pass the recipient's locale explicitly. For redirects to fully external URLs (Google/Outlook OAuth initiate), use `redirect` from `next/navigation` directly.
- **Per-page hreflang + canonical:** every page that wants SEO alternates calls `buildLocaleAlternates(pathnameWithoutLocale)` from `@/i18n/metadata` inside `generateMetadata`. Layout-level `alternates.languages` would point hreflang at the wrong URL on every nested page (Next's metadata resolver only re-bases relative paths) — do NOT set it there.
- **`revalidatePath` after mutations:** use `revalidatePath("/[locale]/some/path", "page")` — the literal `[locale]` segment plus the `"page"` second argument so all locale variants invalidate. Plain `revalidatePath("/some/path")` only invalidates the unprefixed cache entry, which doesn't exist for routes inside `[locale]/`.
- **Locale switcher:** `src/components/i18n/LocaleSwitcher.tsx`, mounted in marketing `Nav` and dashboard `Topbar`. Preserves the rest of the path and any dynamic params on swap.
- **`<html lang>`:** flows from the URL segment in `src/app/[locale]/layout.tsx` — `nl-BE` or `en`, never the URL form.

### Translation patterns + conventions

Pick the right shape per surface; don't reinvent.

**1. Server-action errors return keys, not strings.** `ActionResult.error` carries an `errors.<domain>.<reason>` key (e.g. `errors.session.expired`, `errors.assignment.notFound`, `errors.permission.forbidden`). Add new error conditions to `messages/en/errors.json` first, then return that key from the action. Never return a human English string.

UI display sites (toasts, inline form errors, anywhere user-visible) resolve via the **`useTranslateError` hook** (`src/i18n/error.ts`):
```tsx
const tErr = useTranslateError();
const res = await someAction();
if (!res.ok) toast.error(tErr(res.error));
```
The hook detects `errors.*` prefixed strings and resolves them against the `errors` namespace; pass-through for non-keys. Keeps Toast (and similar primitives) framework-agnostic.

**2. Page `metadata.title` flows through the catalog.** Replace `export const metadata = { title: "Users" }` with:
```ts
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard.pageTitles");
  return { title: t("users") };
}
```
Browser tab titles + SERP previews then localize naturally.

**3. Legal pages use per-locale source files, not catalog entries.** Privacy/terms/cookies copy is dense legal text reviewed end-to-end per language. The shape is `legal/<page>/page.tsx` (a thin loader) + `legal/<page>/<locale>.tsx` (the actual content per locale). Loader reads the active locale and dynamically imports the matching module. Translators (or legal counsel) edit the per-locale `.tsx` files as complete documents — never as fragmented JSON keys.

**4. Email + calendar templates accept the recipient's locale.** `sendEmail({ ..., locale })` and `buildEventPayload(input, locale)` thread `User.locale` (set at registration to the active request locale) through every transactional template. Build subjects + bodies via `getTranslations({ locale, namespace })`.

**5. PDF generation stays English for now** — deferred until a translator review of legal-document tone is available. Existing `nl-BE` formatting (dates, currency) inside PDFs is correct for the Belgian market and shouldn't be reverted.

### Don't-translate list

These tokens stay English (or unchanged) regardless of locale. Skip them during extraction; document inline if the surrounding string makes the choice non-obvious.

- **Brand identifiers:** `immoplatform`, `Immoplatform BV`, `immo`, `platform`, `Asbest Experts`, `EPC Partner`, `Elec Inspect`, `Tank Check`.
- **Service codes:** `EPC`, `AIV`, `EK`, `TK`, `PH`, `SG`, `OPDRACHTFORMULIER`.
- **Domain references:** `Belgium`, `Flanders`, `Wallonia`, `Brussels`, `EU`, `AREI`, `RGIE`, `OVAM`, `KBO`, VAT numbers, postal codes.
- **Audit log content** (`audit({ verb, metadata })`): admin-only, never customer-facing. The `verb` is an enum; `metadata` is structured JSON. No prose to translate.
- **Odoo product mapping IDs / external system identifiers**: stable codes used for cross-system lookups, never user-prose.
- **Email addresses, URLs, file paths, environment variable names, technical config strings.**

When in doubt: if a Belgian Flemish customer would read this string and form an impression about your product, translate it. Otherwise, leave it.

### Staleness contract — when EN changes, which non-EN keys need re-translation

Every translated entry has a sidecar SHA-256 hash of the EN source string captured at translation time, stored in `messages/_hashes.json`. Two scripts enforce the contract:

- `npm run i18n:check` — reports `missing` / `stale` / `todo` / `orphan` / `extra` / `namespace-missing` drift. Exits non-zero on any drift. **Run before deploying.** CI runs it on every PR touching the catalog or i18n code.
- `npm run i18n:codegen -- --check` — catches drift between the catalog and committed `_generated/namespaces.ts` + `messages.d.ts`. Also runs in CI.
- `npm run i18n:sync` — adds missing EN keys to non-EN files as `[TODO en: <english>]` placeholders, removes orphans, records sidecar hashes for **newly translated** entries only. Sync never overwrites an existing hash — staleness must surface, not be auto-silenced. To acknowledge a re-translation against new EN, delete the relevant `_hashes.json` entry and re-run sync.

Translator workflow: edit EN → `npm run i18n:sync` (adds TODOs) → replace TODOs with real translations → `npm run i18n:check` (must pass).

## Performance requirements

**Hard requirement: pages feel instant on click.** Two rules:

### 1. GET-only pages must be cacheable + fast

Any page that only needs data from public/read-only GET endpoints must be renderable as a **static** or **ISR** Server Component. Don't wrap a read-only page in a client component just to fetch data. Use `fetch(url, { next: { revalidate: N } })` or static data imports — let Next.js cache at build/request time.

### 2. Prefetch the next page on hover

When a user hovers a link, the destination's data should already be in flight. So by the time they click, the paint is near-instant.

**Preferred pattern — default `<Link>`:**
In App Router, `<Link>` default (`prefetch="auto"`) already prefetches on viewport entry in production and re-prefetches on hover if data expired. For most nav/CTA links, just use `<Link href="…">` — this satisfies the requirement.

**Strict hover-only (no viewport prefetch)** — use when the viewport has many links and you want to avoid bandwidth churn:

```tsx
'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function HoverPrefetchLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter()
  return (
    <Link
      href={href}
      prefetch={false}
      onMouseEnter={() => router.prefetch(href)}
      onFocus={() => router.prefetch(href)}
    >
      {children}
    </Link>
  )
}
```

Always pair `onMouseEnter` with `onFocus` — keyboard users should get the same benefit.

**For non-link data (e.g. hovering a card that opens a modal):** pre-warm the API route the same way — `fetch(url, { priority: 'low' })` inside an `onMouseEnter` handler, or call `queryClient.prefetchQuery()` if TanStack Query is added later.

**Never:**
- Put `prefetch={false}` on a link without a hover handler — that disables both viewport AND hover prefetch entirely.
- Wrap a static page in `'use client'` just to add a prefetch handler — keep the page server-rendered and put the client handler on the link component only.

## Account switcher

Fast role-testing tool. Closed group of accounts (the founder + 3 `@immo.test` test fixtures) that can hot-swap into each other from a topbar dropdown — a real logout-and-login between predefined accounts (not impersonation).

- **Where:** `src/lib/account-switcher.ts` exports `SWITCHER_GROUP` and `FOUNDER_EMAIL`. Server action at `src/app/actions/account-switcher.ts`. UI dropdown at `src/components/dashboard/AccountSwitcher.tsx`, mounted in `Topbar`.
- **Dev/test behaviour:** any group member can swap to any other. Every test user has a known seeded password (`Jordan1234`) so the workflow stays fluid.
- **Production behaviour:** opt-in, locked-down.
  - Gated behind `ALLOW_PROD_SWITCHER=true` in `.env.production`. Unset = feature dormant; flip + `systemctl restart immoplatform` to enable. The kill-switch is the env, not a code change.
  - **Origin restriction:** only the founder (`FOUNDER_EMAIL`) may *initiate* a switch on prod. Test users are valid destinations but never origins, so even a leaked test-user password can't pivot to admin via the switcher.
  - **Test users are not directly loginable:** `scripts/bootstrap-test-users.ts` mints each one with a freshly-generated random bcrypt hash (the plaintext is discarded). `loginInner` also refuses any `@immo.test` email on prod as defense-in-depth.
  - Net: the 3 test rows on prod can be *reached only* via `switchToAccount` from Jordan's session.
- **Audit:** every switch writes one `user.account_switched` row with `actorId = original user`, `metadata = { fromEmail, toEmail }`. Single causal event, not a sign-out + orphan sign-in pair.
- **Bootstrapping the test users on prod:** runs as a one-off after deploy.
  ```bash
  cd /opt/immoplatform/app
  sudo -u immo bash -c 'set -a; source .env.production; set +a; \
    npx tsx scripts/bootstrap-test-users.ts'
  ```
  Idempotent — safe to re-run; rotates each test user's hash to a fresh unguessable value but leaves Jordan and any real users untouched. Prefer this over `prisma db seed`, which still hard-throws on `NODE_ENV === "production"` (it would create demo teams/assignments/comments — way too much for prod).
- **Registration blocks `@immo.test`**: `registerSchema` in `src/app/actions/auth.ts` refuses the domain at signup, so no public user can game the allowlist.
- **Caveat — actions on prod are real:** while switched, you're acting against prod systems (Postmark sends real emails, Odoo writes real invoices, agency Google calendar gets real events). Use the switcher to inspect role-specific UI, not to create demo data.

## Command Center

Kanban board used to track work across projects. This project lives under the `immo` project id.

- **UI:** https://masterplan.templus.be/command-center/
- **API base:** `https://masterplan.templus.be/command-center/api`
- **Login:** `pacmenco@gmail.com` / `Baldr1234` (staff account — has read/write)
- **Full API reference:** `/Users/rl/.claude/plans/command-center-api-reference.md` — read this before making API calls; covers auth, every endpoint, valid statuses/priorities, ID formats, gotchas.

### Quick token + board fetch

```bash
TOKEN=$(curl -s -X POST https://masterplan.templus.be/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"pacmenco@gmail.com","password":"Baldr1234"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -s https://masterplan.templus.be/command-center/api/data \
  -H "Authorization: Bearer $TOKEN"
```

### Workflow conventions

1. New work not on the board → create a todo in **Backlog** under project `immo`.
2. Starting on something → move it to **Planned / In Progress**.
3. Finishing → move it to **Review** (not Done — the human verifies, then moves to Done).
4. If 2+ todos form a theme → create a feature and re-parent them. Pick the feature that matches the area you're touching (run a list fetch first — features pre-exist: Foundation, Assignments (core), Teams & Offices, Notifications, Files & uploads, Scheduling & calendar, Invite & onboarding, Dashboards & lists, Design system & polish, PWA & polish, PDF generation, Admin tools, Homepage v1, Service selection & pricing, Backend — missing endpoints, Frontend interactivity).
5. Always set `createdBy` / `updatedBy` / activity `author` to your model name so the human can see who did what.

## Production deployment

Live at **https://immoplatform.be** on a DigitalOcean droplet (set up 2026-04-28).

### Server

- **IP:** `178.128.246.222` (DO Basic · 1 vCPU · 1 GB RAM · 25 GB disk)
- **OS:** Ubuntu 24.04.3 LTS · 2 GB swap at `/swapfile` · UFW active (allows `22, 80, 443` only)
- **TLS:** Let's Encrypt via certbot (auto-renews via systemd timer; expires 2026-07-27 then rolls)
- **DNS:** managed at Combell. Apex `immoplatform.be` → `178.128.246.222`. `www.` still points to an old Combell IP — fix at Combell if `www.` should work.

### SSH access

The key (`~/.ssh/zymo_jordankeys`) has a passphrase. Load into the agent once per machine, then plain SSH inherits it via `SSH_AUTH_SOCK`:

```bash
ssh-add --apple-use-keychain ~/.ssh/zymo_jordankeys
ssh root@178.128.246.222
```

### Application layout on the server

- **App:** `/opt/immoplatform/app` (cloned from main on GitHub)
- **User:** runs as system user `immo` (no shell login)
- **Env:** `/opt/immoplatform/app/.env.production` (mode 600, owner `immo`)
- **Service:** `systemctl {status|restart|stop} immoplatform` · logs via `journalctl -u immoplatform -f`
- **Listening on:** `127.0.0.1:3000` only (nginx reverse-proxies from `:80`/`:443`)
- **nginx → app headers** (`/etc/nginx/sites-enabled/immoplatform`): `X-Real-IP $remote_addr` and **`X-Forwarded-For $remote_addr`** (NOT `$proxy_add_x_forwarded_for` — that one appends to client-supplied XFF, which would let any client spoof their IP and bypass per-IP rate limits since the app reads the leftmost XFF entry). Single-hop deployment: replacing is correct. If we ever add a fronting proxy (Cloudflare, LB), flip back to `$proxy_add_x_forwarded_for` so the trusted hop's IP gets appended.
- **Storage:** DO Spaces (`immoplatform-real-storage` bucket in AMS3). Bytes survive droplet wipe. See dedicated section below.

### Database

- **PostgreSQL 16** on the same droplet, bound to `127.0.0.1:5432` only · `pg_hba.conf` requires `scram-sha-256` for TCP
- **DB / role:** both named `immo`. Connection string lives at `/root/secrets/database.env` on the server (mode 600). Don't put this anywhere else.

### Storage (DO Spaces)

- **Bucket:** `immoplatform-real-storage` in AMS3 (matches droplet region — free intra-region transfer). CDN enabled but only helps on public-read objects; the app's signed-URL flows go straight to origin.
- **Access key:** granular (Limited Access scope), Read/Write/Delete on this bucket only. Stored at `S3_ACCESS_KEY` + `S3_SECRET_KEY` in `.env.production`.
- **Env vars on droplet:** `STORAGE_PROVIDER=do-spaces`, `S3_BUCKET=immoplatform-real-storage`, `S3_REGION=ams3`, `S3_ENDPOINT=https://ams3.digitaloceanspaces.com` (region-level URL — the SDK prepends the bucket name automatically; do NOT use the bucket-prefixed URL here).
- **Code path:** `src/lib/storage/index.ts` switches on `STORAGE_PROVIDER`; `s3-storage.ts` is the active backend. `local-storage.ts` is the dev / fallback.
- **Object layout:** `avatars/{userId}/{version}.{ext}` · `teams/{teamId}/{logo|signature}/{version}.{ext}` · `assignments/{assignmentId}/{lane}/{fileId}_{originalName}`.
- **CORS (one-time, per bucket):** assignment-file uploads use direct browser → Spaces PUT, which triggers a CORS preflight. The bucket needs a rule allowing `PUT/GET/HEAD` from the app origin or every upload silently fails with `No 'Access-Control-Allow-Origin' header is present`. The granular S3 key on the droplet has data-plane scope only (no `s3:PutBucketCors`), so apply the rule via the **DO panel** (Spaces → bucket → Settings → CORS Configurations → Add). Rule: Origin=`https://immoplatform.be`, Methods=`GET, PUT, HEAD`, Allowed Headers=`*`, MaxAge=`3000`. Downloads, avatars, team logos, team signatures don't need CORS — they're top-level navigations or `<img>` requests. Repeat this on any new bucket (staging, branch deploy, region split).
- **Debugging:** the bucket Files tab in DO panel shows uploads in real time. If an upload appears to succeed in the UI but the bucket stays empty, check `journalctl -u immoplatform | grep -iE "s3|storage"` for the SDK error. If the upload errors out in the **browser console** with a CORS message, the bucket CORS rule above is missing.

### Email (Postmark)

- **Provider:** Postmark, configured 2026-04-28. Server is named `immoplatform` and lives inside the **shared Asbestexperts Postmark account** (same account as Platform/Asbestexperts/Winergy). New servers there = stats and suppressions are isolated, but billing rolls up.
- **Sender:** `Immo <no-reply@immoplatform.be>`. Domain is DKIM + Return-Path verified at Postmark; DNS records sit at Combell (`20260428144600pm._domainkey` TXT and `pm-bounces` CNAME → `pm.mtasv.net`). SPF and `_dmarc` (`p=none`) were already on the zone.
- **Env vars on droplet:** `EMAIL_PROVIDER=postmark`, `POSTMARK_TOKEN=<server-token>`, `EMAIL_FROM="Immo <no-reply@immoplatform.be>"`. Default message stream is `outbound` (transactional) — don't switch to `broadcast` for transactional sends.
- **Code path:** `src/lib/email.tsx` (`sendViaPostmark`); throws on delivery failure, callers decide whether to surface or swallow (`forgotPassword` swallows to avoid email enumeration; `createInvite` propagates).
- **Debugging a failed send:** check Postmark **Activity** tab first; if the request never landed, `journalctl -u immoplatform -n 100 | grep -i postmark` shows the API rejection string verbatim.

### Build constraints (1 GB RAM is tight)

- `next.config.ts` has `typescript.ignoreBuildErrors = true` and `eslint.ignoreDuringBuilds = true` — both `tsc` and `eslint` OOM during build on this droplet. **Always run typecheck + vitest locally before deploying.**
- Build command needs `NODE_OPTIONS="--max-old-space-size=768"` to fit
- Build takes ~5 min on this tier. Resize to 2 GB ($12/mo) for ~2 min builds + zero-downtime deploys.

### Deploy / redeploy command

```bash
ssh root@178.128.246.222
cd /opt/immoplatform/app
sudo -u immo git pull
sudo -u immo bash -c 'set -a; source .env.production; set +a; \
  npx prisma migrate deploy && \
  NODE_OPTIONS=--max-old-space-size=768 npm run build'
systemctl restart immoplatform
```

### Not yet configured (deliberately deferred)

- Google + Outlook OAuth credentials — calendar features no-op without these
- fail2ban — keys-only SSH makes brute-force moot, just adds log noise
- DB backups — no users yet; configure before that changes
- Droplet resize to 2 GB — current 1 GB requires a `systemctl stop immoplatform` before each rebuild (build + running app together OOM); 2 GB enables zero-downtime deploys

### Admin user

Bootstrapped via `/opt/immoplatform/app/scripts/bootstrap-admin.ts` (server-only file, untracked in git). Re-runnable to rotate password / restore role:

```bash
cd /opt/immoplatform/app
sudo -u immo bash -c 'set -a; source .env.production; set +a; \
  npx tsx scripts/bootstrap-admin.ts <email> <password> <firstName> <lastName>'
```

Upserts on email — safe to re-run. Bypasses Zod's 10-char minimum (writes directly via Prisma), so any password value works.

### Secrets to back up to a password manager (lost = unrecoverable)

- `CALENDAR_ENCRYPTION_KEY` from `.env.production` — if lost, every encrypted OAuth token in the DB becomes unreadable
- `DATABASE_URL` (postgres password) from `/root/secrets/database.env` — recoverable via `ALTER ROLE` but annoying
- `POSTMARK_TOKEN` from `.env.production` — recoverable by issuing a new Server token in Postmark and rotating, but worth keeping
- `CRON_SECRET` from `.env.production` — needed once cron jobs are wired

## Commit + push discipline

Never run `git commit` / `git push` / Command Center writes without an explicit user OK in the current turn. The sandbox enforces this with a block; in your own workflow, finish the code, run typecheck + build + seed, report what's staged, and wait for approval before touching origin or the board. See memory file `feedback_git_commit_confirmation.md`.
