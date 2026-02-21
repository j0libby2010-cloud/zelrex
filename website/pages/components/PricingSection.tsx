import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, Card, Button, getTheme } from "./ui";

export function PricingSection({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);

  // If you later generate real tiers, plug them here.
  const tiers = [
    {
      name: "Starter",
      price: "From $X",
      desc: "Best for getting a clean, premium presence live fast.",
      bullets: ["Multi-page premium template", "Theme + branding applied", "Bespoke copy", "Preview link"],
      highlight: false,
    },
    {
      name: "Recommended",
      price: "From $Y",
      desc: "For a stronger offer page + higher conversion focus.",
      bullets: ["Everything in Starter", "Stronger offer layout", "Better CTA hierarchy", "Cleaner mobile polish"],
      highlight: true,
    },
    {
      name: "Pro",
      price: "From $Z",
      desc: "For teams that want iterations and a sharper brand feel.",
      bullets: ["Everything in Recommended", "More sections/pages", "Iterate faster", "Priority polish"],
      highlight: false,
    },
  ];

  return (
    <Section website={website} id="pricing">
      <div style={{ display: "grid", gap: 14 }}>
        <Eyebrow website={website}>Pricing</Eyebrow>
        <h2
          style={{
            margin: 0,
            fontFamily: t.fontFamily,
            color: t.textPrimary,
            fontSize: 34,
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
          }}
        >
          {website.copy?.pricing?.hero?.headline ?? "Simple pricing, clear value."}
        </h2>
        <p style={{ margin: 0, color: t.textSecondary, maxWidth: 760, lineHeight: 1.6, fontSize: 16 }}>
          {website.copy?.pricing?.hero?.subheadline ??
            "Pick the level that matches how much conversion and iteration you want. No clutter."}
        </p>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          alignItems: "stretch",
        }}
      >
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            website={website}
            style={{
              padding: 18,
              position: "relative",
              outline: tier.highlight ? `2px solid ${withAlpha(t.accent, 0.55)}` : "none",
              boxShadow: tier.highlight ? "0 30px 90px rgba(0,0,0,0.35)" : undefined,
            }}
          >
            {tier.highlight && (
              <div
                style={{
                  position: "absolute",
                  top: 14,
                  right: 14,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: withAlpha(t.accent, 0.15),
                  border: `1px solid ${withAlpha(t.accent, 0.35)}`,
                  color: t.textPrimary,
                }}
              >
                Best value
              </div>
            )}

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 850, color: t.textPrimary, fontSize: 16 }}>{tier.name}</div>
              <div style={{ fontWeight: 900, color: t.textPrimary, fontSize: 28, letterSpacing: "-0.03em" }}>
                {tier.price}
              </div>
              <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.55 }}>{tier.desc}</div>
            </div>

            <div style={{ marginTop: 14, borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
              <ul style={{ margin: 0, paddingLeft: 16, color: t.textSecondary, lineHeight: 1.7, fontSize: 14 }}>
                {tier.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 16 }}>
              <Button website={website} href="/contact" variant={tier.highlight ? "primary" : "secondary"}>
                Choose {tier.name}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <style>{`
        @media (max-width: 980px) {
          section #pricing + div, section > div > div + div {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 680px) {
          section > div > div + div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Section>
  );
}

function withAlpha(hexOrRgb: string, a: number) {
  if (hexOrRgb.includes("gradient(")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgba(")) return hexOrRgb;
  if (hexOrRgb.startsWith("rgb(")) return hexOrRgb;
  if (!hexOrRgb.startsWith("#") || (hexOrRgb.length !== 7 && hexOrRgb.length !== 4)) return hexOrRgb;

  const hex = hexOrRgb.length === 4
    ? `#${hexOrRgb[1]}${hexOrRgb[1]}${hexOrRgb[2]}${hexOrRgb[2]}${hexOrRgb[3]}${hexOrRgb[3]}`
    : hexOrRgb;

  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
