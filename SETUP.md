# Immoplatform — local setup guide

Goal: clone the repo on a fresh machine and serve the marketing homepage at `http://localhost:3000` (which redirects to `/en` or `/nl-BE`).

This is the **minimum** path to a running homepage. Email, OAuth, Odoo, S3, Postmark, and the dashboard's deeper features are all opt-in and not required for the homepage to render.

---

## 0. Prerequisites

Install on the target machine:

- **Node.js 20+** (Next.js 16 + React 19). `node -v` to verify. If missing, install via `nvm install 20` or [nodejs.org](https://nodejs.org).
- **Git**.
- **Docker Desktop** (recommended — gives you Postgres in one command). Alternative: `brew install postgresql@16` on macOS.

That's it. No global npm packages needed.

---

## 1. Clone

```bash
git clone https://github.com/PacmenCo/immoplatform.git
cd immoplatform
```

The repo is private — you'll need GitHub access to `PacmenCo/immoplatform`. If `git clone` fails with auth errors, set up an SSH key or use a personal access token.

---

## 2. Install dependencies

```bash
npm install
```

This auto-runs `prisma generate` (via the `postinstall` script). Expect ~1–3 min on a cold cache.

---

## 3. Start Postgres

Two options — pick one.

### Option A — Docker (recommended)

```bash
docker compose up -d
```

This starts Postgres 16 on `localhost:5432` with user `immo` / password `immo`, and creates two databases: `immo_dev` and `immo_test`. Data persists in a Docker volume; `docker compose down -v` wipes it.

### Option B — Native Postgres on macOS

```bash
brew install postgresql@16
brew services start postgresql@16
createdb immo_dev
createdb immo_test
```

You'll be the owner of the DB by default; the `DATABASE_URL` then uses your macOS username (no password).

---

## 4. Create `.env`

Copy the template and edit:

```bash
cp .env.example .env
```

Open `.env` and set, at minimum:

```bash
# If you used Docker (Option A above):
DATABASE_URL="postgresql://immo:immo@localhost:5432/immo_dev?schema=public"

# If you used native Postgres (Option B), replace USER with your macOS username:
# DATABASE_URL="postgresql://USER@localhost:5432/immo_dev?schema=public"

SESSION_SECRET="any-random-string-at-least-32-bytes-long-here"
APP_URL="http://localhost:3000"

STORAGE_PROVIDER="local"
STORAGE_LOCAL_ROOT="./storage"
STORAGE_SIGNING_SECRET="another-random-32-byte-string-for-dev-ok"

EMAIL_PROVIDER="dev"
```

Everything else in `.env.example` (Resend, Postmark, Google, Outlook, Odoo, cron) is **optional** — leave commented out for the homepage. Without those:
- Emails log to the server console instead of sending.
- Calendar sync no-ops.
- Odoo price-list fetches will throw if you click into the dashboard pricing page — irrelevant for the marketing homepage.

Generate strong secrets if you want:

```bash
openssl rand -base64 32
```

---

## 5. Apply database migrations

```bash
npx prisma migrate deploy
```

This creates all tables. Should take a few seconds.

### Optional — seed demo data

Only needed if you want to log into the dashboard. Skip for homepage-only.

```bash
npx prisma db seed
```

Idempotent — safe to re-run. Creates demo users (all with password `Jordan1234`), teams, assignments. See `prisma/seed.ts` for emails.

---

## 6. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000** — middleware will redirect to `/en` or `/nl-BE` based on your browser's `Accept-Language`. To force one:

- `http://localhost:3000/en`
- `http://localhost:3000/nl-BE`

The homepage source lives at `src/app/[locale]/page.tsx`.

---

## 7. Verify

You should see:
1. The marketing homepage with hero, service cards (EPC / Asbestos / Electrical / Fuel Tank), and a Nav with locale switcher.
2. Switching language via the nav dropdown swaps `/en` ↔ `/nl-BE` and preserves the path.
3. No console errors in `npm run dev` output (warnings about Turbopack are fine).

---

## Troubleshooting

**`Error: P1001: Can't reach database server`** — Postgres isn't running, or `DATABASE_URL` host/port/credentials are wrong. `docker compose ps` should show `postgres` healthy; `psql "$DATABASE_URL"` should connect.

**`MISSING_MESSAGE` errors in console** — translations are out of sync. Run `npm run i18n:check` to see what drifted; usually a fresh clone is fine because generated files (`src/i18n/_generated/namespaces.ts`, `src/types/messages.d.ts`) are committed.

**Port 3000 already in use** — `lsof -ti :3000 | xargs kill` or run `npm run dev -- -p 3001`.

**Prisma client out of date after pulling new schema changes** — `npx prisma generate` then restart dev server.

**`npm install` is slow or fails** — delete `node_modules` and `package-lock.json`, retry. If a native dep (`bcryptjs`) fails, ensure Xcode CLT is installed on macOS: `xcode-select --install`.

---

## What's NOT covered here

This guide gets the homepage running. The full project also has:

- **Dashboard / CRM** (`src/app/[locale]/dashboard/`) — needs seed data + a logged-in session.
- **Email sending** — set `EMAIL_PROVIDER=resend` or `postmark` and add the relevant API key.
- **Calendar sync** (Google / Outlook) — needs OAuth client IDs + `CALENDAR_ENCRYPTION_KEY`.
- **Odoo price list** — needs `ODOO_*` creds (visible in this repo's `.env` on the source machine if you want to copy them; otherwise generate a per-user API key in Odoo).
- **File uploads to S3** — flip `STORAGE_PROVIDER=s3` and add `S3_*` vars. Local dev uses on-disk `./storage/`.
- **Production deploy** — see `CLAUDE.md` "Production deployment" section.

For any of those, read the relevant section in `CLAUDE.md` (project root) — it documents env vars, code paths, and gotchas for each.
