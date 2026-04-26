import Link from "next/link";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="bg-[var(--color-bg-alt)]">
        <div className="mx-auto flex min-h-[70vh] max-w-[var(--container)] flex-col items-center justify-center px-6 py-20 text-center">
          <span
            className="font-semibold tracking-tight text-[var(--color-ink)]"
            style={{ fontSize: "clamp(5rem, 14vw, 10rem)", lineHeight: 1 }}
            aria-hidden
          >
            404
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[var(--color-ink)] md:text-3xl">
            This page went to the inspector and never came back.
          </h1>
          <p className="mt-4 max-w-xl text-[var(--color-ink-soft)]">
            The link you followed is broken, the page has moved, or it never existed. Pick one of the doors below and we&apos;ll
            get you back on track.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Button href="/" size="lg">
              Back to home
            </Button>
            <Button href="/contact" size="lg" variant="secondary">
              Contact support
            </Button>
          </div>

          <ul className="mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--color-ink-muted)]">
            <li>
              <Link href="/pricing" className="hover:text-[var(--color-ink)]">
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/about" className="hover:text-[var(--color-ink)]">
                About
              </Link>
            </li>
            <li>
              <Link href="/login" className="hover:text-[var(--color-ink)]">
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </main>
      <Footer />
    </>
  );
}
