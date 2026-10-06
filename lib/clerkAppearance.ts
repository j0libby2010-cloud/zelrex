/**
 * One Clerk look for the whole app. app/layout.tsx passes this to
 * <ClerkProvider>, and the sign-in and sign-up pages inherit it, so they
 * cannot drift apart. The values are the same tokens the chat uses.
 */
import { dark } from "@clerk/themes";

const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  red: "#EF4444",
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const T = `150ms ${EASE}`;

export const zelrexClerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: C.accent,
    colorBackground: C.bgElevated,
    colorInputBackground: C.bgInput,
    colorInputText: C.text,
    colorText: C.text,
    colorTextSecondary: C.textSec,
    colorNeutral: "rgba(255,255,255,0.5)",
    colorTextOnPrimaryBackground: "#ffffff",
    colorDanger: C.red,
    borderRadius: "10px",
    fontFamily: "'Inter', system-ui, sans-serif",
    fontSize: "14px",
  },
  layout: {
    socialButtonsVariant: "blockButton" as const,
    socialButtonsPlacement: "top" as const,
    shimmer: false,
  },
  elements: {
    // Flat card: solid surface, one hairline border, no blur, no shadow.
    card: { backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: "16px", boxShadow: "none" },

    headerTitle: { color: C.text, fontWeight: 600, fontSize: "20px", letterSpacing: "-0.02em" },
    headerSubtitle: { color: C.textSec, fontSize: "13px", fontWeight: 400 },

    // Outlined pill, the same as the app's outlined buttons.
    socialButtonsBlockButton: {
      backgroundColor: "transparent", border: `1px solid ${C.border}`, borderRadius: "999px", height: "42px", boxShadow: "none",
      transition: `background-color ${T}, border-color ${T}`,
      "&:hover": { backgroundColor: "rgba(255,255,255,0.04)", borderColor: C.borderHover },
      "&:active": { backgroundColor: "rgba(255,255,255,0.06)" },
    },
    socialButtonsBlockButtonText: { fontSize: "13px", fontWeight: 500, color: C.text },

    dividerLine: { backgroundColor: C.border },
    dividerText: { color: C.textMuted, fontSize: "12px", fontWeight: 500 },

    formFieldLabel: { color: C.textSec, fontSize: "12px", fontWeight: 500 },

    // Same as the app's inputs: 10px radius, accent border on focus, no glow.
    formFieldInput: {
      backgroundColor: C.bgInput, border: `1px solid ${C.border}`, borderRadius: "10px", height: "42px", fontSize: "14px", color: C.text, boxShadow: "none",
      transition: `border-color ${T}`,
      "&:focus": { borderColor: C.accent, boxShadow: "none", outline: "none" },
      "&::placeholder": { color: C.textMuted },
    },
    formFieldInputShowPasswordButton: { color: C.textSec, "&:hover": { color: C.text } },

    // Same as the app's primary button: accent pill, a little brighter on hover.
    formButtonPrimary: {
      backgroundColor: C.accent, color: "#fff", border: "none", borderRadius: "999px", height: "42px", fontSize: "14px", fontWeight: 600, textTransform: "none" as const, boxShadow: "none",
      transition: `filter ${T}, transform 100ms ${EASE}`,
      "&:hover": { backgroundColor: C.accent, filter: "brightness(1.08)", boxShadow: "none", transform: "none" },
      "&:active": { filter: "brightness(0.95)", transform: "scale(0.98)" },
      "&:focus": { boxShadow: "none" },
    },

    // Links turn lighter on hover, like the rest of the app. No glow.
    footerActionLink: { color: C.accent, fontWeight: 500, "&:hover": { color: "#6AADFF", textShadow: "none" } },
    footerActionText: { color: C.textSec },
    formFieldAction: { color: C.accent, fontWeight: 500, fontSize: "12px", "&:hover": { color: "#6AADFF" } },
    identityPreview: { backgroundColor: C.bgInput, border: `1px solid ${C.border}`, borderRadius: "10px" },
    identityPreviewText: { color: C.text },
    identityPreviewEditButton: { color: C.accent, "&:hover": { color: "#6AADFF" } },

    otpCodeFieldInput: { backgroundColor: C.bgInput, border: `1px solid ${C.border}`, borderRadius: "10px", color: C.text, fontSize: "18px", fontWeight: 600 },
    formFieldErrorText: { color: C.red, fontSize: "12px" },
    alert: { borderRadius: "10px", border: "1px solid rgba(239,68,68,0.2)", backgroundColor: "rgba(239,68,68,0.06)", boxShadow: "none" },

    userButtonPopoverCard: { backgroundColor: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: "12px", boxShadow: "none" },
    userButtonPopoverActionButton: { borderRadius: "8px", transition: `background-color ${T}`, "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" } },

    // The app's own links (see AuthShell) replace Clerk's footer and branding.
    badge: { display: "none" },
    footerPages: { display: "none" },
    footer: { display: "none" },
    footerAction: { display: "none" },
  },
};
