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
- **Prisma 6** — dev runs on **SQLite** (`prisma/dev.db`); PostgreSQL for production (swap via `DATABASE_URL`). Migrations in `prisma/migrations/`. Re-run `npx prisma db seed` after schema changes.

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

## Command Center

Kanban board used to track work across projects. This project lives under the `immo` project id.

- **UI:** https://masterplan.templus.be/command-center/
- **API base:** `https://masterplan.templus.be/command-center/api`
- **Login:** `pacmenco@gmail.com` / `baldr123` (staff account — has read/write)
- **Full API reference:** `/Users/rl/.claude/plans/command-center-api-reference.md` — read this before making API calls; covers auth, every endpoint, valid statuses/priorities, ID formats, gotchas.

### Quick token + board fetch

```bash
TOKEN=$(curl -s -X POST https://masterplan.templus.be/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"pacmenco@gmail.com","password":"baldr123"}' \
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
- **Debugging:** the bucket Files tab in DO panel shows uploads in real time. If an upload appears to succeed in the UI but the bucket stays empty, check `journalctl -u immoplatform | grep -iE "s3|storage"` for the SDK error.

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

## Open questions (blockers)

- Final brand name for the merged entity (placeholder: "Immo").
- Real names + scope for the 4 services (placeholders: EPC, Asbestos, Electrical, Fuel Tank).
