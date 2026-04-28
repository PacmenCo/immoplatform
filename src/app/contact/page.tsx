import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { ContactForm } from "@/components/ContactForm";

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

            <ContactForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
