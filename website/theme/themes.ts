import { ZelrexTheme } from "./themeTypes";

/* 1. OBSIDIAN — Default, Stripe-tier */
const obsidian: ZelrexTheme = {
  name: "Obsidian",

  background: "#05070B",
  surface: "#0B0F1A",
  textPrimary: "#F8FAFC",
  textSecondary: "#94A3B8",
  accent: "#3B82F6",
  border: "#1E293B",

  fontFamily: "Inter, system-ui, sans-serif",
  headingWeight: 600,
  bodyWeight: 400,

  maxWidth: 1200,
  pagePadding: 32,
  sectionGap: 96,

  heroTitleSize: 56,
  heroSubtitleSize: 18,

  button: {
    background: "#3B82F6",
    text: "#FFFFFF",
    radius: 14,
    height: 52,
  },

  shadow: "0 20px 60px rgba(0,0,0,0.6)",
};

/* 2. IVORY — Apple / Notion */
const ivory: ZelrexTheme = {
  name: "Ivory",

  background: "#FFFFFF",
  surface: "#F8FAFC",
  textPrimary: "#0F172A",
  textSecondary: "#475569",
  accent: "#2563EB",
  border: "#E5E7EB",

  fontFamily: "Inter, system-ui, sans-serif",
  headingWeight: 600,
  bodyWeight: 400,

  maxWidth: 1200,
  pagePadding: 32,
  sectionGap: 96,

  heroTitleSize: 54,
  heroSubtitleSize: 18,

  button: {
    background: "#2563EB",
    text: "#FFFFFF",
    radius: 12,
    height: 52,
  },

  shadow: "0 12px 40px rgba(2,6,23,0.08)",
};

/* 3. CARBON — Technical / Infra */
const carbon: ZelrexTheme = {
  name: "Carbon",

  background: "#000000",
  surface: "#0A0A0A",
  textPrimary: "#E5E7EB",
  textSecondary: "#9CA3AF",
  accent: "#22D3EE",
  border: "#1F2937",

  fontFamily: "JetBrains Mono, Inter, system-ui, monospace",
  headingWeight: 500,
  bodyWeight: 400,

  maxWidth: 1180,
  pagePadding: 28,
  sectionGap: 88,

  heroTitleSize: 52,
  heroSubtitleSize: 17,

  button: {
    background: "#22D3EE",
    text: "#020617",
    radius: 10,
    height: 48,
  },

  shadow: "0 10px 40px rgba(0,0,0,0.8)",
};

/* 4. AURA — Luxury / Brand */
const aura: ZelrexTheme = {
  name: "Aura",

  background: "linear-gradient(180deg, #020617, #020617)",
  surface: "linear-gradient(135deg, #1E1B4B, #020617)",
  textPrimary: "#F8FAFC",
  textSecondary: "#CBD5F5",
  accent: "#A78BFA",
  border: "#312E81",

  fontFamily: "Inter, system-ui, sans-serif",
  headingWeight: 650,
  bodyWeight: 400,

  maxWidth: 1100,
  pagePadding: 36,
  sectionGap: 120,

  heroTitleSize: 64,
  heroSubtitleSize: 20,

  button: {
    background: "#A78BFA",
    text: "#020617",
    radius: 999,
    height: 56,
  },

  shadow: "0 30px 80px rgba(30,27,75,0.6)",
};

/* 5. SLATE — Conservative / Trust */
const slate: ZelrexTheme = {
  name: "Slate",

  background: "#F8FAFC",
  surface: "#FFFFFF",
  textPrimary: "#020617",
  textSecondary: "#475569",
  accent: "#0F172A",
  border: "#CBD5E1",

  fontFamily: "Inter, system-ui, sans-serif",
  headingWeight: 600,
  bodyWeight: 400,

  maxWidth: 1140,
  pagePadding: 32,
  sectionGap: 80,

  heroTitleSize: 48,
  heroSubtitleSize: 17,

  button: {
    background: "#0F172A",
    text: "#FFFFFF",
    radius: 8,
    height: 48,
  },

  shadow: "0 8px 30px rgba(2,6,23,0.12)",
};

export const THEMES = {
  obsidian,
  ivory,
  carbon,
  aura,
  slate,
};
