import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { DiscountType, PricingBreakdown } from "@/lib/pricing";
import { formatEuros } from "@/lib/format";

type Props = {
  breakdown: PricingBreakdown;
  servicesByKey: Record<string, { label: string; short: string; color: string }>;
  discountMeta: {
    type: DiscountType | null;
    value: number | null;
    reason: string | null;
  };
  areaM2: number | null;
};

/** Read-only pricing card shown on the assignment detail page. */
export function PricingCard({ breakdown, servicesByKey, discountMeta, areaM2 }: Props) {
  const surchargePct = breakdown.surchargeBps / 100;
  const hasAdjustments =
    breakdown.surchargeCents > 0 || breakdown.discountCents > 0;
  const discountDisplay =
    discountMeta.type === "percentage" && discountMeta.value
      ? `${(discountMeta.value / 100).toFixed(discountMeta.value % 100 === 0 ? 0 : 1)}%`
      : discountMeta.type === "fixed" && discountMeta.value
        ? formatEuros(discountMeta.value)
        : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing</CardTitle>
        <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
          Prices are snapshotted at creation — later price-list edits won't change this invoice.
        </p>
      </CardHeader>
      <CardBody className="space-y-3 text-sm">
        <ul className="space-y-1.5">
          {breakdown.lines.map((line) => {
            const svc = servicesByKey[line.serviceKey];
            return (
              <li
                key={line.serviceKey}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-[var(--color-ink-soft)]">
                  {svc?.label ?? line.serviceKey}
                </span>
                <span className="font-medium text-[var(--color-ink)] tabular-nums">
                  {formatEuros(line.lineCents)}
                </span>
              </li>
            );
          })}
        </ul>

        {hasAdjustments && (
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
            <span className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
              Subtotal
            </span>
            <span className="font-medium text-[var(--color-ink)] tabular-nums">
              {formatEuros(breakdown.subtotalCents)}
            </span>
          </div>
        )}

        {breakdown.surchargeCents > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[var(--color-ink-soft)]">
              Large-property surcharge
              {areaM2 && (
                <span className="ml-1 text-xs text-[var(--color-ink-muted)]">
                  ({areaM2} m² · +{surchargePct}%)
                </span>
              )}
            </span>
            <span className="font-medium text-[var(--color-ink)] tabular-nums">
              +{formatEuros(breakdown.surchargeCents)}
            </span>
          </div>
        )}

        {breakdown.discountCents > 0 && (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[var(--color-ink-soft)]">
              Discount
              {discountDisplay && (
                <span className="ml-1 text-xs text-[var(--color-ink-muted)]">
                  ({discountDisplay})
                </span>
              )}
              {discountMeta.reason && (
                <span className="ml-1 text-xs italic text-[var(--color-ink-muted)]">
                  — {discountMeta.reason}
                </span>
              )}
            </span>
            <span className="font-medium text-[var(--color-ink)] tabular-nums">
              −{formatEuros(breakdown.discountCents)}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 border-t border-[var(--color-border)] pt-3">
          <span className="text-sm font-semibold text-[var(--color-ink)]">Total</span>
          <span className="text-base font-semibold text-[var(--color-ink)] tabular-nums">
            {formatEuros(breakdown.totalCents)}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}
