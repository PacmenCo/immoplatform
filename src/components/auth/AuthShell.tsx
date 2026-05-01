import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/Card";
import { BrandName } from "@/components/BrandName";
import { BrandLogo } from "@/components/BrandLogo";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-between px-8 py-10 sm:px-16">
        <Link href="/" className="inline-flex items-center" aria-label="immoplatform.be — home">
          <BrandLogo className="h-12 w-auto" />
        </Link>

        <main id="main" className="mx-auto w-full max-w-sm">
          <h1
            className="font-semibold tracking-tight"
            style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", lineHeight: 1.1 }}
          >
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 text-[var(--color-ink-soft)]">{subtitle}</p>
          )}

          <div className="mt-8">{children}</div>

          {footer && (
            <p className="mt-8 text-sm text-[var(--color-ink-muted)]">{footer}</p>
          )}
        </main>

        <p className="text-xs text-[var(--color-ink-muted)]">
          © {new Date().getFullYear()} <BrandName />. All rights reserved.
        </p>
      </div>

      <div
        aria-hidden
        className="relative hidden lg:block overflow-hidden bg-[var(--color-brand)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-[var(--color-on-brand)]">
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[var(--color-on-brand)]/15 bg-[var(--color-on-brand)]/5 px-3 py-1 text-xs font-medium uppercase tracking-wider opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" aria-hidden />
            Belgian real-estate certifications
          </div>

          <div className="max-w-md space-y-4">
            <h2
              className="font-semibold leading-[1.1] tracking-tight"
              style={{ fontSize: "clamp(1.875rem, 2.6vw, 2.5rem)" }}
            >
              One dashboard for every certificate.
            </h2>
            <p className="text-base leading-relaxed opacity-80">
              Order, schedule, track, and invoice every inspection &mdash;
              all from one place.
            </p>
          </div>

          <ul className="grid max-w-md grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-epc)]"
              />
              EPC certificates
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-asbestos)]"
              />
              Asbestos attests
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-electrical)]"
              />
              Electrical inspections
            </li>
            <li className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-fuel)]"
              />
              Fuel-tank checks
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
