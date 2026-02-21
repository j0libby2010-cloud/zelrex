import React from "react";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import type { LayoutProfile, HeroStyle } from "../../core/layoutEngine";
import { Section, Eyebrow, H1, Lead, Button, getTheme } from "../components/ui";

/**
 * HERO SECTION — 5 DISTINCT LAYOUTS
 * 
 * Each hero style creates a fundamentally different visual experience:
 * 
 * SPLIT:      Text left, product visual right. Professional, balanced. (Stripe-like)
 * CENTERED:   Everything centered, dramatic whitespace. Emotional, premium. (Apple-like)
 * STACKED:    Full-width headline, features grid below. Dense, technical. (Linear-like)
 * EDITORIAL:  Oversized type, tons of whitespace, minimal. (Portfolio/creative)
 * BOLD:       Giant headline overlapping elements, strong personality. (Agency)
 */

export function HeroSection({ 
  website, 
  layout 
}: { 
  website: ZelrexWebsite; 
  layout?: LayoutProfile;
}) {
  const t = getTheme(website);
  const copy = website.copy?.home;
  const heroStyle: HeroStyle = layout?.heroStyle ?? "split";

  const headline = copy?.hero?.headline ?? `Welcome to ${website.branding.name}`;
  const sub = copy?.hero?.subheadline ?? website.branding.tagline ?? "Built for results.";
  const ctaText = copy?.primaryCta?.cta?.text ?? "Get started";
  const ctaSub = copy?.primaryCta?.subtitle ?? "No commitment required.";

  switch (heroStyle) {
    case "centered":  return <HeroCentered website={website} layout={layout} t={t} headline={headline} sub={sub} ctaText={ctaText} ctaSub={ctaSub} />;
    case "stacked":   return <HeroStacked website={website} layout={layout} t={t} headline={headline} sub={sub} ctaText={ctaText} ctaSub={ctaSub} />;
    case "editorial": return <HeroEditorial website={website} layout={layout} t={t} headline={headline} sub={sub} ctaText={ctaText} ctaSub={ctaSub} />;
    case "bold":      return <HeroBold website={website} layout={layout} t={t} headline={headline} sub={sub} ctaText={ctaText} ctaSub={ctaSub} />;
    default:          return <HeroSplit website={website} layout={layout} t={t} headline={headline} sub={sub} ctaText={ctaText} ctaSub={ctaSub} />;
  }
}

