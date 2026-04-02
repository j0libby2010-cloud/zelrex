import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zelrex · AI Business Engine",
  description: "Go independent. Get paid. Zelrex builds and runs your freelance business.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#4A90FF",
          colorBackground: "#0A0F1A",
          colorInputBackground: "#070B14",
          colorInputText: "rgba(255,255,255,0.9)",
          colorText: "rgba(255,255,255,0.9)",
          colorTextSecondary: "rgba(255,255,255,0.4)",
          colorNeutral: "rgba(255,255,255,0.45)",
          colorTextOnPrimaryBackground: "#ffffff",
          borderRadius: "0.625rem",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: "14px",
          spacingUnit: "16px",
        },
        layout: {
          socialButtonsVariant: "blockButton" as any,
          socialButtonsPlacement: "top" as any,
          shimmer: true,
        },
        elements: {
          // ─── Card (glassmorphic) ───────────────────────────────
          card: {
            backgroundColor: "rgba(8,12,22,0.75)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "20px",
            boxShadow: [
              "0 40px 100px rgba(0,0,0,0.55)",
              "0 0 0 0.5px rgba(255,255,255,0.03)",
              "inset 0 1px 0 rgba(255,255,255,0.04)",
              "inset 0 -0.5px 0 rgba(0,0,0,0.2)",
            ].join(", "),
            backdropFilter: "blur(48px) saturate(1.8)",
            WebkitBackdropFilter: "blur(48px) saturate(1.8)",
            overflow: "hidden",
          },

          // ─── Header ─────────────────────────────────────────────
          headerTitle: {
            color: "rgba(255,255,255,0.95)",
            fontWeight: "800",
            fontSize: "21px",
            letterSpacing: "-0.02em",
            lineHeight: "1.3",
          },
          headerSubtitle: {
            color: "rgba(255,255,255,0.30)",
            fontSize: "13.5px",
            fontWeight: "400",
            letterSpacing: "0.005em",
          },

          // ─── Social buttons (liquid glass) ──────────────────────
          socialButtonsBlockButton: {
            backgroundColor: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
            height: "44px",
            position: "relative" as const,
            overflow: "hidden" as const,
            transition: "all 250ms cubic-bezier(0.2,0,0,1)",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.055)",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(24px) saturate(2)",
              WebkitBackdropFilter: "blur(24px) saturate(2)",
              boxShadow: [
                "inset 0 1px 0 rgba(255,255,255,0.12)",
                "inset 0 -0.5px 0 rgba(255,255,255,0.02)",
                "0 6px 24px rgba(0,0,0,0.25)",
                "0 0 0 0.5px rgba(255,255,255,0.06)",
              ].join(", "),
              transform: "translateY(-1px)",
            },
            "&:active": {
              transform: "translateY(0.5px)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
            },
          },
          socialButtonsBlockButtonText: {
            fontSize: "13px",
            fontWeight: "600",
            color: "rgba(255,255,255,0.65)",
            letterSpacing: "0.005em",
          },
          socialButtonsProviderIcon: {
            width: "18px",
            height: "18px",
          },

          // ─── Divider ────────────────────────────────────────────
          dividerLine: {
            backgroundColor: "rgba(255,255,255,0.04)",
          },
          dividerText: {
            color: "rgba(255,255,255,0.18)",
            fontSize: "10px",
            fontWeight: "600",
            textTransform: "uppercase" as const,
            letterSpacing: "0.15em",
          },

          // ─── Form labels ────────────────────────────────────────
          formFieldLabel: {
            color: "rgba(255,255,255,0.45)",
            fontSize: "12px",
            fontWeight: "600",
            letterSpacing: "0.02em",
          },

          // ─── Inputs (liquid glass) ──────────────────────────────
          formFieldInput: {
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
            fontSize: "14px",
            height: "44px",
            color: "rgba(255,255,255,0.9)",
            transition: "all 250ms cubic-bezier(0.2,0,0,1)",
            "&:focus": {
              borderColor: "rgba(74,144,255,0.45)",
              backgroundColor: "rgba(255,255,255,0.03)",
              boxShadow: [
                "0 0 0 3px rgba(74,144,255,0.08)",
                "inset 0 0.5px 0 rgba(255,255,255,0.04)",
                "0 0 20px rgba(74,144,255,0.06)",
              ].join(", "),
            },
            "&::placeholder": {
              color: "rgba(255,255,255,0.18)",
            },
          },

          // ─── Primary button (premium glow) ─────────────────────
          formButtonPrimary: {
            backgroundColor: "#4A90FF",
            borderRadius: "12px",
            height: "44px",
            fontSize: "14px",
            fontWeight: "700",
            letterSpacing: "0.01em",
            border: "none",
            position: "relative" as const,
            overflow: "hidden" as const,
            boxShadow: [
              "0 6px 24px rgba(74,144,255,0.25)",
              "0 0 0 0.5px rgba(74,144,255,0.5)",
              "inset 0 1px 0 rgba(255,255,255,0.15)",
              "inset 0 -1px 0 rgba(0,0,0,0.1)",
            ].join(", "),
            transition: "all 250ms cubic-bezier(0.2,0,0,1)",
            "&:hover": {
              backgroundColor: "#3B82F6",
              boxShadow: [
                "0 8px 32px rgba(74,144,255,0.35)",
                "0 0 0 0.5px rgba(74,144,255,0.6)",
                "inset 0 1px 0 rgba(255,255,255,0.2)",
                "inset 0 -1px 0 rgba(0,0,0,0.1)",
                "0 0 40px rgba(74,144,255,0.12)",
              ].join(", "),
              transform: "translateY(-1px)",
            },
            "&:active": {
              transform: "translateY(0.5px)",
              boxShadow: "0 3px 12px rgba(74,144,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)",
            },
          },

          // ─── Footer ─────────────────────────────────────────────
          footerActionLink: {
            color: "#4A90FF",
            fontWeight: "600",
            fontSize: "13px",
            transition: "all 200ms",
            "&:hover": {
              color: "#6AADFF",
              textShadow: "0 0 12px rgba(74,144,255,0.3)",
            },
          },
          footerActionText: {
            color: "rgba(255,255,255,0.25)",
            fontSize: "13px",
          },

          // ─── Identity preview ───────────────────────────────────
          identityPreview: {
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "12px",
          },
          identityPreviewEditButton: {
            color: "#4A90FF",
            "&:hover": { color: "#6AADFF" },
          },

          // ─── User button popover ────────────────────────────────
          userButtonPopoverCard: {
            backgroundColor: "rgba(8,12,22,0.92)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "16px",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.04)",
            backdropFilter: "blur(40px) saturate(1.6)",
          },
          userButtonPopoverActionButton: {
            transition: "all 200ms cubic-bezier(0.2,0,0,1)",
            borderRadius: "8px",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(16px)",
            },
          },

          // ─── OTP ────────────────────────────────────────────────
          otpCodeFieldInput: {
            backgroundColor: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.05)",
            borderRadius: "10px",
            color: "rgba(255,255,255,0.9)",
            fontSize: "18px",
            fontWeight: "700",
          },

          // ─── Alerts ─────────────────────────────────────────────
          alert: {
            borderRadius: "12px",
            border: "1px solid rgba(239,68,68,0.15)",
            backgroundColor: "rgba(239,68,68,0.05)",
            backdropFilter: "blur(12px)",
          },

          // ─── Internal Clerk badges ──────────────────────────────
          badge: { display: "none" },
          footerPages: { display: "none" },
          footer: { display: "none" },
          footerAction: { display: "none" },
        },
      }}
    >
      <html lang="en">
        <body style={{ margin: 0, padding: 0, background: "#030508" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
