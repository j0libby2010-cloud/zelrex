"use client";
import React, { useState } from "react";
import { ZelrexWebsite } from "../../core/websiteTypes";
import { resolveTheme } from "../../theme/themes";

// ─── Theme helper (now applies branding colors) ─────────────────────
export function getTheme(website: ZelrexWebsite) {
  return resolveTheme(website.theme, website.branding);
}

// ─── Layout variant helper ──────────────────────────────────────────
// Determines layout variations based on business type for visual variety
export type HeroLayout = "split" | "centered" | "stacked";

export function getHeroLayout(website: ZelrexWebsite): HeroLayout {
  const biz = (website as any).businessContext?.businessType?.toLowerCase?.() ?? "";
  const tone = website.branding.tone?.toLowerCase?.() ?? "";

  // Luxury/premium → centered (dramatic, focused)
  if (tone === "luxury" || biz.includes("luxury") || biz.includes("premium") || biz.includes("executive")) {
    return "centered";
  }
  // Technical/SaaS → stacked (information-dense, structured)
  if (tone === "technical" || biz.includes("saas") || biz.includes("software") || biz.includes("tech") || biz.includes("api") || biz.includes("dev")) {
    return "stacked";
  }
  // Coaching/wellness/personal → centered (open, warm, focused)
  if (biz.includes("coach") || biz.includes("wellness") || biz.includes("fitness") || biz.includes("health") || biz.includes("personal")) {
    return "centered";
  }
  // Default: split (two-column, professional)
  return "split";
}

// ─── Link helper ────────────────────────────────────────────────────
export function siteHref(website: ZelrexWebsite, path: string): string {
  if (path.startsWith("http") || path.startsWith("mailto:") || path.startsWith("#")) {
    return path;
  }
  const clean = path.startsWith("/") ? path.slice(1) : path;
  if (clean === "" || clean === "home") {
    return `/s/${website.id}`;
  }
  return `/s/${website.id}/${clean}`;
}

// ─── Container ──────────────────────────────────────────────────────
export function Container({
  children,
  website,
  style,
}: {
  children: React.ReactNode;
  website: ZelrexWebsite;
  style?: React.CSSProperties;
}) {
  const t = getTheme(website);
  return (
    <div style={{ maxWidth: t.maxWidth, margin: "0 auto", padding: `0 ${Math.max(20, t.pagePadding)}px`, ...style }}>
      {children}
    </div>
  );
}

// ─── Section ────────────────────────────────────────────────────────
export function Section({
  children,
  website,
  style,
  id,
}: {
  children: React.ReactNode;
  website: ZelrexWebsite;
  style?: React.CSSProperties;
  id?: string;
}) {
  const t = getTheme(website);
  return (
    <section id={id} style={{ padding: `${Math.max(56, Math.floor(t.sectionGap * 0.75))}px 0`, ...style }}>
      <Container website={website}>{children}</Container>
    </section>
  );
}

// ─── Eyebrow ────────────────────────────────────────────────────────
export function Eyebrow({ children, website }: { children: React.ReactNode; website: ZelrexWebsite }) {
  const t = getTheme(website);
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: "6px 14px", borderRadius: 999,
      border: `1px solid ${t.border}`,
      background: "transparent",
      color: t.textSecondary, fontSize: 11, letterSpacing: "0.1em",
      textTransform: "uppercase", fontWeight: 600,
    }}>
      {children}
    </div>
  );
}

// ─── H1 ─────────────────────────────────────────────────────────────
export function H1({ children, website, style }: { children: React.ReactNode; website: ZelrexWebsite; style?: React.CSSProperties }) {
  const t = getTheme(website);
  return (
    <h1 style={{
      margin: 0, fontFamily: t.fontFamily, fontWeight: t.headingWeight,
      letterSpacing: "-0.04em", lineHeight: 1.05,
      fontSize: clamp(t.heroTitleSize, 40, 72), color: t.textPrimary, ...style,
    }}>
      {children}
    </h1>
  );
}

// ─── H2 ─────────────────────────────────────────────────────────────
export function H2({ children, website, style }: { children: React.ReactNode; website: ZelrexWebsite; style?: React.CSSProperties }) {
  const t = getTheme(website);
  return (
    <h2 style={{
      margin: 0, fontFamily: t.fontFamily, fontWeight: t.headingWeight,
      letterSpacing: "-0.03em", lineHeight: 1.1, fontSize: 34, color: t.textPrimary, ...style,
    }}>
      {children}
    </h2>
  );
}

// ─── Lead ───────────────────────────────────────────────────────────
export function Lead({ children, website, style }: { children: React.ReactNode; website: ZelrexWebsite; style?: React.CSSProperties }) {
  const t = getTheme(website);
  return (
    <p style={{
      margin: 0, marginTop: 14, maxWidth: 680, fontFamily: t.fontFamily,
      fontWeight: t.bodyWeight, color: t.textSecondary, lineHeight: 1.65,
      fontSize: clamp(t.heroSubtitleSize, 16, 21), ...style,
    }}>
      {children}
    </p>
  );
}

