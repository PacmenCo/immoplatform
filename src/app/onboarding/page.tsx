import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { IconArrowRight, IconCheck, IconUsers, IconBuilding, IconSettings, IconMail } from "@/components/ui/Icons";

const steps = [
  {
    n: 1,
    href: "/onboarding/profile",
    title: "Profile",
    body: "Tell us who you are and set your region.",
    icon: IconSettings,
    preview: "Name, phone, avatar & region",
  },
  {
    n: 2,
    href: "/onboarding/team",
    title: "Team",
    body: "Register your agency — branding and billing details.",
    icon: IconBuilding,
    preview: "Company name, VAT & logo",
  },
  {
    n: 3,
    href: "/onboarding/services",
    title: "Services",
    body: "Pick the certificates your agency orders.",
    icon: IconCheck,
    preview: "EPC, AIV, EK, TK",
  },
  {
    n: 4,
    href: "/onboarding/invite",
    title: "Invite colleagues",
    body: "Bring your team into the workspace.",
    icon: IconUsers,
    preview: "Up to 10 seats included",
  },
];

export default function OnboardingHubPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-alt)]">
      <header className="border-b border-[var(--color-border)] bg-white">
        <div className="mx-auto flex h-16 max-w-[var(--container)] items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-brand)] text-white text-sm font-bold">
              I
            </span>
            <span className="text-lg">Immo</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]">
            Skip for now
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[var(--container)] px-6 py-16">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
            Welcome to Immo
          </p>
          <h1
            className="mt-3 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.875rem, 3.5vw, 2.75rem)", lineHeight: 1.1 }}
          >
            Let&apos;s set up your agency in 4 quick steps.
          </h1>
          <p className="mt-4 text-lg text-[var(--color-ink-soft)]">
            You can always revisit these later from settings. Takes around 3 minutes.
          </p>
        </div>

        <div className="mt-10">
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <div key={step.n} className="flex flex-1 items-center gap-2">
                <span
                  className={
                    "grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold " +
                    (i === 0
                      ? "bg-[var(--color-brand)] text-white"
                      : "bg-[var(--color-bg-muted)] text-[var(--color-ink-muted)]")
                  }
                >
                  {step.n}
                </span>
                {i < steps.length - 1 && (
                  <span className="h-0.5 flex-1 rounded-full bg-[var(--color-bg-muted)]" />
                )}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-[var(--color-ink-muted)]">
            Start anywhere — we&apos;ll pick up where you left off.
          </p>
        </div>

        <ol className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n}>
              <Card className="flex h-full flex-col">
                <CardBody className="flex flex-1 flex-col">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg-muted)] text-xs font-semibold text-[var(--color-ink-soft)]">
                      {step.n}
                    </span>
                    <step.icon size={18} className="text-[var(--color-ink-muted)]" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[var(--color-ink)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-[var(--color-ink-soft)]">{step.body}</p>
                  <div className="mt-5 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg-alt)] px-3 py-2 text-xs text-[var(--color-ink-soft)]">
                    {step.preview}
                  </div>
                  <div className="mt-6 flex-1" />
                  <Button href={step.href} variant="secondary" size="sm" className="mt-2 w-full">
                    Continue
                    <IconArrowRight size={14} />
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium text-[var(--color-ink)]">Already have everything ready?</p>
            <p className="text-sm text-[var(--color-ink-soft)]">
              Jump straight to the dashboard and configure later.
            </p>
          </div>
          <Button href="/dashboard" variant="primary" size="md">
            Go to dashboard
            <IconArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
