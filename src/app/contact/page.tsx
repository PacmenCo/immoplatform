import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-fuel)]" />
                Contact
              </span>
              <h1
                className="mt-6 font-semibold tracking-tight text-[var(--color-ink)]"
                style={{ fontSize: "clamp(2.25rem, 5vw, 3.75rem)", lineHeight: 1.05 }}
              >
                Talk to a real human. Usually within the hour.
              </h1>
              <p className="mt-5 max-w-2xl text-[var(--color-ink-soft)]" style={{ fontSize: "clamp(1rem, 1.4vw, 1.15rem)" }}>
                Whether you&apos;re scoping a new agency account, troubleshooting a delivered file, or just curious about
                coverage in your province — we&apos;ll get back the same business day.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-2xl px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">Send us a message</h2>
            <p className="mt-2 text-[var(--color-ink-soft)]">
              We reply within 4 business hours on weekdays.
            </p>

            <form className="mt-8 space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Full name" id="name">
                  <Input id="name" autoComplete="name" placeholder="Jane Mertens" />
                </Field>
                <Field label="Work email" id="email">
                  <Input id="email" type="email" autoComplete="email" placeholder="you@agency.be" />
                </Field>
              </div>
              <Field label="Company" id="company" hint="Optional — helps us route your request faster.">
                <Input id="company" autoComplete="organization" placeholder="Vastgoed Antwerp" />
              </Field>
              <Field label="Message" id="message">
                <Textarea id="message" rows={6} placeholder="Tell us what you're looking for..." />
              </Field>

              <label className="flex items-start gap-2 text-sm text-[var(--color-ink-soft)]">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--color-brand)]" />
                <span>I agree to be contacted about my inquiry per the privacy policy.</span>
              </label>

              <Button type="submit" size="lg" className="w-full sm:w-auto">
                Send message
              </Button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
