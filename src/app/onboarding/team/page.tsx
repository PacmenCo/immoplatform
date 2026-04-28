import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Input";
import { IconCheck, IconArrowRight } from "@/components/ui/Icons";
import { BrandLogo } from "@/components/BrandLogo";

const STEPS = [
  { n: 1, label: "Profile", href: "/onboarding/profile" },
  { n: 2, label: "Team", href: "/onboarding/team" },
  { n: 3, label: "Services", href: "/onboarding/services" },
  { n: 4, label: "Invite", href: "/onboarding/invite" },
];

export default function OnboardingTeamPage() {
  const current = 2;
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
            Step 2 of 4
          </p>
          <h1
            className="mt-2 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", lineHeight: 1.2 }}
          >
            Register your agency.
          </h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            Billing and certificates use these details — they can be updated later.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-6">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Agency logo</p>
              <label className="mt-3 flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-4 py-6 text-center text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                <span className="font-medium">Drop your logo here or click to upload</span>
                <span className="mt-1 text-xs">SVG, PNG — transparent background preferred</span>
                <input type="file" accept="image/*" className="sr-only" />
              </label>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Team name" id="team" hint="Displayed across the platform.">
                <Input id="team" placeholder="Vastgoed Antwerp" />
              </Field>
              <Field label="City" id="city">
                <Input id="city" placeholder="Antwerpen" />
              </Field>
              <Field label="Legal name" id="legal" hint="As registered at the KBO.">
                <Input id="legal" placeholder="Vastgoed Antwerp BV" />
              </Field>
              <Field label="VAT number" id="vat">
                <Input id="vat" placeholder="BE0123 456 789" />
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="mt-8 flex items-center justify-between">
          <Button href="/onboarding/profile" variant="ghost" size="md">
            Back
          </Button>
          <Button href="/onboarding/services" variant="primary" size="md">
            Continue
            <IconArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
