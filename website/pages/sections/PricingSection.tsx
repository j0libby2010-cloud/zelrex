import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H2, Lead, Card, Button, getTheme, withAlpha } from "../components/ui";

export function PricingSection({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const pricingCopy = website.copy?.pricing;
  const tiers = pricingCopy?.pricing?.tiers ?? [];

  // If no tiers at all, don't render an empty section
  if (tiers.length === 0) return null;

  return (
    <Section website={website} id="pricing">
      <div style={{ display: "grid", gap: 14 }}>
        <Eyebrow website={website}>{pricingCopy?.pricing?.eyebrow ?? "Pricing"}</Eyebrow>
        <H2 website={website}>
          {pricingCopy?.pricing?.title ?? "Simple pricing"}
        </H2>
        <Lead website={website} style={{ fontSize: 16 }}>
          {pricingCopy?.pricing?.subtitle ?? "Clear, transparent, no hidden fees."}
        </Lead>
      </div>

      <div style={{
        marginTop: 28,
        display: "grid",
        gridTemplateColumns: tiers.length === 1
          ? "minmax(0, 480px)"
          : `repeat(${Math.min(tiers.length, 3)}, minmax(0, 1fr))`,
        gap: 18,
        alignItems: "stretch",
        justifyContent: tiers.length === 1 ? "center" : "stretch",
      }}>
        {tiers.map((tier, i) => (
          <Card
            key={i}
            website={website}
            highlight={tier.highlighted}
            style={{
              padding: 24,
              position: "relative",
            }}
          >
            {tier.highlighted && tiers.length > 1 && (
              <div style={{
                position: "absolute",
                top: 14,
                right: 14,
                fontSize: 11,
                fontWeight: 800,
                padding: "6px 12px",
                borderRadius: 999,
                background: withAlpha(t.accent, 0.15),
                border: `1px solid ${withAlpha(t.accent, 0.35)}`,
                color: t.textPrimary,
              }}>
                Recommended
              </div>
            )}

            <div style={{ fontWeight: 700, color: t.textPrimary, fontSize: 17 }}>{tier.name}</div>
            <div style={{ fontWeight: 900, color: t.textPrimary, fontSize: 32, letterSpacing: "-0.03em", margin: "10px 0 6px" }}>
              {tier.price}
            </div>
            {tier.note && (
              <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.5 }}>{tier.note}</div>
            )}

            <div style={{ marginTop: 18, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                {(tier.features || []).map((f, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: 10, color: t.textSecondary, fontSize: 14 }}>
                    <span style={{ color: t.accent, fontSize: 15, flexShrink: 0 }}>&check;</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 20 }}>
              <Button website={website} href="/contact" variant={tier.highlighted ? "primary" : "secondary"}>
                Get started
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <style>{`
        @media (max-width: 980px) {
          #pricing + div, section > div > div + div { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 680px) {
          section > div > div + div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Section>
  );
}
