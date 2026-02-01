import { ZelrexWebsite } from "../../core/websiteTypes";
import { Hero } from "../components/Hero";

export function ContactPage({ website }: { website: ZelrexWebsite }) {
  return (
    <>
      <Hero
        website={website}
        title="Get in touch"
        subtitle="Let’s talk about your goals and next steps."
      />

      <section style={{ maxWidth: 600 }}>
        <p>
          Reach out to start a conversation. We’ll help you figure out the best
          path forward.
        </p>
      </section>
    </>
  );
}
