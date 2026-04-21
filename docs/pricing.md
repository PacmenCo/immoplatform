# Pricing engine

How an assignment's invoice total is calculated, where values come from, and who can change what. Ported from Platform's `AssignmentPricingService.php` with one behavior change (integer math vs floats — see Rounding below).

## Formula

```
subtotal    = Σ(unitPriceCents × quantity) per service line
surcharge   = subtotal × ceil((areaM² − 300) / 100) × 20%   when areaM² > 300
preDiscount = subtotal + surcharge
discount    = percentage  → floor(preDiscount × bps / 10000)
              fixed       → min(discountValue, preDiscount)
total       = max(0, preDiscount − discount)
```

Applied in that order — surcharge is computed on the subtotal, then discount on the subtotal + surcharge. Matches Platform.

## Price sources + snapshots

- **Base price** comes from `Service.unitPrice` (cents per service in the catalog).
- **Team override**: `TeamServiceOverride(teamId, serviceKey, priceCents)` replaces the base price when the assignment's team has one set. Not a delta — the full charged amount.
- **Snapshot at creation**: when an assignment is created, `effectiveUnitPriceCents(teamId, key)` resolves override → base and writes the result to `AssignmentService.unitPriceCents`. Subsequent price-list edits **don't affect in-flight invoices**. Matches Platform.
- **Mid-assignment edits**: when an assignment is updated, services already present keep their existing snapshot. A newly-added service takes a fresh snapshot at the current override/base.

All math is in **integer cents / basis points**. Percentage values are in basis points (1500 = 15 %) to match our `Team.commissionValue` convention.

## Surcharge

- **Threshold**: > 300 m². Auto-applied when `Assignment.areaM2` exceeds it; there's no per-assignment "disable surcharge" flag today (edit `areaM2` if you need to override).
- **Step**: `ceil(excess / 100)` 100-m² blocks. 301–400 m² = 1 block, 401–500 m² = 2 blocks, etc.
- **Multiplier**: 20 % per block.
- **Constants**: exposed as `SURCHARGE_THRESHOLD_M2` and `SURCHARGE_PER_BLOCK_BPS` from `src/lib/pricing.ts` — change once to adjust platform-wide.

## Discount

- **Type**: `"percentage"` (stored as basis points) or `"fixed"` (stored as cents).
- **Value**: integer. A 15 % discount is `discountValue = 1500` with `discountType = "percentage"`. A €25 flat discount is `discountValue = 2500` with `discountType = "fixed"`.
- **Clamp**: can never drive the total below zero.
- **Who**: admin/staff only (`canSetDiscount`). Realtors and freelancers cannot set a discount.
- **Visible on**: the Edit Assignment form's "Discount (admin)" section, behind the policy. The pricing card on the assignment detail page shows the resulting amount to anyone with `canViewAssignmentPricing`.

## Pricing visibility

- `canViewAssignmentPricing(s, a)`:
  - **Admin / staff**: always.
  - **Realtor**: on assignments they created or on teams they're a member of.
  - **Freelancer**: **never** — their compensation is the commission payout, not the invoice amount.

## UI surfaces

- `/dashboard/assignments/[id]` — `PricingCard` renders subtotal, optional surcharge, optional discount, total. Shows the discount reason when present.
- `/dashboard/assignments/[id]/edit` — the admin/staff discount editor lives in a collapsible section below scheduling.
- `/dashboard/teams/[id]/edit` — the "Services & pricing" card lists every active service with a per-team override input.

## Rounding

Platform uses PHP floats with implicit IEEE 754 behavior; we use integer cents + `Math.floor` at the edges:

- Line-level `unitPriceCents × quantity` — integer multiplication, no loss.
- Surcharge — `floor(subtotalCents × surchargeBps / 10 000)`.
- Percentage discount — `floor(preDiscountCents × bps / 10 000)`.
- Fixed discount — stored exactly.

Rounding goes in the customer's favor (we floor rather than round). Totals are exact to the cent; no "€0.01 off" drift across large invoices.

## What's not here (deferred)

- **Per-line quantity > 1** — the column exists on `AssignmentService` (`unitPriceCents`) but there's no quantity field yet. Platform has one (default 1); we haven't needed it for any Belgian use case. Add when requested.
- **"Disable surcharge" flag on an assignment** — Platform has `is_large_property` boolean; we tie the surcharge to `areaM2` directly. Edit `areaM2` as a workaround if you need to suppress.
- **Currency other than EUR** — hardcoded format via `formatEuros()`.
- **Audit log of discount changes** — `assignment.updated` audit verb fires but doesn't carry old/new discount metadata. Add to metadata if compliance demands a history.
