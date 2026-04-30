import Nav from "@/components/Nav";
import Hero from "@/components/Hero";
import Services from "@/components/Services";
import HowItWorks from "@/components/HowItWorks";
import Merger from "@/components/Merger";
import CTA from "@/components/CTA";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div
      className="contents"
      style={{
        fontFamily:
          "var(--font-proxima), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
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
