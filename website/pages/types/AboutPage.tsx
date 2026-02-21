import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H1, H2, Lead, Card, Button, getTheme } from "../components/ui";

export function AboutPage({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.about;

  return (
    <>
      {/* Hero */}
      <Section website={website} style={{ paddingTop: 80, paddingBottom: 40 }}>
        <Eyebrow website={website}>About</Eyebrow>
        <H1 website={website} style={{ marginTop: 18 }}>
          {copy?.hero?.headline ?? `About ${website.branding.name}`}
        </H1>
        <Lead website={website}>
          {copy?.hero?.subheadline ?? "Built around clarity and momentum."}
        </Lead>
      </Section>

      {/* Story */}
      <Section website={website} style={{ paddingTop: 20 }}>
        <Eyebrow website={website}>{copy?.story?.eyebrow ?? "Why this exists"}</Eyebrow>
        <H2 website={website} style={{ marginTop: 14 }}>
          {copy?.story?.title ?? "Our story"}
        </H2>
        <p style={{
          marginTop: 16,
          color: t.textSecondary,
          lineHeight: 1.7,
          fontSize: 16,
          maxWidth: 680,
        }}>
          {copy?.story?.body ?? "We built this because the alternatives weren't good enough."}
        </p>
      </Section>

      {/* Values */}
      <Section website={website} style={{ paddingTop: 20 }}>
        <Eyebrow website={website}>{copy?.values?.eyebrow ?? "Principles"}</Eyebrow>
        <H2 website={website} style={{ marginTop: 14 }}>
          {copy?.values?.title ?? "What we optimize for"}
        </H2>
        <div style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {(copy?.values?.items ?? []).map((item, i) => (
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

      {/* CTA */}
      <Section website={website} style={{ paddingTop: 20, paddingBottom: 80 }}>
        <Card website={website} style={{ padding: 32, borderRadius: 24, textAlign: "center" }}>
          <H2 website={website}>{copy?.cta?.title ?? `Ready to work with ${website.branding.name}?`}</H2>
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