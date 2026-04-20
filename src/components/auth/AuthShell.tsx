import Link from "next/link";
import { Card } from "@/components/ui/Card";

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
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-brand)] text-white text-sm font-bold">
            I
          </span>
          <span className="text-lg">Immo</span>
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
          © {new Date().getFullYear()} Immo. All rights reserved.
        </p>
      </div>

      <div
        aria-hidden
        className="relative hidden lg:block overflow-hidden bg-[var(--color-brand)]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(245,158,11,0.15),transparent_50%),radial-gradient(circle_at_70%_80%,rgba(16,185,129,0.15),transparent_50%)]" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2 text-sm opacity-80">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-epc)]" />
            Trusted by 400+ agencies in Belgium
          </div>
          <div className="max-w-md">
            <p className="text-2xl font-medium leading-snug">
              &ldquo;We went from juggling four inspectors to one dashboard. Our
              sales cycle on certificates shortened by 40%.&rdquo;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-bg)]/10 text-sm font-semibold">
                EV
              </span>
              <div>
                <p className="text-sm font-medium">Els Vermeulen</p>
                <p className="text-xs opacity-70">Vastgoed Antwerp</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs opacity-70">
            <span>EPC</span>
            <span>Asbestos</span>
            <span>Electrical</span>
            <span>Fuel Tank</span>
          </div>
        </div>
      </div>
    </div>
  );
}
