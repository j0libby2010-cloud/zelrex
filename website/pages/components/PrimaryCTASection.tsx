import React from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, H2, Lead, Card, Button, getTheme, withAlpha } from "./ui";

export function PrimaryCTASection({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.home?.primaryCta;

  return (
    <Section website={website} style={{ paddingTop: 24 }}>
      <Card
        website={website}
        style={{
          padding: 32,
          borderRadius: 24,
          background:
            t.name === "Aura"
              ? t.surface
              : `linear-gradient(180deg, ${withAlpha(t.surface, 0.95)}, ${withAlpha(t.surface, 0.70)})`,
          boxShadow: "0 30px 80px rgba(0,0,0,0.3)",
          border: `1px solid ${withAlpha(t.border, 0.9)}`,
        }}
      >
        <div style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: 24,
          alignItems: "center",
        }}>
          <div>
            <H2 website={website}>
              {copy?.title ?? "Ready to get started?"}
            </H2>
            <Lead website={website} style={{ fontSize: 15 }}>
              {copy?.subtitle ?? "Clear next steps. No wasted time."}
            </Lead>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <Button website={website} href="/contact">
              {copy?.cta?.text ?? "Get started"}
            </Button>
            <Button website={website} href="/pricing" variant="secondary">
              View pricing
            </Button>
          </div>
        </div>

        <style>{`
          @media (max-width: 820px) {
            section > div > div > div { grid-template-columns: 1fr !important; }
            section > div > div > div > div:last-child { justify-content: flex-start !important; }
          }
        `}</style>
      </Card>
    </Section>
  );
}