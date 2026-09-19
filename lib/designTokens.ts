export const colors = {
  bg: { base: "#0A0F1A", inset: "#06090F", elevated: "#111A2A", hover: "rgba(255,255,255,0.07)" },
  border: { subtle: "rgba(255,255,255,0.1)", default: "rgba(255,255,255,0.18)", strong: "rgba(255,255,255,0.3)" },
  text: { primary: "rgba(255,255,255,0.88)", secondary: "rgba(255,255,255,0.5)", tertiary: "rgba(255,255,255,0.3)" },
  accent: { base: "#4A90FF", subtle: "rgba(74,144,255,0.1)" },
  success: { base: "#10B981" },
  warning: { base: "#F59E0B" },
  info: { base: "#60A5FA" },
  amber: { base: "#FBBF24" },
  danger: { base: "#EF4444", subtle: "rgba(239,68,68,0.08)" },
} as const;

export const spacing = {
  1: "4px", 2: "8px", 3: "12px", 4: "16px", 16: "64px",
} as const;

export const radius = { sm: "6px", md: "10px", full: "999px" } as const;

export const typography = {
  size: { xs: "11px", sm: "12px", base: "14px" },
  weight: { regular: 400, medium: 500, semibold: 600 },
  letterSpacing: { tight: "0", wide: "0.06em" },
  fontFamily: { sans: "var(--font-geist-sans), system-ui, sans-serif" },
} as const;

export const motion = {
  duration: { fast: "200ms" },
  ease: { out: "ease-out" },
  transition: {
    interactive: "background 200ms ease, border-color 200ms ease, color 200ms ease, opacity 200ms ease",
    background: "background 200ms ease",
    border: "border-color 200ms ease",
    color: "color 200ms ease",
    opacity: "opacity 200ms ease",
  },
} as const;

export const shadow = { md: "0 8px 32px rgba(0,0,0,0.35)" } as const;
export const layout = { navBarHeight: "81px" } as const;
