import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { TAP_TARGET_LINK } from "@/components/ui/tap-target";

const sections = [
  {
    id: "intro",
    title: "1. Introduction",
    children: [
      {
        subtitle: null,
        body: "Immo BV (\u201Cwe\u201D, \u201Cus\u201D) respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard information when you use our platform or interact with our website.",
      },
      {
        subtitle: "1.1 Scope",
        body: "This policy applies to personal data processed in our capacity as data controller (e.g. your agency account) and describes our standard obligations as processor for data you upload (e.g. property owner details). Processor obligations are further detailed in our Data Processing Agreement.",
      },
    ],
  },
  {
    id: "data-we-collect",
    title: "2. Data we collect",
    children: [
      {
        subtitle: "2.1 Account data",
        body: "Name, work email, company name, VAT number, phone, password hash, role and team assignment.",
      },
      {
        subtitle: "2.2 Usage data",
        body: "Pages visited, actions taken, IP address, browser type, device metadata, and approximate geographic region derived from IP.",
      },
      {
        subtitle: "2.3 Certificate data",
        body: "Property addresses, owner and tenant contact details, inspection reports and related documents. You remain the controller for this data.",
      },
      {
        subtitle: "2.4 Payment data",
        body: "Billing address, VAT number and payment reference. We do not store full card details \u2014 they are handled by our PCI-DSS compliant payment processor.",
      },
    ],
  },
  {
    id: "how-we-use",
    title: "3. How we use your data",
    children: [
      {
        subtitle: null,
        body: "We process personal data to: (a) provide and maintain the Service; (b) authenticate users and prevent abuse; (c) fulfill contractual obligations and invoice you; (d) communicate product updates and security notices; (e) comply with legal obligations; (f) improve the Service through aggregated analytics.",
      },
    ],
  },
  {
    id: "legal-basis",
    title: "4. Legal basis",
    children: [
      {
        subtitle: null,
        body: "We rely on the following GDPR legal bases: performance of a contract (Art. 6(1)(b)); compliance with legal obligations (Art. 6(1)(c)); our legitimate interests in running and improving the Service (Art. 6(1)(f)); and your consent where specifically requested (Art. 6(1)(a)).",
      },
    ],
  },
  {
    id: "sharing",
    title: "5. Sharing and sub-processors",
    children: [
      {
        subtitle: "5.1 Accredited inspectors",
        body: "Assignment data is shared with the inspector assigned to the work, strictly to the extent needed to perform the inspection.",
      },
      {
        subtitle: "5.2 Sub-processors",
        body: "We use vetted sub-processors for hosting, email delivery, payment processing and error monitoring. A current list is maintained in our Trust Center and updated with at least 14 days\u2019 advance notice.",
      },
      {
        subtitle: "5.3 Authorities",
        body: "We disclose data when legally compelled, and only to the extent strictly necessary.",
      },
    ],
  },
  {
    id: "retention",
    title: "6. Retention",
    children: [
      {
        subtitle: null,
        body: "Account data is retained for the duration of your subscription and 24 months thereafter. Certificates are retained for 10 years as required by Belgian law. Invoicing records are retained for 7 years. Security logs are retained for 13 months.",
      },
    ],
  },
  {
    id: "your-rights",
    title: "7. Your rights",
    children: [
      {
        subtitle: null,
        body: "You have the right to access, correct, delete, restrict, object to, and port your personal data. You can exercise these rights from within your account settings or by emailing Jordan@asbestexperts.be. If you are unsatisfied with our response, you can lodge a complaint with the Belgian Data Protection Authority.",
      },
    ],
  },
  {
    id: "security",
    title: "8. Security",
    children: [
      {
        subtitle: null,
        body: "We apply industry-standard technical and organizational safeguards including encryption in transit and at rest, least-privilege access control, regular penetration testing, and 24/7 incident response. No system is perfectly secure, but we take reasonable steps to protect your data.",
      },
    ],
  },
  {
    id: "transfers",
    title: "9. International transfers",
    children: [
      {
        subtitle: null,
        body: "Our primary infrastructure is in the European Economic Area. Any transfer outside the EEA is protected by appropriate safeguards, typically the European Commission\u2019s Standard Contractual Clauses.",
      },
    ],
  },
  {
    id: "contact",
    title: "10. Contact",
    children: [
      {
        subtitle: null,
        body: "Questions, requests or complaints: Jordan@asbestexperts.be. Our Data Protection Officer can be reached at Jordan@asbestexperts.be.",
      },
    ],
  },
];

export default function PrivacyPage() {
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
              Privacy policy
            </h1>
            <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">
              Last updated: 18 April 2026. How we collect, use and protect your personal data.
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
                Questions about your data? Contact{" "}
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
