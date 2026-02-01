import { ZelrexWebsite } from "../../core/websiteTypes";
import { Hero } from "../components/Hero";

export function PricingPage({ website }: { website: ZelrexWebsite }) {
  return (
    <>
      <Hero
        website={website}
        title="Pricing"
        subtitle="Simple, transparent pricing with no surprises."
      />

      <section style={{ maxWidth: 600 }}>
        <p>
          You get exactly what you need to move forward — nothing more, nothing
          less.
        </p>
      </section>
    </>
  );
}
