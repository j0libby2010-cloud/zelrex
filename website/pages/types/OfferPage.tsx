import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H1, H2, Lead, Card, Button, getTheme } from "../components/ui";

export function OfferPage({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.offer;

  return (
    <>
      {/* Hero */}
      <Section website={website} style={{ paddingTop: 80, paddingBottom: 40 }}>
        <Eyebrow website={website}>The Offer</Eyebrow>
        <H1 website={website} style={{ marginTop: 18 }}>
          {copy?.hero?.headline ?? "What we offer"}
        </H1>
        <Lead website={website}>
          {copy?.hero?.subheadline ?? "A clear, structured offering designed around real outcomes."}
        </Lead>
      </Section>

      {/* What you get */}
      <Section website={website} style={{ paddingTop: 20 }}>
        <Eyebrow website={website}>{copy?.whatYouGet?.eyebrow ?? "Included"}</Eyebrow>
        <H2 website={website} style={{ marginTop: 14 }}>
          {copy?.whatYouGet?.title ?? "What you get"}
        </H2>
        <Lead website={website} style={{ fontSize: 16 }}>
          {copy?.whatYouGet?.subtitle ?? "Clear deliverables -- no mystery box."}
        </Lead>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {(copy?.whatYouGet?.items ?? []).map((item, i) => (
            <Card key={i} website={website}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: 999, background: t.accent, boxShadow: `0 0 8px ${t.accent}40` }} />
                <strong style={{ fontSize: 15, color: t.textPrimary }}>{item.title}</strong>
              </div>
              <p style={{ margin: 0, color: t.textSecondary, lineHeight: 1.55, fontSize: 14 }}>{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Who it's for */}
      <Section website={website} style={{ paddingTop: 20 }}>
        <Eyebrow website={website}>{copy?.whoItsFor?.eyebrow ?? "Fit"}</Eyebrow>
        <H2 website={website} style={{ marginTop: 14 }}>
          {copy?.whoItsFor?.title ?? "Who this is for"}
        </H2>
        <Lead website={website} style={{ fontSize: 16 }}>
          {copy?.whoItsFor?.subtitle ?? "If you value clarity and momentum, you'll feel at home."}
        </Lead>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {(copy?.whoItsFor?.items ?? []).map((item, i) => (
            <Card key={i} website={website}>
              <strong style={{ fontSize: 15, color: t.textPrimary }}>{item.title}</strong>
              <p style={{ margin: "8px 0 0", color: t.textSecondary, lineHeight: 1.55, fontSize: 14 }}>{item.description}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <Section website={website} style={{ paddingTop: 20, paddingBottom: 80 }}>
        <Card website={website} style={{ padding: 32, borderRadius: 24, textAlign: "center" }}>
          <H2 website={website}>{copy?.cta?.title ?? "Get started"}</H2>
          <Lead website={website} style={{ margin: "12px auto 0", maxWidth: 500 }}>
            {copy?.cta?.subtitle ?? "Take the first step."}
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
