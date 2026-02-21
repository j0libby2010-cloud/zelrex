import React from "react";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import { Section, Eyebrow, H1, Lead, Button, getTheme, getHeroLayout, withAlpha } from "../components/ui";

export function HeroSection({ website }: { website: ZelrexWebsite }) {
  const layout = getHeroLayout(website);

  switch (layout) {
    case "centered":
      return <CenteredHero website={website} />;
    case "stacked":
      return <StackedHero website={website} />;
    default:
      return <SplitHero website={website} />;
  }
}

// ─── SPLIT layout (default: agency, service, freelance) ─────────────
function SplitHero({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.home;
  const headline = copy?.hero?.headline ?? `Welcome to ${website.branding.name}.`;
  const sub = copy?.hero?.subheadline ?? website.branding.tagline ?? "A focused solution designed for results.";

  return (
    <Section website={website} style={{ paddingTop: 96, paddingBottom: 48, position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", inset: -200,
        background: `radial-gradient(closest-side at 20% 20%, ${withAlpha(t.accent, 0.12)}, transparent 60%), radial-gradient(closest-side at 70% 30%, ${withAlpha(t.textPrimary, 0.06)}, transparent 65%)`,
        filter: "blur(50px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: 48, alignItems: "center" }}>
        <div>
          <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? "Built for results"}</Eyebrow>
          <H1 website={website} style={{ marginTop: 20 }}>{headline}</H1>
          <Lead website={website} style={{ marginTop: 16, maxWidth: 520 }}>{sub}</Lead>
          <div style={{ display: "flex", gap: 14, marginTop: 32, flexWrap: "wrap" }}>
            <Button website={website} href="/contact">{copy?.primaryCta?.cta?.text ?? "Get started"}</Button>
            <Button website={website} href="/offer" variant="secondary">See the offer</Button>
          </div>
        </div>

        <div style={{
          borderRadius: 22, border: `1px solid ${t.border}`,
          background: t.surface, boxShadow: t.shadow, overflow: "hidden",
        }}>
          <div style={{ padding: 18, borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: t.accent, boxShadow: `0 0 12px ${withAlpha(t.accent, 0.5)}` }} />
              <strong style={{ fontSize: 13 }}>{website.branding.name}</strong>
            </div>
            <span style={{ fontSize: 12, color: t.textSecondary }}>Preview</span>
          </div>
          <div style={{ padding: 20, display: "grid", gap: 14 }}>
            {(copy?.howItWorks?.steps ?? []).slice(0, 3).map((step, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "start" }}>
                <div style={{ width: 10, height: 10, marginTop: 5, borderRadius: 3, background: t.accent, boxShadow: `0 0 8px ${withAlpha(t.accent, 0.4)}` }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: t.textPrimary }}>{step.title}</div>
                  <div style={{ fontSize: 13, color: t.textSecondary, marginTop: 2 }}>{step.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 920px) { section > div > div { grid-template-columns: 1fr !important; } }`}</style>
    </Section>
  );
}

// ─── CENTERED layout (luxury, premium, high-ticket) ─────────────────
function CenteredHero({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.home;
  const headline = copy?.hero?.headline ?? `Welcome to ${website.branding.name}.`;
  const sub = copy?.hero?.subheadline ?? website.branding.tagline ?? "A focused solution designed for results.";

  return (
    <Section website={website} style={{ paddingTop: 120, paddingBottom: 80, position: "relative", overflow: "hidden", textAlign: "center" }}>
      <div aria-hidden style={{
        position: "absolute", inset: -300,
        background: `radial-gradient(circle at 50% 40%, ${withAlpha(t.accent, 0.15)}, transparent 60%)`,
        filter: "blur(60px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", maxWidth: 780, margin: "0 auto" }}>
        <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? "Premium experience"}</Eyebrow>
        <H1 website={website} style={{ marginTop: 24, fontSize: clampSize(t.heroTitleSize + 8, 48, 76) }}>{headline}</H1>
        <Lead website={website} style={{ marginTop: 20, maxWidth: 600, marginLeft: "auto", marginRight: "auto" }}>{sub}</Lead>
        <div style={{ display: "flex", gap: 14, marginTop: 40, justifyContent: "center", flexWrap: "wrap" }}>
          <Button website={website} href="/contact">{copy?.primaryCta?.cta?.text ?? "Get started"}</Button>
          <Button website={website} href="/offer" variant="secondary">Explore the offer</Button>
        </div>
      </div>
    </Section>
  );
}

// ─── STACKED layout (technical, SaaS, dev tools) ────────────────────
function StackedHero({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  const copy = website.copy?.home;
  const headline = copy?.hero?.headline ?? `Welcome to ${website.branding.name}.`;
  const sub = copy?.hero?.subheadline ?? website.branding.tagline ?? "A focused solution designed for results.";

  return (
    <Section website={website} style={{ paddingTop: 80, paddingBottom: 40, position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{
        position: "absolute", top: -100, left: "50%", transform: "translateX(-50%)", width: "120%", height: 400,
        background: `radial-gradient(ellipse at center, ${withAlpha(t.accent, 0.08)}, transparent 70%)`,
        filter: "blur(40px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative" }}>
        <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? "Built for developers"}</Eyebrow>
        <H1 website={website} style={{ marginTop: 20, maxWidth: 700 }}>{headline}</H1>
        <Lead website={website} style={{ marginTop: 14 }}>{sub}</Lead>
        <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
          <Button website={website} href="/contact">{copy?.primaryCta?.cta?.text ?? "Get started"}</Button>
          <Button website={website} href="/pricing" variant="secondary">View pricing</Button>
        </div>

        {/* Code-like feature grid for technical businesses */}
        <div style={{
          marginTop: 48, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
          padding: 24, borderRadius: 16, border: `1px solid ${t.border}`,
          background: withAlpha(t.surface, 0.8), fontFamily: t.fontFamily,
        }}>
          {(copy?.valueProps?.items ?? []).slice(0, 3).map((item, i) => (
            <div key={i} style={{ padding: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: t.accent, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: t.textSecondary, lineHeight: 1.55 }}>{item.description}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`@media (max-width: 768px) { section > div > div:last-child { grid-template-columns: 1fr !important; } }`}</style>
    </Section>
  );
}

function clampSize(preferred: number, min: number, max: number) {
  return Math.max(min, Math.min(max, preferred));
}