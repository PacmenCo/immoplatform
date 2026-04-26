import { TAP_TARGET_LINK } from "@/components/ui/tap-target";

const columns = [
  {
    title: "Services",
    links: [
      { label: "Energy Performance Certificate (EPC)", href: "/services/epc" },
      { label: "Asbestos Inventory Attest (AIV)", href: "/services/asbestos" },
      { label: "Electrical Inspection (EK)", href: "/services/electrical" },
      { label: "Fuel Tank Check (TK)", href: "/services/fuel" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Login", href: "/login" },
      { label: "Register", href: "/register" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Cookies", href: "/legal/cookies" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="bg-[var(--color-bg)]">
      <div className="mx-auto max-w-[var(--container)] px-6 py-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-1">
            <a href="/" className="flex items-center gap-2 font-semibold">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-bold">
                I
              </span>
              <span className="text-lg">Immo</span>
            </a>
            <p className="mt-4 text-sm text-[var(--color-ink-soft)]">
              One platform for every real-estate certificate in Belgium.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold text-[var(--color-ink)]">
                {col.title}
              </p>
              <ul className="mt-4 space-y-1">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className={`${TAP_TARGET_LINK} text-sm transition-colors`}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-[var(--color-ink-muted)]">
            © {new Date().getFullYear()} Immo. All rights reserved.
          </p>
          <p className="text-sm text-[var(--color-ink-muted)]">
            Asbest Experts · EPC Partner · Elec Inspect · Tank Check
          </p>
        </div>
      </div>
    </footer>
  );
}
