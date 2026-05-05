// website/core/themes.ts
//
// FIXED VERSION
//
// Critical fixes:
// 1. Safe hex parsing — handles invalid input without NaN propagation
// 2. WCAG-aware contrast — proper relative luminance, not just average brightness
// 3. Theme variation hooks — different per-name seeds get slightly varied themes
// 4. Type-safe theme selection — themes object validates input

import { ZelrexTheme } from "./themeTypes";

/* 1. OBSIDIAN — Dark, Stripe-tier, bold */
const obsidian: ZelrexTheme = {
  name: "Obsidian",
  background: "#05070B",
  surface: "#0B0F1A",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  accent: "#3B82F6",
  border: "#1E293B",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
  maxWidth: 1200,
  pagePadding: 32,
  sectionGap: 96,
  heroTitleSize: 60,
  heroSubtitleSize: 19,
  button: { background: "#3B82F6", text: "#FFFFFF", radius: 14, height: 52 },
  shadow: "0 20px 60px rgba(0,0,0,0.6)",
};

/* 2. IVORY — Light, Apple/Notion, clean */
const ivory: ZelrexTheme = {
  name: "Ivory",
  background: "#FFFFFF",
  surface: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  accent: "#2563EB",
  border: "#E2E8F0",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
  maxWidth: 1200,
  pagePadding: 32,
  sectionGap: 96,
  heroTitleSize: 58,
  heroSubtitleSize: 19,
  button: { background: "#2563EB", text: "#FFFFFF", radius: 12, height: 52 },
  shadow: "0 12px 40px rgba(2,6,23,0.08)",
};

/* 3. CARBON — Dark, technical, dev-focused */
const carbon: ZelrexTheme = {
  name: "Carbon",
  background: "#000000",
  surface: "#0A0A0A",
  textPrimary: "#E5E7EB",
  textSecondary: "#9CA3AF",
  accent: "#22D3EE",
  border: "#1F2937",
  fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  headingWeight: 600,
  bodyWeight: 400,
  maxWidth: 1180,
  pagePadding: 28,
  sectionGap: 88,
  heroTitleSize: 52,
  heroSubtitleSize: 17,
  button: { background: "#22D3EE", text: "#020617", radius: 10, height: 48 },
  shadow: "0 10px 40px rgba(0,0,0,0.8)",
};

/* 4. AURA — Dark premium, luxury, purple */
const aura: ZelrexTheme = {
  name: "Aura",
  background: "#020617",
  surface: "#0F0D2E",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5F5",
  accent: "#A78BFA",
  border: "#312E81",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  headingWeight: 700,
  bodyWeight: 400,
  maxWidth: 1100,
  pagePadding: 36,
  sectionGap: 120,
  heroTitleSize: 64,
  heroSubtitleSize: 20,
  button: { background: "#A78BFA", text: "#020617", radius: 999, height: 56 },
  shadow: "0 30px 80px rgba(30,27,75,0.6)",
};

/* 5. SLATE — Light, conservative, trust-focused */
const slate: ZelrexTheme = {
  name: "Slate",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#020617",
  textSecondary: "#475569",
  accent: "#0F172A",
  border: "#CBD5E1",
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  headingWeight: 600,
  bodyWeight: 400,
  maxWidth: 1140,
  pagePadding: 32,
  sectionGap: 80,
  heroTitleSize: 50,
  heroSubtitleSize: 17,
  button: { background: "#0F172A", text: "#FFFFFF", radius: 8, height: 48 },
  shadow: "0 8px 30px rgba(2,6,23,0.12)",
};

export const themes = { obsidian, ivory, carbon, aura, slate };

// ─── Hex parsing utilities ──────────────────────────────────

