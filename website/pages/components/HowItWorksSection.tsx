import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H2, Lead, Card, Button, getTheme } from "./ui";

export function HowItWorksSection({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.home?.howItWorks;

  const steps = (copy?.steps ?? []).map((s, i) => ({
    n: String(i + 1).padStart(2, "0"),
    title: s.title,
    body: s.description,
  }));

  // Fallback if no copy
  const displaySteps = steps.length > 0 ? steps : [
    { n: "01", title: "Tell us what you need", body: "Share your situation and goals." },
    { n: "02", title: "We build the structure", body: "A clear layout designed for conversion." },
    { n: "03", title: "Review and refine", body: "Adjust until it's exactly right." },
  ];

  return (
    <Section
      website={website}
      style={{
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, alignItems: "start" }}>
        <div>
          <Eyebrow website={website}>{copy?.eyebrow ?? "How it works"}</Eyebrow>
          <H2 website={website} style={{ marginTop: 14 }}>
            {copy?.title ?? "A clear process from start to finish."}
          </H2>
          <Lead website={website} style={{ fontSize: 16 }}>
            {copy?.subtitle ?? "Designed to move fast without making risky assumptions."}
          </Lead>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Button website={website} href="/offer">View offer</Button>
            <Button website={website} href="/contact" variant="secondary">Talk to us</Button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          {displaySteps.map((s) => (
            <Card key={s.n} website={website} style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <div style={{
                  fontFamily: t.fontFamily,
                  fontWeight: 800,
                  color: t.accent,
                  letterSpacing: "0.08em",
                  fontSize: 13,
                  minWidth: 32,
                }}>
                  {s.n}
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: t.textPrimary, fontSize: 15 }}>{s.title}</div>
                  <div style={{ marginTop: 6, color: t.textSecondary, lineHeight: 1.55, fontSize: 14 }}>{s.body}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          section > div > div { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Section>
  );
}
