import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";

export default function Nav() {
  return (
    <header className="sticky top-0 z-50 bg-[color-mix(in_srgb,var(--color-bg)_80%,transparent)] backdrop-blur border-b border-[var(--color-border)]">
      <div className="mx-auto flex h-16 max-w-[var(--container)] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-[var(--color-brand)] text-[var(--color-on-brand)] text-sm font-bold">
            I
          </span>
          <span className="text-lg">Immo</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-[var(--color-ink-soft)]">
          <Link href="/#services" className="hover:text-[var(--color-ink)] transition-colors">
            Services
          </Link>
          <Link href="/#how-it-works" className="hover:text-[var(--color-ink)] transition-colors">
            How it works
          </Link>
          <Link href="/#about" className="hover:text-[var(--color-ink)] transition-colors">
            About
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-block text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="hidden md:inline-block rounded-md bg-[var(--color-brand)] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[var(--color-brand-soft)] hover:shadow-md"
          >
            Register as agent
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
