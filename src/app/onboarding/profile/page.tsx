import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Input";
import { IconCheck, IconArrowRight } from "@/components/ui/Icons";
import { BrandName } from "@/components/BrandName";

const STEPS = [
  { n: 1, label: "Profile", href: "/onboarding/profile" },
  { n: 2, label: "Team", href: "/onboarding/team" },
  { n: 3, label: "Services", href: "/onboarding/services" },
  { n: 4, label: "Invite", href: "/onboarding/invite" },
];

export default function OnboardingProfilePage() {
  const current = 1;
  return (
    <div className="min-h-screen bg-[var(--color-bg-alt)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-16 max-w-[var(--container)] items-center justify-between px-6">
          <Link href="/" className="flex items-center font-semibold">
            <BrandName className="text-lg" />
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
            Step 1 of 4
          </p>
          <h1
            className="mt-2 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", lineHeight: 1.2 }}
          >
            Tell us about you.
          </h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            We use this to personalise your workspace and route requests correctly.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-6">
            <div>
              <p className="text-sm font-medium text-[var(--color-ink)]">Profile photo</p>
              <div className="mt-3 flex items-center gap-6">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-[var(--color-bg-muted)] text-xl font-semibold text-[var(--color-ink-muted)]">
                  JR
                </div>
                <label className="group flex h-20 flex-1 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-4 py-3 text-center text-sm text-[var(--color-ink-muted)] transition-colors hover:border-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
                  <span className="font-medium">Drop photo here or click to upload</span>
                  <span className="mt-1 text-xs">PNG, JPG — max 2 MB</span>
                  <input type="file" accept="image/*" className="sr-only" />
                </label>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="First name" id="first">
                <Input id="first" autoComplete="given-name" placeholder="Jordan" />
              </Field>
              <Field label="Last name" id="last">
                <Input id="last" autoComplete="family-name" placeholder="Remy" />
              </Field>
              <Field label="Phone" id="phone">
                <Input id="phone" type="tel" placeholder="+32 …" />
              </Field>
              <Field label="Region" id="region">
                <Select id="region" defaultValue="flanders">
                  <option value="flanders">Flanders</option>
                  <option value="brussels">Brussels</option>
                  <option value="wallonia">Wallonia</option>
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        <div className="mt-8 flex items-center justify-between">
          <Button href="/onboarding" variant="ghost" size="md">
            Back
          </Button>
          <Button href="/onboarding/team" variant="primary" size="md">
            Continue
            <IconArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
