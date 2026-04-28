import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { TAP_TARGET_LINK } from "@/components/ui/tap-target";

const sections = [
  {
    id: "acceptance",
    title: "1. Acceptance of terms",
    children: [
      {
        subtitle: null,
        body: "By accessing or using the Immo platform (the \u201CService\u201D), you agree to be bound by these Terms of Service and all incorporated policies. If you do not agree, do not use the Service. These Terms constitute a binding agreement between you and Immo BV, a company registered in Belgium.",
      },
      {
        subtitle: "1.1 Eligibility",
        body: "You must be at least 18 years old and legally capable of entering into a binding contract. If you accept on behalf of a company, you represent that you have authority to bind that entity.",
      },
      {
        subtitle: "1.2 Changes to the terms",
        body: "We may revise these Terms from time to time. Material changes will be announced at least 30 days before they take effect, by email and via an in-platform notice. Continued use after the effective date constitutes acceptance.",
      },
    ],
  },
  {
    id: "accounts",
    title: "2. Accounts and access",
    children: [
      {
        subtitle: "2.1 Account creation",
        body: "You must provide accurate, current and complete information during registration, and keep it up to date. You are responsible for all activity under your account.",
      },
      {
        subtitle: "2.2 Credentials",
        body: "Keep your password confidential. Notify us immediately of any unauthorized use. We are not liable for losses caused by compromised credentials outside our reasonable control.",
      },
      {
        subtitle: "2.3 Team seats",
        body: "Seats are assigned per named individual and may not be shared. Additional seats may be purchased or removed at any time, with prorated billing adjustments.",
      },
    ],
  },
  {
    id: "services",
    title: "3. Services and deliverables",
    children: [
      {
        subtitle: "3.1 Scope",
        body: "The Service facilitates ordering, scheduling, tracking and delivery of real-estate certification work performed by accredited inspectors. The underlying certifications (EPC, AIV, EK, TK) are governed by the applicable Belgian regional regulations.",
      },
      {
        subtitle: "3.2 Turnaround",
        body: "Estimated turnaround times shown during ordering are indicative. Binding SLAs apply only where explicitly stated in your subscription plan.",
      },
      {
        subtitle: "3.3 Quality",
        body: "All certificates are issued by accredited specialists. Should a deliverable be rejected by the competent authority for cause attributable to us, we will re-issue at no additional charge.",
      },
    ],
  },
  {
    id: "fees",
    title: "4. Fees, invoicing and taxes",
    children: [
      {
        subtitle: "4.1 Pricing",
        body: "Subscription fees and per-service rates are shown on our pricing page and within the Service. Rates may change with 30 days\u2019 notice; in-flight assignments keep their agreed rate.",
      },
      {
        subtitle: "4.2 Payment",
        body: "Subscription fees are billed monthly in advance. Per-service fees are invoiced on completion. All amounts are in EUR, exclusive of VAT.",
      },
      {
        subtitle: "4.3 Late payment",
        body: "Overdue invoices accrue statutory interest. We may suspend access to the Service while an invoice is overdue by more than 15 days.",
      },
    ],
  },
  {
    id: "acceptable-use",
    title: "5. Acceptable use",
    children: [
      {
        subtitle: null,
        body: "You agree not to: (a) reverse-engineer the Service; (b) use the Service to process data you do not have the right to process; (c) attempt to gain unauthorized access to any system; (d) upload malicious code; (e) use the Service to send unsolicited communications.",
      },
    ],
  },
  {
    id: "data",
    title: "6. Data protection",
    children: [
      {
        subtitle: null,
        body: "We process personal data per our Privacy Policy and the applicable Data Processing Agreement. You remain the controller for data you upload concerning property owners, tenants and inspectors.",
      },
    ],
  },
  {
    id: "liability",
    title: "7. Liability",
    children: [
      {
        subtitle: "7.1 Cap",
        body: "To the extent permitted by law, our aggregate liability is limited to the amounts paid by you for the Service in the 12 months preceding the event giving rise to the claim.",
      },
      {
        subtitle: "7.2 Exclusions",
        body: "Neither party is liable for indirect or consequential damages, including loss of profit, loss of data, or loss of business opportunities.",
      },
    ],
  },
  {
    id: "termination",
    title: "8. Termination",
    children: [
      {
        subtitle: null,
        body: "Either party may terminate a subscription at the end of the current billing period. We may terminate immediately for material breach that is not cured within 14 days of notice. On termination, you may export your data for 60 days before it is deleted.",
      },
    ],
  },
  {
    id: "law",
    title: "9. Governing law",
    children: [
      {
        subtitle: null,
        body: "These Terms are governed by Belgian law. Any dispute will be submitted exclusively to the courts of Antwerp, without prejudice to mandatory consumer-protection rules.",
      },
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main>
        <section className="border-b border-[var(--color-border)] bg-[var(--color-bg-alt)]">
          <div className="mx-auto max-w-[var(--container)] px-6 py-16 md:py-20">
            <p className="text-sm font-medium uppercase tracking-wider text-[var(--color-ink-muted)]">Legal</p>
            <h1
              className="mt-3 font-semibold tracking-tight text-[var(--color-ink)]"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.1 }}
            >
              Terms of service
            </h1>
            <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">
              Last updated: 18 April 2026. These Terms govern your use of the Immo platform and services.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto grid max-w-[var(--container)] gap-12 px-6 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">On this page</p>
              <ul className="mt-4 space-y-1 text-sm">
                {sections.map((s) => (
                  <li key={s.id}>
                    <Link href={`#${s.id}`} className={TAP_TARGET_LINK}>
                      {s.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>

            <article className="max-w-prose">
              {sections.map((s) => (
                <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
                  <h2 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">{s.title}</h2>
                  <div className="mt-5 space-y-5">
                    {s.children.map((c, i) => (
                      <div key={i}>
                        {c.subtitle && (
                          <h3 className="text-base font-semibold text-[var(--color-ink)]">{c.subtitle}</h3>
                        )}
                        <p className="mt-2 leading-relaxed text-[var(--color-ink-soft)]">{c.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <div className="mt-16 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-alt)] p-6 text-sm text-[var(--color-ink-soft)]">
                Questions about these terms? Contact{" "}
                <a href="mailto:Jordan@asbestexperts.be" className="font-medium text-[var(--color-ink)] hover:underline">
                  Jordan@asbestexperts.be
                </a>
                .
              </div>
            </article>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
