import { ZelrexWebsite } from "../../core/websiteTypes";

export function Hero({
  website,
  title,
  subtitle,
}: {
  website: ZelrexWebsite;
  title: string;
  subtitle: string;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <h1
        style={{
          fontSize: "clamp(36px, 6vw, 64px)",
          fontWeight: 650,
          letterSpacing: "-0.03em",
          lineHeight: 1.05,
          margin: 0,
        }}
      >
        {title}
      </h1>

      <p
        style={{
          maxWidth: 720,
          fontSize: 18,
          lineHeight: 1.6,
          opacity: 0.85,
          margin: 0,
        }}
      >
        {subtitle}
      </p>
    </section>
  );
}