// ─── Button ─────────────────────────────────────────────────────────
export function Button({
  children, website, href, onClick, variant = "primary", style,
}: {
  children: React.ReactNode; website: ZelrexWebsite; href?: string;
  onClick?: () => void; variant?: "primary" | "secondary"; style?: React.CSSProperties;
}) {
  const t = getTheme(website);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const base: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    gap: 10, height: t.button.height, padding: "0 24px",
    borderRadius: t.button.radius, fontFamily: t.fontFamily, fontWeight: 600,
    fontSize: 14, textDecoration: "none", cursor: "pointer",
    transition: "all 220ms cubic-bezier(0.2, 0, 0, 1)",
    userSelect: "none", whiteSpace: "nowrap",
    transform: pressed ? "translateY(1px) scale(0.98)" : hovered ? "translateY(-2px)" : "none",
  };

  const primary: React.CSSProperties = {
    background: t.button.background, color: t.button.text,
    border: "1px solid rgba(255,255,255,0.1)",
    boxShadow: hovered ? `0 14px 40px ${withAlpha(t.accent, 0.35)}` : t.shadow,
  };

  const secondary: React.CSSProperties = {
    background: hovered ? withAlpha(t.textPrimary, 0.06) : "transparent",
    color: t.textPrimary,
    border: `1px solid ${hovered ? t.textSecondary : t.border}`,
    boxShadow: "none",
  };

  const merged = { ...base, ...(variant === "primary" ? primary : secondary), ...style };
  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => { setHovered(false); setPressed(false); },
    onMouseDown: () => setPressed(true),
    onMouseUp: () => setPressed(false),
  };

  const resolvedHref = href ? siteHref(website, href) : undefined;
  const arrow = (
    <span aria-hidden style={{ opacity: 0.7, transition: "transform 220ms", transform: hovered ? "translateX(4px)" : "none", fontSize: 15 }}>
      &rarr;
    </span>
  );

  if (resolvedHref) {
    return <a href={resolvedHref} style={merged} {...handlers}>{children}{arrow}</a>;
  }
  return <button onClick={onClick} style={{ ...merged, border: merged.border }} {...handlers}>{children}{arrow}</button>;
}

// ─── Card ───────────────────────────────────────────────────────────
export function Card({
  children, website, style, highlight,
}: {
  children: React.ReactNode; website: ZelrexWebsite; style?: React.CSSProperties; highlight?: boolean;
}) {
  const t = getTheme(website);
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: t.surface, borderRadius: 18, padding: 22,
        border: `1px solid ${highlight ? withAlpha(t.accent, 0.5) : hovered ? withAlpha(t.accent, 0.3) : t.border}`,
        boxShadow: hovered ? `0 24px 60px rgba(0,0,0,0.18)` : `0 8px 24px rgba(0,0,0,0.08)`,
        transition: "all 280ms cubic-bezier(0.2, 0, 0, 1)",
        transform: hovered ? "translateY(-4px)" : "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── NavLink ────────────────────────────────────────────────────────
export function NavLink({ children, website, href, active }: {
  children: React.ReactNode; website: ZelrexWebsite; href: string; active?: boolean;
}) {
  const t = getTheme(website);
  const [hovered, setHovered] = useState(false);
  const resolvedHref = siteHref(website, href);

  return (
    <a
      href={resolvedHref}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        color: active ? t.textPrimary : hovered ? t.textPrimary : t.textSecondary,
        textDecoration: "none", fontSize: 14, fontWeight: 500,
        padding: "8px 14px", borderRadius: 10,
        background: hovered ? withAlpha(t.textPrimary, 0.06) : "transparent",
        transition: "all 180ms ease",
      }}
    >
      {children}
    </a>
  );
}

// ─── Accent text (for highlighted words) ────────────────────────────
export function Accent({ children, website }: { children: React.ReactNode; website: ZelrexWebsite }) {
  const t = getTheme(website);
  return <span style={{ color: t.accent }}>{children}</span>;
}

// ─── Divider ────────────────────────────────────────────────────────
export function Divider({ website }: { website: ZelrexWebsite }) {
  const t = getTheme(website);
  return <div style={{ height: 1, background: t.border, margin: "0 auto", maxWidth: t.maxWidth * 0.6 }} />;
}

// ─── Utilities ──────────────────────────────────────────────────────
export function withAlpha(hexOrRgb: string, a: number) {
  if (hexOrRgb.includes("gradient(") || hexOrRgb.startsWith("rgba(") || hexOrRgb.startsWith("rgb(")) return hexOrRgb;
  if (!hexOrRgb.startsWith("#") || (hexOrRgb.length !== 7 && hexOrRgb.length !== 4)) return hexOrRgb;
  const hex = hexOrRgb.length === 4
    ? `#${hexOrRgb[1]}${hexOrRgb[1]}${hexOrRgb[2]}${hexOrRgb[2]}${hexOrRgb[3]}${hexOrRgb[3]}`
    : hexOrRgb;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function clamp(preferred: number, min: number, max: number) {
  return Math.max(min, Math.min(max, preferred));
}