// ─── Shared types ────────────────────────────────────────────────
interface HeroProps {
  website: ZelrexWebsite;
  layout?: LayoutProfile;
  t: any;
  headline: string;
  sub: string;
  ctaText: string;
  ctaSub: string;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SPLIT HERO — Stripe-like. Text left, product panel right.
//    Best for: freelance services, consulting, local services
// ═══════════════════════════════════════════════════════════════════════

function HeroSplit({ website, layout, t, headline, sub, ctaText, ctaSub }: HeroProps) {
  const copy = website.copy?.home;
  return (
    <Section website={website} style={{ paddingTop: 80, paddingBottom: 40, position: "relative", overflow: "hidden" }}>
      {/* Ambient glow */}
      <div aria-hidden style={{
        position: "absolute", inset: -300,
        background: `radial-gradient(ellipse at 15% 20%, ${wA(t.accent, 0.12)}, transparent 55%), radial-gradient(ellipse at 75% 60%, ${wA(t.accent, 0.08)}, transparent 50%)`,
        filter: "blur(60px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
        <div>
          <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? `Why ${website.branding.name}`}</Eyebrow>

          <h1 style={{
            margin: 0, marginTop: 20, fontFamily: t.fontFamily, fontWeight: t.headingWeight,
            fontSize: Math.round(t.heroTitleSize * (layout?.headlineScale ?? 1)),
            letterSpacing: "-0.04em", lineHeight: 1.04, color: t.textPrimary,
          }}>{headline}</h1>

          <p style={{
            margin: 0, marginTop: 18, maxWidth: 520, fontFamily: t.fontFamily,
            color: t.textSecondary, lineHeight: 1.65, fontSize: Math.round(t.heroSubtitleSize * (layout?.bodyScale ?? 1)),
          }}>{sub}</p>

          <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
            <Button website={website} href="/contact">{ctaText}</Button>
            <Button website={website} href="/offer" variant="secondary">See the offer</Button>
          </div>

          <p style={{ marginTop: 14, fontSize: 13, color: t.textSecondary, opacity: 0.7 }}>{ctaSub}</p>
        </div>

        {/* Product showcase panel — like Stripe's dashboard preview */}
        <div style={{
          borderRadius: 20, border: `1px solid ${t.border}`,
          background: `linear-gradient(160deg, ${wA(t.surface, 0.95)}, ${wA(t.surface, 0.7)})`,
          boxShadow: `0 40px 100px ${wA(t.accent, 0.08)}, 0 1px 0 ${wA("#fff", 0.04)} inset`,
          overflow: "hidden",
        }}>
          {/* Browser chrome */}
          <div style={{
            padding: "14px 18px", borderBottom: `1px solid ${t.border}`,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#EF4444" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#F59E0B" }} />
              <span style={{ width: 10, height: 10, borderRadius: 999, background: "#22C55E" }} />
            </div>
            <div style={{
              flex: 1, height: 28, borderRadius: 8, background: wA(t.background, 0.5),
              border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, color: t.textSecondary, letterSpacing: "0.02em",
            }}>{website.branding.name?.toLowerCase().replace(/\s+/g, "")}.com</div>
          </div>

          {/* Mock content */}
          <div style={{ padding: 24 }}>
            <div style={{ width: "60%", height: 14, borderRadius: 4, background: wA(t.textPrimary, 0.15), marginBottom: 10 }} />
            <div style={{ width: "85%", height: 10, borderRadius: 4, background: wA(t.textPrimary, 0.08), marginBottom: 6 }} />
            <div style={{ width: "70%", height: 10, borderRadius: 4, background: wA(t.textPrimary, 0.08), marginBottom: 20 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{
                  padding: 16, borderRadius: 12, border: `1px solid ${t.border}`,
                  background: wA(t.background, 0.4),
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: wA(t.accent, 0.15), marginBottom: 10 }} />
                  <div style={{ width: "80%", height: 8, borderRadius: 3, background: wA(t.textPrimary, 0.12), marginBottom: 6 }} />
                  <div style={{ width: "60%", height: 8, borderRadius: 3, background: wA(t.textPrimary, 0.06) }} />
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, height: 40, borderRadius: t.button.radius,
              background: wA(t.accent, 0.2), border: `1px solid ${wA(t.accent, 0.3)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 600, color: t.accent,
            }}>→ {ctaText}</div>
          </div>
        </div>
      </div>

      <style>{`@media(max-width:920px){section>div>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}`}</style>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. CENTERED HERO — Apple-like. Dramatic, emotional, lots of air.
//    Best for: coaching, communities, luxury brands
// ═══════════════════════════════════════════════════════════════════════

function HeroCentered({ website, layout, t, headline, sub, ctaText, ctaSub }: HeroProps) {
  const copy = website.copy?.home;
  const scale = layout?.headlineScale ?? 1.2;
  return (
    <Section website={website} style={{ paddingTop: 120, paddingBottom: 100, position: "relative", overflow: "hidden", textAlign: "center" }}>
      {/* Multi-layer gradient glow — Apple keynote feel */}
      <div aria-hidden style={{
        position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)",
        width: 900, height: 600, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${wA(t.accent, 0.18)}, transparent 65%)`,
        filter: "blur(100px)", pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: "-10%", left: "30%",
        width: 400, height: 300, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${wA(t.accent, 0.10)}, transparent 70%)`,
        filter: "blur(80px)", pointerEvents: "none",
      }} />

      <div style={{ position: "relative", maxWidth: 800, margin: "0 auto" }}>
        <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? `Why ${website.branding.name}`}</Eyebrow>

        <h1 style={{
          margin: 0, marginTop: 24, fontFamily: t.fontFamily, fontWeight: Math.min(800, t.headingWeight + 100),
          fontSize: Math.round(t.heroTitleSize * scale),
          letterSpacing: "-0.045em", lineHeight: 1.0,
          color: t.textPrimary,
          background: `linear-gradient(180deg, ${t.textPrimary}, ${wA(t.textPrimary, 0.6)})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>{headline}</h1>

        <p style={{
          margin: "24px auto 0", maxWidth: 580, fontFamily: t.fontFamily,
          color: t.textSecondary, lineHeight: 1.7, fontSize: Math.round(t.heroSubtitleSize * (layout?.bodyScale ?? 1.05)),
        }}>{sub}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 36, flexWrap: "wrap" }}>
          <Button website={website} href="/contact">{ctaText}</Button>
          <Button website={website} href="/offer" variant="secondary">Learn more</Button>
        </div>

        <p style={{ marginTop: 16, fontSize: 13, color: t.textSecondary, opacity: 0.6 }}>{ctaSub}</p>
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3. STACKED HERO — Linear-like. Dense, technical, features below.
//    Best for: SaaS, digital products, technical tools
// ═══════════════════════════════════════════════════════════════════════

function HeroStacked({ website, layout, t, headline, sub, ctaText, ctaSub }: HeroProps) {
  const copy = website.copy?.home;
  const features = copy?.valueProps?.items?.slice(0, 3) ?? [
    { title: "Fast setup", description: "Live in minutes" },
    { title: "Built to scale", description: "Grows with you" },
    { title: "No lock-in", description: "You own everything" },
  ];

  return (
    <Section website={website} style={{ paddingTop: 80, paddingBottom: 40, position: "relative", overflow: "hidden" }}>
      {/* Grid pattern background */}
      <div aria-hidden style={{
        position: "absolute", inset: 0,
        backgroundImage: `linear-gradient(${wA(t.border, 0.3)} 1px, transparent 1px), linear-gradient(90deg, ${wA(t.border, 0.3)} 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        mask: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 70%)",
        WebkitMask: "radial-gradient(ellipse at 50% 0%, black 30%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", maxWidth: 720, textAlign: "center", margin: "0 auto" }}>
        <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? "Introducing " + website.branding.name}</Eyebrow>

        <h1 style={{
          margin: 0, marginTop: 20, fontFamily: t.fontFamily, fontWeight: t.headingWeight,
          fontSize: Math.round(t.heroTitleSize * (layout?.headlineScale ?? 1)),
          letterSpacing: "-0.04em", lineHeight: 1.06, color: t.textPrimary,
        }}>{headline}</h1>

        <p style={{
          margin: "18px auto 0", maxWidth: 560, color: t.textSecondary,
          lineHeight: 1.65, fontSize: t.heroSubtitleSize,
        }}>{sub}</p>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
          <Button website={website} href="/contact">{ctaText}</Button>
          <Button website={website} href="/pricing" variant="secondary">View pricing</Button>
        </div>
      </div>

      {/* Feature cards strip below — Linear-style */}
      <div style={{
        position: "relative", marginTop: 56, display: "grid",
        gridTemplateColumns: `repeat(${features.length}, 1fr)`, gap: 1,
        borderRadius: 16, overflow: "hidden",
        border: `1px solid ${t.border}`,
      }}>
        {features.map((f: any, i: number) => (
          <div key={i} style={{
            padding: "28px 24px",
            background: wA(t.surface, 0.6),
            borderRight: i < features.length - 1 ? `1px solid ${t.border}` : "none",
            backdropFilter: "blur(20px)",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: wA(t.accent, 0.12), border: `1px solid ${wA(t.accent, 0.2)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: t.accent, marginBottom: 14,
            }}>
              {["⚡", "📈", "🔒", "🎯", "💎", "🚀"][i] || "✦"}
            </div>
            <div style={{ fontWeight: 600, fontSize: 15, color: t.textPrimary, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 14, color: t.textSecondary, lineHeight: 1.5 }}>{f.description}</div>
          </div>
        ))}
      </div>

      <style>{`@media(max-width:740px){section>div>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}`}</style>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4. EDITORIAL HERO — Portfolio-like. Giant type, max whitespace.
//    Best for: creatives, photographers, artists, writers
// ═══════════════════════════════════════════════════════════════════════

function HeroEditorial({ website, layout, t, headline, sub, ctaText }: HeroProps) {
  const scale = layout?.headlineScale ?? 1.3;
  return (
    <Section website={website} style={{ paddingTop: 140, paddingBottom: 120, position: "relative" }}>
      <div style={{ maxWidth: 900 }}>
        <h1 style={{
          margin: 0, fontFamily: t.fontFamily,
          fontWeight: Math.min(800, t.headingWeight + 150),
          fontSize: Math.min(88, Math.round(t.heroTitleSize * scale)),
          letterSpacing: "-0.05em", lineHeight: 0.95,
          color: t.textPrimary,
        }}>{headline}</h1>

        <div style={{
          marginTop: 40, display: "flex", justifyContent: "space-between",
          alignItems: "flex-end", flexWrap: "wrap", gap: 24,
        }}>
          <p style={{
            margin: 0, maxWidth: 440, color: t.textSecondary,
            lineHeight: 1.7, fontSize: Math.round(t.heroSubtitleSize * 1.05),
          }}>{sub}</p>

          <Button website={website} href="/contact">{ctaText}</Button>
        </div>

        {/* Subtle divider line */}
        <div style={{
          marginTop: 48, height: 1,
          background: `linear-gradient(90deg, ${t.border}, transparent 80%)`,
        }} />
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 5. BOLD HERO — Agency-style. Massive headline, strong personality.
//    Best for: agencies, bold brands, disruptors
// ═══════════════════════════════════════════════════════════════════════

function HeroBold({ website, layout, t, headline, sub, ctaText, ctaSub }: HeroProps) {
  const copy = website.copy?.home;
  const scale = layout?.headlineScale ?? 1.15;
  return (
    <Section website={website} style={{ paddingTop: 100, paddingBottom: 60, position: "relative", overflow: "hidden" }}>
      {/* Dramatic diagonal gradient */}
      <div aria-hidden style={{
        position: "absolute", inset: -100,
        background: `linear-gradient(135deg, ${wA(t.accent, 0.06)} 0%, transparent 40%, ${wA(t.accent, 0.04)} 100%)`,
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative" }}>
        <Eyebrow website={website}>{copy?.valueProps?.eyebrow ?? website.branding.name}</Eyebrow>

        <h1 style={{
          margin: 0, marginTop: 24, fontFamily: t.fontFamily,
          fontWeight: Math.min(900, t.headingWeight + 200),
          fontSize: Math.min(80, Math.round(t.heroTitleSize * scale)),
          letterSpacing: "-0.045em", lineHeight: 1.0,
          color: t.textPrimary,
          maxWidth: 900,
        }}>{headline}</h1>

        <div style={{
          marginTop: 32, display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: 40, alignItems: "start",
        }}>
          <div>
            <p style={{
              margin: 0, color: t.textSecondary, lineHeight: 1.7,
              fontSize: Math.round(t.heroSubtitleSize * (layout?.bodyScale ?? 1)),
              maxWidth: 480,
            }}>{sub}</p>

            <div style={{ display: "flex", gap: 12, marginTop: 28, flexWrap: "wrap" }}>
              <Button website={website} href="/contact">{ctaText}</Button>
              <Button website={website} href="/offer" variant="secondary">Our work</Button>
            </div>

            <p style={{ marginTop: 14, fontSize: 13, color: t.textSecondary, opacity: 0.6 }}>{ctaSub}</p>
          </div>

          {/* Stats panel — agencies love showing numbers */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1,
            borderRadius: 16, overflow: "hidden", border: `1px solid ${t.border}`,
          }}>
            {[
              { num: "150+", label: "Projects delivered" },
              { num: "98%", label: "Client satisfaction" },
              { num: "5x", label: "Average ROI" },
              { num: "24h", label: "Response time" },
            ].map((s, i) => (
              <div key={i} style={{
                padding: "24px 20px", background: wA(t.surface, 0.5),
                borderRight: i % 2 === 0 ? `1px solid ${t.border}` : "none",
                borderBottom: i < 2 ? `1px solid ${t.border}` : "none",
              }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: t.accent, letterSpacing: "-0.03em" }}>{s.num}</div>
                <div style={{ fontSize: 12, color: t.textSecondary, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@media(max-width:780px){section>div>div[style*="grid-template-columns"]{grid-template-columns:1fr!important}}`}</style>
    </Section>
  );
}

// ─── Utility ─────────────────────────────────────────────────────

function wA(hex: string, a: number): string {
  if (hex.includes("gradient(") || hex.startsWith("rgba(") || hex.startsWith("rgb(")) return hex;
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex;
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;
}
