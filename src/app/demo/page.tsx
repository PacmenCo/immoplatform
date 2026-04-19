import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { IconCheck } from "@/components/ui/Icons";

const benefits = [
  {
    title: "See your actual workflow, not a canned deck",
    body: "Bring a real address. We&rsquo;ll walk it through the platform end-to-end: order, schedule, deliver, invoice.",
  },
  {
    title: "Meet your future account manager",
    body: "Every demo is led by the person who would actually be assigned to your agency.",
  },
  {
    title: "Get a migration plan",
    body: "If you&rsquo;re switching from another tool or spreadsheet, you leave with a concrete step-by-step.",
  },
  {
    title: "No slides, no sales pitch",
    body: "Twenty minutes, screen-share, questions throughout. We stop when you&rsquo;ve seen enough.",
  },
];

export default function DemoPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto grid max-w-[var(--container)] gap-12 px-6 py-20 lg:grid-cols-2 lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-electrical)]" />
                20-minute walkthrough
              </span>
              <h1
                className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
                style={{ fontSize: "clamp(2.25rem, 4.5vw, 3.5rem)", lineHeight: 1.05 }}
              >
                Book a live demo.
              </h1>
              <p className="mt-5 text-[var(--color-ink-soft)]" style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
                Tell us about your agency and we&apos;ll find a 20-minute slot that works. Screen-share, real data, no slides.
              </p>

              <form className="mt-10 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Full name" id="name">
                    <Input id="name" autoComplete="name" placeholder="Jane Mertens" />
                  </Field>
                  <Field label="Work email" id="email">
                    <Input id="email" type="email" autoComplete="email" placeholder="you@agency.be" />
                  </Field>
                </div>
                <Field label="Agency name" id="agency">
                  <Input id="agency" autoComplete="organization" placeholder="Vastgoed Antwerp" />
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Agency size" id="size">
                    <Select id="size" defaultValue="2-5">
                      <option value="solo">Just me</option>
                      <option value="2-5">2 – 5 agents</option>
                      <option value="6-15">6 – 15 agents</option>
                      <option value="16-50">16 – 50 agents</option>
                      <option value="50+">50+ agents</option>
                    </Select>
                  </Field>
                  <Field label="Preferred time" id="time">
                    <Select id="time" defaultValue="morning">
                      <option value="morning">Weekday morning</option>
                      <option value="afternoon">Weekday afternoon</option>
                      <option value="evening">Early evening</option>
                      <option value="flexible">I&apos;m flexible</option>
                    </Select>
                  </Field>
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  Request demo
                </Button>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  We&apos;ll email 3 proposed time slots within 2 business hours.
                </p>
              </form>
            </div>

            <div className="space-y-8 lg:pl-6">
              <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-white p-8">
                <h2 className="text-lg font-semibold text-[var(--color-ink)]">What you&apos;ll get out of it</h2>
                <ul className="mt-6 space-y-5">
                  {benefits.map((b) => (
                    <li key={b.title} className="flex items-start gap-4">
                      <span className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-[var(--color-epc)]/15 text-[var(--color-epc)]">
                        <IconCheck size={14} />
                      </span>
                      <div>
                        <p className="font-medium text-[var(--color-ink)]">{b.title}</p>
                        <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{b.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className="rounded-[var(--radius-xl)] bg-[var(--color-ink)] p-8 text-white">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="opacity-30">
                  <path d="M7 7h4v4H7c0 3.3 2.7 6 6 6v2c-4.4 0-8-3.6-8-8V7zm10 0h4v4h-4c0 3.3 2.7 6 6 6v2c-4.4 0-8-3.6-8-8V7z" />
                </svg>
                <blockquote className="mt-6 text-xl font-medium leading-snug">
                  The demo sold it. Twenty minutes in, I could see exactly how it replaces the four tabs we had open.
                  We switched that week.
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <Avatar initials="EV" size="md" color="#10b981" />
                  <div>
                    <p className="text-sm font-medium">Els Vermeulen</p>
                    <p className="text-xs opacity-70">Managing partner · Vastgoed Antwerp</p>
                  </div>
                </figcaption>
              </figure>

              <p className="text-sm text-[var(--color-ink-muted)]">
                Not ready for a demo?{" "}
                <Link href="/pricing" className="font-medium text-[var(--color-ink)] hover:underline">
                  Browse pricing
                </Link>{" "}
                or{" "}
                <Link href="/register" className="font-medium text-[var(--color-ink)] hover:underline">
                  jump straight in
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
