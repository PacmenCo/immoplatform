import type { Metadata } from "next";
import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Merger from "@/components/Merger";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";
import { buildLocaleAlternates } from "@/i18n/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: await buildLocaleAlternates("/") };
}

export default function Home() {
  return (
    <div className="contents">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Services />
        <HowItWorks />
        <Merger />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
