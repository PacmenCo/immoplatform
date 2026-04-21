# Commission

How a team earns commission on an assignment, when it fires, where it's viewed, and how payouts are recorded. Ports Platform's `CommissionService.php` with our integer-cents + basis-points conventions.

## Formula

Commission is computed from the pricing engine's `totalCents` (post-discount, post-surcharge):

```
percentage: floor(totalCents × team.commissionValue / 10 000)
fixed:      team.commissionValue
```

Same integer-math + floor conventions as pricing — exact to the cent, customer-favorable.

## Eligibility

All three must hold for a commission line to be written:

1. **Asbestos service on the assignment.** Only assignments that include the `asbestos` service earn commission. Other services (EPC, electrical, fuel) don't.
2. **Property type not excluded.** Configured in `EXCLUDED_PROPERTY_TYPES` in `src/lib/commission.ts`. Today the list is `["studio_room"]` — matches Platform's Studentenkamer exclusion.
3. **Team has a commission configured.** `commissionType` set + `commissionValue > 0` on the `Team`. A team without a commission is silently skipped (nothing to do).

Eligibility is pure-data — no status gate inside the check. The trigger is what ties it to completion.

## Trigger

`markAssignmentCompleted` calls `applyCommission(id)` **after** the in-tx status flip succeeds. Failures in the commission compute are logged via `console.error` but don't roll back completion (same pattern as email notifications).

**Idempotent via `upsert` on unique `assignmentId`.** Re-completing an assignment recomputes with current values — safe to call multiple times. If a line already exists, it's overwritten.

Commission lines **don't fire on `delivered`**, only on `completed`. This matches Platform (Voltooid) and gives the agency a review window between the freelancer's "I'm done" and the actual commission accrual.

## Snapshots

Each `AssignmentCommission` row captures:

- `assignmentTotalCents` — the pricing engine's total at compute time
- `commissionType` — `"percentage"` or `"fixed"` at compute time
- `commissionValue` — the team's rate at compute time (bps or cents)
- `commissionAmountCents` — computed result

A later edit to `Team.commissionValue` does **not** rewrite existing lines. If the agency needs to retroactively adjust, admin re-completes the assignment (triggering the upsert to refresh the snapshot). This matches pricing's snapshot model.

## Quarterly payouts

Commissions are aggregated **at runtime** over calendar quarters — no scheduled job. The `quarterlyTotalsByTeam(year, quarter)` helper groups lines by team where `computedAt` falls in the quarter and joins in the `CommissionPayout` row if one exists.

Admins mark a team's quarter paid via **`markCommissionQuarterPaid({teamId, year, quarter})`**. The action:
- Recomputes the quarter's total from the current `AssignmentCommission` rows
- Upserts a `CommissionPayout` row keyed on `(teamId, year, quarter)` with the snapshot amount + `paidAt` + `paidById`
- Is idempotent per `(team, year, quarter)`

**`undoCommissionQuarterPaid`** deletes the payout row. Next mark-paid call starts fresh.

## Role matrix

| Action | Admin | Staff | Team owner | Team member | Freelancer |
|---|---|---|---|---|---|
| View `/dashboard/commissions` (all teams) | ✓ | ✓ | — | — | — |
| View own team's commission accrual | ✓ | ✓ | ✓ | ✗ | ✗ |
| View commission line on an assignment detail | ✓ | ✓ | ✓ (if team owner) | ✗ | ✗ |
| Mark a quarter paid / undo | ✓ | ✓ | ✗ | ✗ | ✗ |

Freelancers never see commission UI — they're compensated outside the platform (via the agency's payout workflow).

## Persistence

```prisma
model AssignmentCommission {
  assignmentId @unique                 // one line per assignment
  teamId
  assignmentTotalCents                 // snapshot at compute time
  commissionType                       // snapshot
  commissionValue                      // snapshot (bps or cents)
  commissionAmountCents                // computed
  computedAt / updatedAt
}

model CommissionPayout {
  @@unique([teamId, year, quarter])    // one row per team per quarter
  amountCents                          // snapshot at mark-paid time
  paidAt / paidById
}
```

Cascade semantics:
- Delete assignment → commission line cascades.
- Delete team → commission lines + payouts cascade.
- Delete the user who marked a payout → `paidById` becomes null (history preserved).

## UI

- **`/dashboard/commissions`** — admin + staff only. Year/quarter picker, summary cards (accrued / paid / outstanding), per-team table with Mark-paid / Undo buttons, drill-in to per-assignment lines when a team row is clicked.
- **Assignment detail** — small Commission card next to the PricingCard. Shows rate + earned amount. Visible to anyone with `canViewCommission(session, teamId)` — admin/staff + team owners.

## Audit verbs

- `assignment.commission_applied` — fires from `applyCommission` via the completion path, metadata `{ amountCents }`
- `commission.quarter_paid` — fires from `markCommissionQuarterPaid`, metadata `{ year, quarter, amountCents, teamName }`
- `commission.quarter_unpaid` — fires from `undoCommissionQuarterPaid`, metadata `{ year, quarter }`

## Out of scope (tracked separately)

- **Automatic recompute when an assignment's pricing changes mid-flight.** Admin can re-open and re-complete to refresh the snapshot.
- **Manual adjustment ledger** (add/subtract one-off amounts) — defer.
- **Commission email notifications** — no email fires on apply / mark-paid. Add once the email trigger catalog grows.
- **Per-freelancer split** — Platform doesn't have this; commission is paid to the team, not split.
- **Fiscal-year quarters** — we use calendar Q1–Q4 only.
- **Multi-currency** — EUR only.
- **Team-level mark-paid UI on team detail** — today only `/dashboard/commissions` has the button; the team detail page doesn't surface it (roles that see one see the other).
