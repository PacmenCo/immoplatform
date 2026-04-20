# Realtor role — capability matrix

Ported from the Laravel Platform's `makelaar` role audit (2026-04). This is the source-of-truth for what realtors (and by implication other roles) can do. When adding new surfaces, check here first.

## Roles

| Role | Who | Scope |
|---|---|---|
| `admin` | Immo platform operators | Everything, all teams, all users |
| `staff` | Immo support team | Everything except inviting admins |
| `realtor` | Agency employees | Only their own teams' data |
| `freelancer` | Inspectors | Only assignments assigned to them + any teams they're members of |

## Realtors CAN

### Assignments
- **Create** assignments attached to a team they OWN (auto-picks the owned team matching `activeTeamId`, else first owned).
- **View** assignments where (a) they created it OR (b) `assignment.teamId` ∈ their memberships.
- **Edit** assignments where they are the creator OR they own the team the assignment belongs to.
- **Delete** own/owned-team assignments only if the status allows it (`status.isDeletable`).
- **Mark delivered** — same as edit rights.
- **Post comments** — anyone who can view.

### Teams
- **See** the teams they belong to (owner or member).
- **View** any team they're a member of — members get the full detail page.
- **Edit** teams they OWN: branding, legal + billing fields, default client type, commission config.
- **Invite members** to teams they OWN. Realtors without an owned team see a "need to own a team first" empty state on the invite page.
- **Transfer ownership** of a team they own to another member with platform role `realtor` or `admin`.
- **Cannot delete teams** — admin-only.

### Users
- **Cannot view the global users list** — redirects to `/no-access?section=users`.
- Can see their own team's members via the team detail page.

### Pricing
- **See assignment prices** only when they are a *member* of the assignment's team (not just creator, not just admin). Freelancers never see prices.

### Platform
- Read announcements, edit own profile + password + theme.
- Cannot create announcements, manage price lists, trigger Odoo sync, see global revenue.
- Cannot apply discounts on assignments (admin/staff only).

## Enforcement locations

All enforcement lives in `src/lib/permissions.ts`:

- `hasRole(session, ...roles)` — role check
- `getUserTeamIds(userId)` — memoised team memberships (owned + all)
- `composeWhere(...clauses)` — AND-compose Prisma `where` fragments without silent collision
- `assignmentScope`, `teamScope`, `userScope` — return filters (or undefined for admin/staff)
- `canViewAssignment`, `canEditAssignment`, `canDeleteAssignment`, `canViewAssignmentPricing`, `canEditTeam`, `canSetDiscount` — policy functions

**Every Prisma list in a dashboard server component must apply the relevant scope.** Omitting it is a data-leak bug. If you write a new list page:

```ts
const scope = await assignmentScope(session);
const rows = await prisma.assignment.findMany({
  where: composeWhere({ status: "delivered" }, scope),
});
```

**Every mutation server action** that touches an assignment or team must call the matching policy **before** writing — not after. Policies check actual ownership against the DB; they're the real gate, not the UI.

## Gates applied (2026-04-20)

| Layer | File | What it enforces |
|---|---|---|
| Dashboard layout | `src/app/dashboard/layout.tsx` | Realtor with zero memberships → `/no-team` |
| Assignments list | `src/app/dashboard/assignments/page.tsx` | `assignmentScope` on `findMany` + `groupBy` |
| Assignment detail | `src/app/dashboard/assignments/[id]/page.tsx` | `canViewAssignment` → `notFound()` |
| Assignment create | `src/app/actions/assignments.ts` | Freelancer rejected; realtor needs an owned team |
| Assignment deliver | `src/app/actions/assignments.ts` | `canEditAssignment` |
| Assignment comment | `src/app/actions/assignments.ts` | `canViewAssignment` |
| Teams list | `src/app/dashboard/teams/page.tsx` | `teamScope` |
| Team detail | `src/app/dashboard/teams/[id]/page.tsx` | Non-member → `notFound()` |
| Users list | `src/app/dashboard/users/page.tsx` | Non-admin/staff → `/no-access?section=users` |
| Invite form | `src/app/dashboard/users/invite/page.tsx` | Realtor sees only owned teams; zero-owned → empty state |
| Transfer ownership | `src/app/actions/teams.ts` | Admin or current owner only; target must be realtor/admin member |
| Sidebar | `src/components/dashboard/Sidebar.tsx` | Users/Commissions/Revenue/Announcements hidden from realtor/freelancer |
| Topbar | `src/components/dashboard/Topbar.tsx` | "New assignment" button hidden from freelancer |

## Known deferrals (tracked in Command Center)

- **Two distinct file upload lanes** (realtor vs freelancer) — separate todo under Files & uploads.
- **Discount field on assignments** — low-priority, admin-only, separate todo.
- **`/register` + `/onboarding/team` self-service team creation** — currently static mocks; realtor without team sees `/no-team` landing page as a safe fallback.
- **Converting `User.role` from `String` to a Prisma enum** — tracked under Foundation (the urgent "Role system" todo).
- **Admin-scoped-to-active-team on Overview** — plan intentionally keeps admins unscoped; revisit if product needs the toggle.
