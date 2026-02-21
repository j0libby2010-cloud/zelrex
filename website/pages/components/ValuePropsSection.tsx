import React from "react";
import type { ZelrexWebsite } from "../../core/websiteTypes";
import type { ValuePropItem } from "../../core/websiteCopy";
import type { LayoutProfile } from "@/website/core/layoutEngine";
import { Section, Eyebrow, Card, getTheme } from "./ui";

/**
 * VALUE PROPS SECTION — 4 VISUAL VARIANTS
 * 
 * CARDS:       3-column card grid with icons. Clean, professional. (default)
 * LIST:        Left-aligned vertical list with large text. Authoritative, consulting.
 * ALTERNATING: Zig-zag layout with text + visual. Storytelling, coaching.
 * GRID:        Dense 2x3 or 3x2 grid, minimal cards. SaaS, technical.
 */

export function ValuePropsSection({ 
  website, 
  layout 
}: { 
  website: ZelrexWebsite; 
  layout?: LayoutProfile;
}) {
  const t = getTheme(website);
  const variant = layout?.sectionVariants?.["value-props"] ?? 
                  layout?.sectionVariants?.services ?? 
                  layout?.sectionVariants?.transformation ?? "cards";
  
  const items: ValuePropItem[] = website.copy?.home?.valueProps?.items?.slice(0, 6) ?? [
    { title: "Premium by default", description: "World-class spacing, typography, and layout." },
    { title: "Conversion-first", description: "A homepage that guides visitors to action." },
    { title: "Bespoke copy", description: "Text adapts to your brand voice and offer." },
    { title: "Mobile-perfect", description: "Looks sharp on every device." },
    { title: "Instant preview", description: "Live URL so you can iterate immediately." },
    { title: "Custom domain ready", description: "Move to your domain when you're happy." },
  ];

  const eyebrow = website.copy?.home?.valueProps?.eyebrow ?? "What you get";
  const title = website.copy?.home?.valueProps?.title ?? "Everything you need to convert.";
  const subtitle = website.copy?.home?.valueProps?.subtitle ?? "Each feature designed to turn visitors into customers.";

  switch (variant) {
    case "list":        return <ListVariant website={website} t={t} layout={layout} items={items} eyebrow={eyebrow} title={title} subtitle={subtitle} />;
    case "alternating": return <AlternatingVariant website={website} t={t} layout={layout} items={items} eyebrow={eyebrow} title={title} subtitle={subtitle} />;
    case "grid":        return <GridVariant website={website} t={t} layout={layout} items={items} eyebrow={eyebrow} title={title} subtitle={subtitle} />;
    default:            return <CardsVariant website={website} t={t} layout={layout} items={items} eyebrow={eyebrow} title={title} subtitle={subtitle} />;
  }
}

interface VPProps {
  website: ZelrexWebsite;
  t: any;
  layout?: LayoutProfile;
  items: ValuePropItem[];
  eyebrow: string;
  title: string;
  subtitle: string;
}

// ═══════════════════════════════════════════════════════════════════════
// CARDS — Professional 3-column grid. Stripe-like.
// ═══════════════════════════════════════════════════════════════════════

