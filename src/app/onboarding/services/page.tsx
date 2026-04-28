import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { IconCheck, IconArrowRight } from "@/components/ui/Icons";
import { SERVICES, type ServiceKey } from "@/lib/mockData";
import { BrandLogo } from "@/components/BrandLogo";

const STEPS = [
  { n: 1, label: "Profile", href: "/onboarding/profile" },
  { n: 2, label: "Team", href: "/onboarding/team" },
  { n: 3, label: "Services", href: "/onboarding/services" },
  { n: 4, label: "Invite", href: "/onboarding/invite" },
];

const ORDER: ServiceKey[] = ["epc", "asbestos", "electrical", "fuel"];

const DEFAULT_ON: Record<ServiceKey, boolean> = {
  epc: true,
  asbestos: true,
  electrical: false,
  fuel: false,
};

export default function OnboardingServicesPage() {
  const current = 3;
  return (
    <div className="min-h-screen bg-[var(--color-bg-alt)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-16 max-w-[var(--container)] items-center justify-between px-6">
          <Link href="/" className="inline-flex items-center" aria-label="immoplatform.be — home">
            <BrandLogo className="h-10 w-auto" />
          </Link>
          <Link href="/onboarding" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            Back to overview
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <ol className="mb-10 flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const done = s.n < current;
            const active = s.n === current;
            return (
              <li key={s.n} className="flex flex-1 items-center gap-2">
                <div
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-[var(--color-brand)] text-white"
                      : done
                        ? "bg-[var(--color-epc)] text-white"
                        : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : s.n}
                </div>
                <span className={`hidden text-xs font-medium sm:inline ${active ? "text-[var(--color-ink)]" : "text-[var(--color-ink-muted)]"}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="h-px flex-1 bg-[var(--color-border)]" />
                )}
              </li>
            );
          })}
        </ol>

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Step 3 of 4
          </p>
          <h1
            className="mt-2 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", lineHeight: 1.2 }}
          >
            Which services do you order?
          </h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            Pick one or all — you can always enable more later.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {ORDER.map((key) => {
            const svc = SERVICES[key];
            const on = DEFAULT_ON[key];
            return (
              <label
                key={key}
                htmlFor={`svc-${key}`}
                className="relative flex cursor-pointer flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-5 transition-colors hover:border-[var(--color-border-strong)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
                    style={{
                      color: svc.color,
                      backgroundColor: `color-mix(in srgb, ${svc.color} 14%, white)`,
                      border: `1px solid color-mix(in srgb, ${svc.color} 30%, white)`,
                    }}
                  >
                    {svc.short}
                  </span>
                  <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-[var(--color-bg-muted)] transition-colors has-[:checked]:bg-[var(--color-brand)]">
                    <input
                      id={`svc-${key}`}
                      type="checkbox"
                      defaultChecked={on}
                      className="peer sr-only"
                    />
                    <span className="pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                  </div>
                </div>
                <div>
                  <p className="text-base font-semibold text-[var(--color-ink)]">{svc.label}</p>
                  <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{svc.description}</p>
                </div>
                <span
                  aria-hidden
                  className="mt-auto h-1 w-10 rounded-full"
                  style={{ backgroundColor: svc.color }}
                />
              </label>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button href="/onboarding/team" variant="ghost" size="md">
            Back
          </Button>
          <Button href="/onboarding/invite" variant="primary" size="md">
            Continue
            <IconArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
