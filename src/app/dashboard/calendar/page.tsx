import { Topbar } from "@/components/dashboard/Topbar";
import { Card } from "@/components/ui/Card";
import { ServicePill } from "@/components/ui/Badge";
import { ASSIGNMENTS, SERVICES } from "@/lib/mockData";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthGrid(year: number, monthIdx: number) {
  const first = new Date(year, monthIdx, 1);
  const last = new Date(year, monthIdx + 1, 0);
  const leading = (first.getDay() + 6) % 7; // Mon=0
  const days: { date: Date | null; inMonth: boolean }[] = [];
  for (let i = 0; i < leading; i++) days.push({ date: null, inMonth: false });
  for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(year, monthIdx, d), inMonth: true });
  while (days.length % 7 !== 0) days.push({ date: null, inMonth: false });
  return days;
}

export default function CalendarPage() {
  const today = new Date(2026, 3, 18);
  const days = monthGrid(2026, 3); // April 2026

  const eventsByDate: Record<string, typeof ASSIGNMENTS> = {};
  for (const a of ASSIGNMENTS) {
    eventsByDate[a.preferredDate] = [...(eventsByDate[a.preferredDate] ?? []), a];
  }

  return (
    <>
      <Topbar title="Calendar" subtitle="April 2026" />

      <div className="p-8 max-w-[1400px]">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button className="h-9 w-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]">
              ‹
            </button>
            <h2 className="mx-4 text-lg font-semibold">April 2026</h2>
            <button className="h-9 w-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] text-[var(--color-ink-soft)]">
              ›
            </button>
          </div>
          <div className="flex gap-2">
            <button className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)]">
              Week
            </button>
            <button className="rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg)] px-3 py-1.5 text-sm font-medium">
              Month
            </button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
                {wd}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const iso = d.date
                ? `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}-${String(d.date.getDate()).padStart(2, "0")}`
                : "";
              const events = eventsByDate[iso] ?? [];
              const isToday = d.date && d.date.toDateString() === today.toDateString();
              return (
                <div
                  key={i}
                  className="min-h-[110px] border-b border-r border-[var(--color-border)] p-2"
                  style={{ backgroundColor: d.inMonth ? "white" : "var(--color-bg-alt)" }}
                >
                  {d.date && (
                    <div
                      className={
                        isToday
                          ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand)] text-xs font-semibold text-white"
                          : "text-xs font-semibold text-[var(--color-ink-muted)]"
                      }
                    >
                      {d.date.getDate()}
                    </div>
                  )}
                  <div className="mt-1 space-y-1">
                    {events.map((e) => {
                      const svc = SERVICES[e.services[0]];
                      return (
                        <div
                          key={e.id}
                          className="truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{
                            color: svc.color,
                            backgroundColor: `color-mix(in srgb, ${svc.color} 12%, var(--color-bg))`,
                          }}
                          title={`${e.reference} — ${e.address}`}
                        >
                          {e.address}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
