import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { IconMail, IconMapPin, IconPhone } from "@/components/ui/Icons";

const offices = [
  {
    city: "Antwerp",
    address: "Meir 34, 2000 Antwerpen",
    role: "Headquarters — asbestos & operations",
    phone: "+32 3 123 45 67",
    email: "antwerp@immo.be",
  },
  {
    city: "Brussels",
    address: "Rue Royale 120, 1000 Brussels",
    role: "Electrical inspections (FR/NL)",
    phone: "+32 2 234 56 78",
    email: "brussels@immo.be",
  },
  {
    city: "Ghent",
    address: "Kouter 7, 9000 Gent",
    role: "EPC & energy advisory",
    phone: "+32 9 345 67 89",
    email: "ghent@immo.be",
  },
  {
    city: "Liège",
    address: "Rue Léopold 42, 4000 Liège",
    role: "Fuel-tank & Wallonia region",
    phone: "+32 4 456 78 90",
    email: "liege@immo.be",
  },
];

const hours = [
  { day: "Monday – Friday", time: "08:00 – 18:00" },
  { day: "Saturday", time: "09:00 – 13:00" },
  { day: "Sunday", time: "Closed" },
  { day: "Emergency line", time: "24 / 7" },
];

export default function ContactPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-20 md:py-28">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-medium text-[var(--color-ink-soft)]">
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
          <div className="mx-auto grid max-w-[var(--container)] gap-12 px-6 lg:grid-cols-[1.1fr_1fr]">
            <div>
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
                  <Textarea id="message" rows={6} placeholder="Tell us what you&rsquo;re looking for..." />
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

            <div className="space-y-6">
              <Card>
                <CardBody>
                  <h3 className="text-base font-semibold text-[var(--color-ink)]">Operating hours</h3>
                  <ul className="mt-4 divide-y divide-[var(--color-border)]">
                    {hours.map((h) => (
                      <li key={h.day} className="flex items-center justify-between py-3 text-sm">
                        <span className="text-[var(--color-ink-soft)]">{h.day}</span>
                        <span className="font-medium text-[var(--color-ink)]">{h.time}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card>
                <CardBody>
                  <h3 className="text-base font-semibold text-[var(--color-ink)]">Direct lines</h3>
                  <ul className="mt-4 space-y-3 text-sm">
                    <li className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink)]">
                        <IconMail size={16} />
                      </span>
                      <a href="mailto:hello@immo.be" className="hover:text-[var(--color-ink)]">
                        hello@immo.be
                      </a>
                    </li>
                    <li className="flex items-center gap-3 text-[var(--color-ink-soft)]">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink)]">
                        <IconPhone size={16} />
                      </span>
                      <a href="tel:+3231234567" className="hover:text-[var(--color-ink)]">
                        +32 3 123 45 67
                      </a>
                    </li>
                  </ul>
                </CardBody>
              </Card>
            </div>
          </div>
        </section>

        <section className="border-t border-[var(--color-border)] bg-[var(--color-bg-alt)] py-20">
          <div className="mx-auto max-w-[var(--container)] px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Our offices</h2>
              <p className="mt-3 text-[var(--color-ink-soft)]">
                Four regional hubs covering every Belgian province.
              </p>
            </div>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {offices.map((o) => (
                <Card key={o.city}>
                  <CardBody>
                    <div className="flex items-start gap-4">
                      <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--color-bg-muted)] text-[var(--color-ink)]">
                        <IconMapPin size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-lg font-semibold text-[var(--color-ink)]">{o.city}</h3>
                        <p className="text-xs text-[var(--color-ink-muted)]">{o.role}</p>
                        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">{o.address}</p>
                        <div className="mt-4 flex flex-wrap gap-4 text-sm">
                          <a href={`tel:${o.phone.replace(/\s/g, "")}`} className="text-[var(--color-ink)] hover:underline">
                            {o.phone}
                          </a>
                          <a href={`mailto:${o.email}`} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
                            {o.email}
                          </a>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