/**
 * Safe hex parser. Returns null for invalid input.
 */
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  if (!hex || typeof hex !== "string") return null;
  const trimmed = hex.trim();
  if (!trimmed.startsWith("#")) return null;
  
  let normalized: string;
  if (trimmed.length === 4) {
    // #abc → #aabbcc
    normalized = `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  } else if (trimmed.length === 7) {
    normalized = trimmed;
  } else {
    return null;
  }
  
  const r = parseInt(normalized.slice(1, 3), 16);
  const g = parseInt(normalized.slice(3, 5), 16);
  const b = parseInt(normalized.slice(5, 7), 16);
  
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  
  return { r, g, b };
}

/**
 * Calculate WCAG-style relative luminance (0-1).
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const sRGB = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}

/**
 * WCAG contrast ratio between two colors.
 */
function contrastRatio(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }): number {
  const l1 = relativeLuminance(c1.r, c1.g, c1.b);
  const l2 = relativeLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Pick the best button text color (white or black) for a given background.
 * Uses real WCAG contrast — picks whichever achieves higher contrast.
 * Falls back to white on parse failure (safe default for most accent colors).
 */
function bestButtonTextColor(backgroundHex: string): "#FFFFFF" | "#020617" {
  const bg = parseHex(backgroundHex);
  if (!bg) return "#FFFFFF"; // Safe fallback
  
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 2, g: 6, b: 23 };
  
  const whiteContrast = contrastRatio(bg, white);
  const blackContrast = contrastRatio(bg, black);
  
  // Prefer whichever achieves better contrast
  // If both are below 4.5 (WCAG AA), still pick the better one — it's the user's choice of color
  return whiteContrast >= blackContrast ? "#FFFFFF" : "#020617";
}

/**
 * Public: check if a hex color is "light" (luminance > 0.5).
 * Useful for backwards compatibility but the contrast check above is preferred.
 */
export function isLightColor(hex: string): boolean {
  const parsed = parseHex(hex);
  if (!parsed) return false;
  return relativeLuminance(parsed.r, parsed.g, parsed.b) > 0.5;
}

// ─── Theme variation seed ────────────────────────────────────

function nameSeed(name?: string): number {
  if (!name) return 0;
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h << 5) - h + name.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// ─── Theme resolver ───────────────────────────────────────────

/**
 * Resolves a theme with branding applied.
 *
 * FIXED:
 * - Returns valid theme even if themeKey is unknown
 * - Uses real WCAG contrast for button text color
 * - Adds slight variation per businessName so two users with same theme don't get identical sites
 */
export function resolveTheme(
  themeKey: string,
  branding?: { primaryColor?: string; secondaryColor?: string; name?: string }
): ZelrexTheme {
  // Type-safe theme lookup
  const validKeys = Object.keys(themes) as (keyof typeof themes)[];
  const safeKey = validKeys.includes(themeKey as any) ? (themeKey as keyof typeof themes) : "obsidian";
  const base = themes[safeKey];
  
  if (!branding?.primaryColor) return base;
  
  // Validate the primary color before using it
  const accentParsed = parseHex(branding.primaryColor);
  if (!accentParsed) return base;
  
  const accent = branding.primaryColor;
  const buttonText = bestButtonTextColor(accent);
  
  // Theme variation — slight tweaks based on business name seed
  // This prevents two users with same theme from getting identical sites
  const seed = nameSeed(branding.name);
  
  // Vary button radius slightly within reasonable bounds
  const radiusVariations = [
    base.button.radius,
    Math.max(4, base.button.radius - 4),
    base.button.radius + 4,
  ];
  const radius = radiusVariations[seed % radiusVariations.length];
  
  // Vary section gap slightly (creates visual rhythm differences)
  const gapVariations = [
    base.sectionGap,
    base.sectionGap - 16,
    base.sectionGap + 16,
  ];
  const sectionGap = Math.max(48, gapVariations[seed % gapVariations.length]);
  
  // Vary hero title size within ±4px
  const heroSizeVariations = [
    base.heroTitleSize,
    base.heroTitleSize - 4,
    base.heroTitleSize + 4,
  ];
  const heroTitleSize = heroSizeVariations[seed % heroSizeVariations.length];
  
  return {
    ...base,
    accent,
    sectionGap,
    heroTitleSize,
    button: {
      ...base.button,
      background: accent,
      text: buttonText,
      radius,
    },
  };
}