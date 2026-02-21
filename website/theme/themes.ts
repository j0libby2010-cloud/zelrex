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

/**
 * Resolves a theme with the user's branding colors applied.
 * The user's primaryColor becomes the accent color, and button
 * colors are derived from it. This makes every site feel branded
 * even when using the same base theme.
 */
export function resolveTheme(
  themeKey: string,
  branding?: { primaryColor?: string; secondaryColor?: string }
): ZelrexTheme {
  const base = themes[themeKey as keyof typeof themes] ?? themes.obsidian;

  if (!branding?.primaryColor) return base;

  const accent = branding.primaryColor;

  // Determine if accent is dark or light to set button text color
  const isLightAccent = isLightColor(accent);
  const buttonText = isLightAccent ? "#020617" : "#FFFFFF";

  return {
    ...base,
    accent,
    button: {
      ...base.button,
      background: accent,
      text: buttonText,
    },
  };
}

function isLightColor(hex: string): boolean {
  if (!hex.startsWith("#")) return false;
  const c = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(c.slice(1, 3), 16);
  const g = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  // Relative luminance
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}
