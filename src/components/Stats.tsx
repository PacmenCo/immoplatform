const stats = [
  { value: "12,000+", label: "Inspections delivered" },
  { value: "400+", label: "Agencies onboarded" },
  { value: "3", label: "Regions covered" },
  { value: "< 5 days", label: "Average turnaround" },
];

export default function Stats() {
  return (
    <section className="border-b border-[var(--color-border)] bg-[var(--color-brand)] text-white">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <dl className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-sm uppercase tracking-wider text-white/60">
                {stat.label}
              </dt>
              <dd
                className="mt-2 font-semibold tracking-tight"
                style={{ fontSize: "clamp(1.875rem, 3vw, 2.5rem)" }}
              >
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
