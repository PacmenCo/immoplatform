import { getTranslations } from "next-intl/server";

export default async function HowItWorks() {
  const t = await getTranslations("home.howItWorks");
  const steps = [
    { key: "register", n: t("steps.register.n"), title: t("steps.register.title"), body: t("steps.register.body") },
    { key: "create", n: t("steps.create.n"), title: t("steps.create.title"), body: t("steps.create.body") },
    { key: "pick", n: t("steps.pick.n"), title: t("steps.pick.title"), body: t("steps.pick.body") },
  ];

  return (
    <section id="how-it-works" className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            {t("eyebrow")}
          </p>
          <h2
            className="mt-3 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
          >
            {t("heading")}
          </h2>
        </div>

        <ol className="mt-16 grid gap-8 md:grid-cols-3">
          {steps.map((step, i) => (
            <li
              key={step.key}
              className="relative rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] p-8"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-5xl font-bold tracking-tight text-[var(--color-accent)]">
                  {step.n}
                </span>
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="hidden md:block absolute right-0 top-12 translate-x-1/2 text-[var(--color-ink-muted)]"
                  >
                    →
                  </span>
                )}
              </div>
              <h3 className="mt-6 text-xl font-semibold text-[var(--color-ink)]">
                {step.title}
              </h3>
              <p className="mt-3 text-[var(--color-ink-soft)]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
