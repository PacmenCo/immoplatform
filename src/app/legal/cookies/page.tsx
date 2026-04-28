import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { TAP_TARGET_LINK } from "@/components/ui/tap-target";

const sections = [
  {
    id: "what-are-cookies",
    title: "1. What are cookies?",
    children: [
      {
        subtitle: null,
        body: "Cookies are small text files placed on your device when you visit a website. They allow the site to remember your actions and preferences over time. Similar technologies such as local storage, session storage and pixels are covered by this policy as well.",
      },
    ],
  },
  {
    id: "how-we-use",
    title: "2. How we use cookies",
    children: [
      {
        subtitle: "2.1 Strictly necessary",
        body: "These cookies are required for the platform to function. They handle authentication, load balancing, and security. They cannot be disabled without breaking the Service.",
      },
      {
        subtitle: "2.2 Preferences",
        body: "Used to remember language, region and UI preferences. Disabling them resets your interface choices on each visit.",
      },
      {
        subtitle: "2.3 Analytics",
        body: "Used to understand aggregate traffic and improve the product. IP addresses are truncated before storage and no cross-site tracking occurs.",
      },
      {
        subtitle: "2.4 Marketing",
        body: "Used only with your explicit consent to measure campaign effectiveness. Disabled by default in the EEA.",
      },
    ],
  },
  {
    id: "the-cookies-we-set",
    title: "3. The cookies we set",
    children: [
      {
        subtitle: "3.1 session",
        body: "Purpose: user authentication. Duration: session. Category: strictly necessary.",
      },
      {
        subtitle: "3.2 csrf_token",
        body: "Purpose: protection against cross-site request forgery. Duration: session. Category: strictly necessary.",
      },
      {
        subtitle: "3.3 locale",
        body: "Purpose: remember preferred language. Duration: 12 months. Category: preferences.",
      },
      {
        subtitle: "3.4 analytics_id",
        body: "Purpose: anonymized usage analytics. Duration: 13 months. Category: analytics.",
      },
    ],
  },
  {
    id: "third-party",
    title: "4. Third-party cookies",
    children: [
      {
        subtitle: null,
        body: "Embedded content (such as a YouTube tutorial or a Stripe checkout) may set their own cookies. We do not control these cookies. Please refer to the respective provider\u2019s cookie policy for details.",
      },
    ],
  },
  {
    id: "managing",
    title: "5. Managing your preferences",
    children: [
      {
        subtitle: "5.1 Consent banner",
        body: "On your first visit you see a consent banner allowing granular control over non-essential categories. You can revisit your preferences at any time via the Cookie Preferences link in the footer.",
      },
      {
        subtitle: "5.2 Browser controls",
        body: "All modern browsers allow you to block or delete cookies in their settings. Note that disabling strictly necessary cookies will break login and other core functionality.",
      },
    ],
  },
  {
    id: "changes",
    title: "6. Changes to this policy",
    children: [
      {
        subtitle: null,
        body: "We may update this Cookie Policy from time to time. Material changes will be announced via an in-platform notice and an updated \u201CLast updated\u201D date at the top of this page.",
      },
    ],
  },
  {
    id: "contact",
    title: "7. Contact",
    children: [
      {
        subtitle: null,
        body: "Questions about cookies: Jordan@asbestexperts.be.",
      },
    ],
  },
];

export default function CookiesPage() {
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
              Cookie policy
            </h1>
            <p className="mt-4 max-w-2xl text-[var(--color-ink-soft)]">
              Last updated: 18 April 2026. How and why we use cookies and similar technologies.
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
                See also our{" "}
                <Link href="/legal/privacy" className="font-medium text-[var(--color-ink)] hover:underline">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/legal/terms" className="font-medium text-[var(--color-ink)] hover:underline">
                  Terms of Service
                </Link>
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