function CardsVariant({ website, t, layout, items, eyebrow, title, subtitle }: VPProps) {
  const useGlass = layout?.useGlassEffects ?? false;
  const cardBg = useGlass
    ? `linear-gradient(135deg, ${wA(t.surface, 0.6)}, ${wA(t.surface, 0.3)})`
    : t.surface;

  return (
    <Section website={website}>
      <div style={{ display: "grid", gap: 14 }}>
        <Eyebrow website={website}>{eyebrow}</Eyebrow>
        <h2 style={h2Style(t)}>{title}</h2>
        <p style={subStyle(t)}>{subtitle}</p>
      </div>

      <div style={{
        marginTop: 32, display: "grid",
        gridTemplateColumns: `repeat(${Math.min(3, items.length)}, minmax(0, 1fr))`, gap: 16,
      }}>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: 24, borderRadius: 16,
            border: `1px solid ${t.border}`,
            background: cardBg,
            backdropFilter: useGlass ? "blur(20px)" : "none",
            transition: "transform 200ms ease, box-shadow 200ms ease",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: wA(t.accent, 0.1), border: `1px solid ${wA(t.accent, 0.15)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, marginBottom: 16,
            }}>
              {["✦", "◆", "●", "▲", "◉", "✧"][i] || "✦"}
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: t.textPrimary }}>{it.title}</h3>
            <p style={{ margin: "8px 0 0", color: t.textSecondary, lineHeight: 1.6, fontSize: 14 }}>{it.description}</p>
          </div>
        ))}
      </div>

      <style>{`
        @media(max-width:900px){section>div>div+div{grid-template-columns:1fr 1fr!important}}
        @media(max-width:600px){section>div>div+div{grid-template-columns:1fr!important}}
      `}</style>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LIST — Vertical, authoritative. Consulting/professional services.
// ═══════════════════════════════════════════════════════════════════════

function ListVariant({ website, t, layout, items, eyebrow, title, subtitle }: VPProps) {
  return (
    <Section website={website}>
      <div style={{ maxWidth: 680 }}>
        <Eyebrow website={website}>{eyebrow}</Eyebrow>
        <h2 style={{ ...h2Style(t), marginTop: 16 }}>{title}</h2>
        <p style={subStyle(t)}>{subtitle}</p>
      </div>

      <div style={{ marginTop: 40 }}>
        {items.map((it, i) => (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "48px 1fr", gap: 20,
            padding: "28px 0",
            borderBottom: i < items.length - 1 ? `1px solid ${t.border}` : "none",
            alignItems: "start",
          }}>
            <div style={{
              fontSize: 15, fontWeight: 600, color: wA(t.accent, 0.5),
              fontFamily: t.fontFamily, letterSpacing: "-0.02em",
            }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: t.textPrimary, letterSpacing: "-0.02em" }}>{it.title}</h3>
              <p style={{ margin: "8px 0 0", color: t.textSecondary, lineHeight: 1.65, fontSize: 15, maxWidth: 560 }}>{it.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ALTERNATING — Zig-zag with visuals. Coaching/transformation.
// ═══════════════════════════════════════════════════════════════════════

function AlternatingVariant({ website, t, layout, items, eyebrow, title, subtitle }: VPProps) {
  return (
    <Section website={website}>
      <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <Eyebrow website={website}>{eyebrow}</Eyebrow>
        <h2 style={{ ...h2Style(t), marginTop: 16 }}>{title}</h2>
        <p style={{ ...subStyle(t), margin: "12px auto 0" }}>{subtitle}</p>
      </div>

      <div style={{ marginTop: 56 }}>
        {items.slice(0, 4).map((it, i) => {
          const isLeft = i % 2 === 0;
          return (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48,
              alignItems: "center", marginBottom: 56,
              direction: isLeft ? "ltr" : "rtl",
            }}>
              <div style={{ direction: "ltr" }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 48, height: 48, borderRadius: 14,
                  background: wA(t.accent, 0.1), border: `1px solid ${wA(t.accent, 0.15)}`,
                  fontSize: 20, marginBottom: 16,
                }}>
                  {["✦", "◆", "●", "▲"][i] || "✦"}
                </div>
                <h3 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: t.textPrimary, letterSpacing: "-0.02em" }}>{it.title}</h3>
                <p style={{ margin: "12px 0 0", color: t.textSecondary, lineHeight: 1.7, fontSize: 16, maxWidth: 420 }}>{it.description}</p>
              </div>
              
              {/* Visual placeholder — abstract decorative panel */}
              <div style={{
                direction: "ltr",
                height: 240, borderRadius: 20,
                background: `linear-gradient(${135 + i * 30}deg, ${wA(t.accent, 0.06)}, ${wA(t.surface, 0.8)})`,
                border: `1px solid ${t.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  width: 80, height: 80, borderRadius: 20,
                  background: wA(t.accent, 0.08), border: `1px solid ${wA(t.accent, 0.12)}`,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`@media(max-width:740px){section>div>div[style*="grid-template-columns"]{grid-template-columns:1fr!important;direction:ltr!important}}`}</style>
    </Section>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// GRID — Dense, compact. SaaS/technical products.
// ═══════════════════════════════════════════════════════════════════════

function GridVariant({ website, t, layout, items, eyebrow, title, subtitle }: VPProps) {
  return (
    <Section website={website}>
      <div style={{ textAlign: "center", maxWidth: 600, margin: "0 auto" }}>
        <Eyebrow website={website}>{eyebrow}</Eyebrow>
        <h2 style={{ ...h2Style(t), marginTop: 16 }}>{title}</h2>
        <p style={{ ...subStyle(t), margin: "12px auto 0" }}>{subtitle}</p>
      </div>

      <div style={{
        marginTop: 40, display: "grid",
        gridTemplateColumns: `repeat(${items.length <= 4 ? 2 : 3}, 1fr)`,
        gap: 1, borderRadius: 16, overflow: "hidden",
        border: `1px solid ${t.border}`,
      }}>
        {items.map((it, i) => (
          <div key={i} style={{
            padding: "28px 24px",
            background: wA(t.surface, 0.5),
            backdropFilter: "blur(10px)",
            borderRight: (i + 1) % (items.length <= 4 ? 2 : 3) !== 0 ? `1px solid ${t.border}` : "none",
            borderBottom: i < items.length - (items.length <= 4 ? 2 : 3) ? `1px solid ${t.border}` : "none",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: wA(t.accent, 0.1), border: `1px solid ${wA(t.accent, 0.15)}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, color: t.accent, marginBottom: 14, fontWeight: 700,
            }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.textPrimary }}>{it.title}</h3>
            <p style={{ margin: "6px 0 0", color: t.textSecondary, lineHeight: 1.55, fontSize: 13 }}>{it.description}</p>
          </div>
        ))}
      </div>

      <style>{`
        @media(max-width:640px){section>div>div+div{grid-template-columns:1fr!important}}
      `}</style>
    </Section>
  );
}

// ─── Shared styles ───────────────────────────────────────────────

function h2Style(t: any): React.CSSProperties {
  return { margin: 0, fontFamily: t.fontFamily, color: t.textPrimary, fontSize: 36, letterSpacing: "-0.03em", lineHeight: 1.1, fontWeight: t.headingWeight };
}

function subStyle(t: any): React.CSSProperties {
  return { margin: 0, marginTop: 10, color: t.textSecondary, maxWidth: 640, lineHeight: 1.65, fontSize: 16 };
}

function wA(hex: string, a: number): string {
  if (hex.includes("gradient(") || hex.startsWith("rgba(") || hex.startsWith("rgb(")) return hex;
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) return hex;
  const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
  return `rgba(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)}, ${a})`;
}
