import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { IconCheck, IconArrowRight, IconPlus, IconMail } from "@/components/ui/Icons";


const STEPS = [
  { n: 1, label: "Profile", href: "/onboarding/profile" },
  { n: 2, label: "Team", href: "/onboarding/team" },
  { n: 3, label: "Services", href: "/onboarding/services" },
  { n: 4, label: "Invite", href: "/onboarding/invite" },
];

export default function OnboardingInvitePage() {
  const current = 4;
  const rows = [0, 1, 2];
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
            Step 4 of 4
          </p>
          <h1
            className="mt-2 font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", lineHeight: 1.2 }}
          >
            Invite your colleagues.
          </h1>
          <p className="mt-2 text-[var(--color-ink-soft)]">
            We&apos;ll send them an email with a link to join. You can skip this and invite later.
          </p>
        </div>

        <Card>
          <CardBody className="space-y-3">
            <div className="hidden grid-cols-[1fr_180px_auto] gap-3 text-xs font-medium uppercase tracking-wider text-[var(--color-ink-muted)] sm:grid">
              <span>Email address</span>
              <span>Role</span>
              <span className="w-8" />
            </div>
            {rows.map((i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_180px_auto]">
                <div className="relative">
                  <IconMail
                    size={16}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]"
                  />
                  <Input
                    id={`invite-email-${i}`}
                    type="email"
                    placeholder="colleague@agency.be"
                    className="pl-9"
                  />
                </div>
                <Select id={`invite-role-${i}`} defaultValue="realtor">
                  <option value="admin">Admin</option>
                  <option value="realtor">Realtor</option>
                  <option value="staff">Staff</option>
                </Select>
                <button
                  type="button"
                  aria-label="Remove row"
                  className="grid h-10 w-10 place-items-center rounded-md text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
                >
                  ×
                </button>
              </div>
            ))}

            <button
              type="button"
              className="mt-1 inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-ink)]"
            >
              <IconPlus size={14} />
              Add another
            </button>
          </CardBody>
        </Card>

        <div className="mt-8 flex items-center justify-between">
          <Button href="/onboarding/services" variant="ghost" size="md">
            Back
          </Button>
          <div className="flex items-center gap-3">
            <Button href="/dashboard" variant="secondary" size="md">
              Skip for now
            </Button>
            <Button href="/dashboard" variant="primary" size="md">
              Finish setup
              <IconArrowRight size={16} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
