import { getTranslations } from "next-intl/server";

const BRAND_COLORS = {
  asbestos: "var(--color-asbestos)",
  epc: "var(--color-epc)",
  electrical: "var(--color-electrical)",
  fuel: "var(--color-fuel)",
} as const;

const BRAND_KEYS = ["asbestos", "epc", "electrical", "fuel"] as const;

export default async function Merger() {
  const t = await getTranslations("home.merger");

  return (
    <section id="about" className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
              {t("eyebrow")}
            </p>
            <h2
              className="mt-3 font-semibold tracking-tight"
              style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
            >
              {t("heading")}
            </h2>
            <p className="mt-6 text-[var(--color-ink-soft)] text-lg">
              {t("lead1")}
            </p>
            <p className="mt-4 text-[var(--color-ink-soft)] text-lg">
              {t("lead2")}
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-[var(--color-border)] pt-8">
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {t("stats.oneInvoice.label")}
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  {t("stats.oneInvoice.body")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {t("stats.oneContact.label")}
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  {t("stats.oneContact.body")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-[var(--color-ink-muted)]">
                  {t("stats.oneDashboard.label")}
                </dt>
                <dd className="mt-2 text-sm text-[var(--color-ink-soft)]">
                  {t("stats.oneDashboard.body")}
                </dd>
              </div>
            </dl>
          </div>

          <ul className="grid grid-cols-2 gap-5">
            {BRAND_KEYS.map((key) => (
              <li
                key={key}
                className="flex flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6"
                style={{ minHeight: 180 }}
              >
                <span
                  className="inline-block h-2 w-10 rounded-full"
                  style={{ backgroundColor: BRAND_COLORS[key] }}
                />
                <div>
                  <p className="text-lg font-semibold text-[var(--color-ink)]">
                    {t(`brands.${key}.name`)}
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                    {t(`brands.${key}.service`)}
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
