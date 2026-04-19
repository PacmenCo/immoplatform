const brands = [
  { name: "Asbest Experts", color: "var(--color-asbestos)", service: "Asbestos Inventory Attest (AIV)" },
  { name: "EPC Partner", color: "var(--color-epc)", service: "Energy Performance Certificate (EPC)" },
  { name: "Elec Inspect", color: "var(--color-electrical)", service: "Electrical Inspection (EK)" },
  { name: "Tank Check", color: "var(--color-fuel)", service: "Fuel Tank Check (TK)" },
];

export default function Merger() {
  return (
    <section id="about" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              The story
            </p>
            <h2
              className="mt-3 font-semibold tracking-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
            >
              Four specialists. One team.
            </h2>
            <p className="mt-6 text-[var(--color-ink-soft)] text-lg">
              For years, real-estate agents juggled four different inspectors, four
              invoices and four inboxes to close a single sale. We brought the best
              of each discipline together so you don&apos;t have to.
            </p>
            <p className="mt-4 text-[var(--color-ink-soft)] text-lg">
              One login, one point of contact and one delivery timeline — backed by
              the same certified experts you already trusted.
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-[var(--color-border)] pt-8">
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  One invoice
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  All services, one monthly statement.
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  One contact
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  A single account manager per office.
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  One dashboard
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  Track every assignment in real time.
                </dd>
              </div>
            </dl>
          </div>

          <ul className="grid grid-cols-2 gap-5">
            {brands.map((brand) => (
              <li
                key={brand.name}
                className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6"
                style={{ minHeight: 180 }}
              >
                <span
                  className="inline-block h-2 w-10 rounded-full"
                  style={{ backgroundColor: brand.color }}
                />
                <div>
                  <p className="text-lg font-semibold text-[var(--color-ink)]">
                    {brand.name}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {brand.service}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
