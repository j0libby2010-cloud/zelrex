import { ZelrexWebsite } from "../../core/websiteTypes";
import { Hero } from "../components/Hero";

export function AboutPage({ website }: { website: ZelrexWebsite }) {
  return (
    <>
      <Hero
        website={website}
        title="About"
        subtitle="Why this exists and how we approach our work."
      />

      <section style={{ maxWidth: 900 }}>
        <p>
          Everything we do is centered around clarity, trust, and long-term
          value.
        </p>
      </section>
    </>
  );
}
