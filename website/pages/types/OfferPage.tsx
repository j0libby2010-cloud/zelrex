import { ZelrexWebsite } from "../../core/websiteTypes";
import { Hero } from "../components/Hero";

export function OfferPage({ website }: { website: ZelrexWebsite }) {
  return (
    <>
      <Hero
        website={website}
        title="What we offer"
        subtitle="A clear, focused offering designed to deliver real outcomes."
      />

      <section style={{ maxWidth: 900 }}>
        <p>
          This offer is built for people who value clarity, speed, and
          professionalism. No fluff. No confusion.
        </p>
      </section>
    </>
  );
}
