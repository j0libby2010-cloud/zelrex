import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H1, H2, Lead, Card, Button, getTheme, withAlpha } from "../components/ui";

export function PricingPage({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.pricing;

  return (
    <>
      {/* Hero */}
      <Section website={website} style={{ paddingTop: 80, paddingBottom: 40 }}>
        <Eyebrow website={website}>Pricing</Eyebrow>
        <H1 website={website} style={{ marginTop: 18 }}>
          {copy?.hero?.headline ?? "Pricing"}
        </H1>
        <Lead website={website}>
          {copy?.hero?.subheadline ?? "Transparent and straightforward."}
        </Lead>
      </Section>

      {/* Pricing tiers */}
      <Section website={website} style={{ paddingTop: 20 }}>
        <Eyebrow website={website}>{copy?.pricing?.eyebrow ?? "Investment"}</Eyebrow>
        <H2 website={website} style={{ marginTop: 14 }}>
          {copy?.pricing?.title ?? "Simple pricing"}
        </H2>
        <Lead website={website} style={{ fontSize: 16 }}>
          {copy?.pricing?.subtitle ?? "One clear option. No hidden fees."}
        </Lead>

        <div style={{ marginTop: 32, display: "grid", gridTemplateColumns: `repeat(${Math.min((copy?.pricing?.tiers ?? []).length, 3)}, minmax(0, 1fr))`, gap: 20 }}>
          {(copy?.pricing?.tiers ?? []).map((tier, i) => (
            <Card
              key={i}
              website={website}
              highlight={tier.highlighted}
              style={{
                padding: 28,
                position: "relative",
              }}
            >
              {tier.highlighted && (
                <div style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
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
              <div style={{ fontWeight: 700, color: t.textPrimary, fontSize: 18 }}>{tier.name}</div>
              <div style={{ fontWeight: 900, color: t.textPrimary, fontSize: 36, letterSpacing: "-0.03em", margin: "12px 0 8px" }}>
                {tier.price}
              </div>
              {tier.note && (
                <div style={{ color: t.textSecondary, fontSize: 14, lineHeight: 1.5 }}>{tier.note}</div>
              )}
              <div style={{ marginTop: 20, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 10 }}>
                  {tier.features.map((f, j) => (
                    <li key={j} style={{ display: "flex", alignItems: "center", gap: 10, color: t.textSecondary, fontSize: 14 }}>
                      <span style={{ color: t.accent, fontSize: 16 }}>&check;</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ marginTop: 24 }}>
                <Button website={website} href="/contact" variant={tier.highlighted ? "primary" : "secondary"}>
                  Get started
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section website={website} style={{ paddingTop: 20, paddingBottom: 80 }}>
        <Card website={website} style={{ padding: 32, borderRadius: 24, textAlign: "center" }}>
          <H2 website={website}>{copy?.cta?.title ?? "Ready to get started?"}</H2>
          <Lead website={website} style={{ margin: "12px auto 0", maxWidth: 500 }}>
            {copy?.cta?.subtitle ?? "One step to begin."}
          </Lead>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
            <Button website={website} href="/contact">
              {copy?.cta?.cta?.text ?? "Get started"}
            </Button>
          </div>
        </Card>
      </Section>
    </>
  );
}