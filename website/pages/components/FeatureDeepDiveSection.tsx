import React from "react";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, Card, Button, getTheme } from "./ui";

export function FeatureDeepDiveSection({
  website,
}: {
  website: ZelrexWebsite;
}) {
  const t = getTheme(website);

  const features = [
    {
      title: "Revenue-first structure",
      description:
        "Every page is generated around conversion, not aesthetics alone. Layout, hierarchy, and CTAs are chosen to reduce friction and move visitors forward.",
    },
    {
      title: "Brand-true design system",
      description:
        "Colors, typography, spacing, and motion are derived from your brand profile so the site feels intentional—not templated.",
    },
    {
      title: "Copy that sounds human",
      description:
        "Headlines and sections are written to match your tone, confidence level, and audience expectations—clear, calm, and believable.",
    },
    {
      title: "Instant preview & iteration",
      description:
        "You get a live preview link immediately, making it easy to review, refine, and ship without long feedback cycles.",
    },
  ];

  return (
    <Section
      website={website}
      style={{
        background: "transparent",
      }}
    >
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <Eyebrow website={website}>What makes this different</Eyebrow>

        <h2
          style={{
            margin: "12px 0",
            fontFamily: t.fontFamily,
            color: t.textPrimary,
            fontSize: 36,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
          }}
        >
          Built like a product, not a template
        </h2>

        <p
          style={{
            margin: "12px auto 36px",
            maxWidth: 620,
            color: t.textSecondary,
            fontSize: 16,
            lineHeight: 1.6,
          }}
        >
          Zelrex doesn’t assemble pages randomly. Every decision is made to
          create clarity, confidence, and momentum toward action.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          maxWidth: 960,
          margin: "0 auto",
        }}
      >
        {features.map((f, i) => (
          <Card key={i} website={website} style={{ padding: 24 }}>
            <div
              style={{
                fontWeight: 700,
                color: t.textPrimary,
                fontSize: 16,
                marginBottom: 8,
              }}
            >
              {f.title}
            </div>
            <div
              style={{
                color: t.textSecondary,
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              {f.description}
            </div>
          </Card>
        ))}
      </div>

      <div
        style={{
          marginTop: 36,
          display: "flex",
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <Button website={website} href="/offer">
          See the offer
        </Button>
        <Button website={website} href="/contact" variant="secondary">
          Talk to us
        </Button>
      </div>

      <style>{`
        @media (max-width: 900px) {
          section > div:nth-child(2) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Section>
  );
}
