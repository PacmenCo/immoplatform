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
- **PostgreSQL** planned for backend (not yet wired)

## Project layout

```
src/
├── app/
│   ├── layout.tsx      # root metadata + fonts
│   ├── page.tsx        # homepage — composes sections only, no logic
│   └── globals.css     # design tokens + resets
└── components/         # one section per file (Nav, Hero, Services, …)
```

Keep page files thin (composition only). Each section lives in its own component file in `src/components/`.

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

- **UI:** https://masterplan.asbestexperts.be/command-center/
- **API base:** `https://masterplan.asbestexperts.be/command-center/api`
- **Login:** `pacmenco@gmail.com` / `baldr123` (staff account — has read/write)
- **Full API reference:** `/Users/rl/.claude/plans/command-center-api-reference.md` — read this before making API calls; covers auth, every endpoint, valid statuses/priorities, ID formats, gotchas.

### Quick token + board fetch

```bash
TOKEN=$(curl -s -X POST https://masterplan.asbestexperts.be/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"pacmenco@gmail.com","password":"baldr123"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['token'])")

curl -s https://masterplan.asbestexperts.be/command-center/api/data \
  -H "Authorization: Bearer $TOKEN"
```

### Workflow conventions

1. New work not on the board → create a todo in **Backlog** under project `immo`.
2. Starting on something → move it to **Planned / In Progress**.
3. Finishing → move it to **Review** (not Done — the human verifies, then moves to Done).
4. If 2+ todos form a theme → create a feature and re-parent them. Current feature for this work: **Homepage v1** (`feat_1776544666395_c93a0d63`).
5. Always set `createdBy` / `updatedBy` / activity `author` to your model name so the human can see who did what.

## Open questions (blockers)

- Final brand name for the merged entity (placeholder: "Immo")
- Real names + scope for the 4 services (placeholders: EPC, Asbestos, Electrical, Fuel Tank)
- Backend: confirm PostgreSQL + Prisma when we start the portal
