import { Card } from "@/components/ui/Card";

type StatTone = "neutral" | "ok" | "warn";

const TONE_DOT: Record<StatTone, string> = {
  neutral: "var(--color-ink-muted)",
  ok: "var(--color-epc)",
  warn: "var(--color-electrical)",
};

export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: TONE_DOT[tone] }} />
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[var(--color-ink)] tabular-nums">
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">{hint}</p>}
    </Card>
  );
}
