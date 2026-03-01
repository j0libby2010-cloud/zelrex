import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zelrex · AI Business Engine",
  description: "Go independent. Get paid. Zelrex builds and runs your freelance business.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#4A90FF",
          colorBackground: "#0A0F1A",
          colorInputBackground: "#080D17",
          colorInputText: "rgba(255,255,255,0.88)",
          colorText: "rgba(255,255,255,0.88)",
          colorTextSecondary: "rgba(255,255,255,0.45)",
          colorNeutral: "rgba(255,255,255,0.50)",
          colorTextOnPrimaryBackground: "#ffffff",
          borderRadius: "0.625rem",
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: "14px",
        },
        elements: {
          // ─── Card container ─────────────────────────────────
          card: {
            backgroundColor: "rgba(10,15,26,0.88)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(255,255,255,0.04), inset 0 0.5px 0 rgba(255,255,255,0.06)",
            backdropFilter: "blur(40px) saturate(1.6)",
            WebkitBackdropFilter: "blur(40px) saturate(1.6)",
            padding: "28px",
          },

          // ─── Header ─────────────────────────────────────────
          headerTitle: {
            color: "rgba(255,255,255,0.94)",
            fontWeight: "700",
            fontSize: "20px",
            letterSpacing: "-0.01em",
          },
          headerSubtitle: {
            color: "rgba(255,255,255,0.35)",
            fontSize: "13px",
            fontWeight: "400",
          },

          // ─── Social buttons ─────────────────────────────────
          socialButtonsBlockButton: {
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            height: "42px",
            transition: "all 200ms cubic-bezier(0.2,0,0,1)",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.08), 0 4px 16px rgba(0,0,0,0.2)",
              transform: "translateY(-0.5px)",
            },
          },
          socialButtonsBlockButtonText: {
            fontSize: "13px",
            fontWeight: "500",
            color: "rgba(255,255,255,0.7)",
          },
          socialButtonsProviderIcon: {
            width: "18px",
            height: "18px",
          },

          // ─── Divider ────────────────────────────────────────
          dividerLine: {
            backgroundColor: "rgba(255,255,255,0.05)",
          },
          dividerText: {
            color: "rgba(255,255,255,0.2)",
            fontSize: "11px",
            textTransform: "uppercase" as const,
            letterSpacing: "0.1em",
            fontWeight: "500",
          },

          // ─── Form fields ────────────────────────────────────
          formFieldLabel: {
            color: "rgba(255,255,255,0.5)",
            fontSize: "12px",
            fontWeight: "600",
            letterSpacing: "0.01em",
          },
          formFieldInput: {
            backgroundColor: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
            fontSize: "14px",
            height: "42px",
            color: "rgba(255,255,255,0.88)",
            transition: "all 200ms cubic-bezier(0.2,0,0,1)",
            "&:focus": {
              borderColor: "rgba(74,144,255,0.5)",
              boxShadow: "0 0 0 3px rgba(74,144,255,0.08), inset 0 0.5px 0 rgba(255,255,255,0.04)",
              backgroundColor: "rgba(255,255,255,0.035)",
            },
            "&::placeholder": {
              color: "rgba(255,255,255,0.2)",
            },
          },

          // ─── Primary button ─────────────────────────────────
          formButtonPrimary: {
            backgroundColor: "#4A90FF",
            borderRadius: "10px",
            height: "42px",
            fontSize: "13.5px",
            fontWeight: "700",
            letterSpacing: "0.01em",
            border: "none",
            boxShadow: "0 4px 20px rgba(74,144,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)",
            transition: "all 200ms cubic-bezier(0.2,0,0,1)",
            "&:hover": {
              backgroundColor: "#3A80EE",
              boxShadow: "0 6px 28px rgba(74,144,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
              transform: "translateY(-0.5px)",
            },
            "&:active": {
              transform: "translateY(0.5px)",
              boxShadow: "0 2px 12px rgba(74,144,255,0.2)",
            },
          },

          // ─── Footer links ──────────────────────────────────
          footerActionLink: {
            color: "#4A90FF",
            fontWeight: "600",
            fontSize: "13px",
            transition: "color 150ms",
            "&:hover": {
              color: "#6AADFF",
            },
          },
          footerActionText: {
            color: "rgba(255,255,255,0.3)",
            fontSize: "13px",
          },

          // ─── Identity preview ───────────────────────────────
          identityPreview: {
            backgroundColor: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "10px",
          },
          identityPreviewEditButton: {
            color: "#4A90FF",
          },

          // ─── User button popover ────────────────────────────
          userButtonPopoverCard: {
            backgroundColor: "rgba(10,15,26,0.92)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "14px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)",
            backdropFilter: "blur(40px) saturate(1.6)",
          },

          // ─── Alert/errors ───────────────────────────────────
          alert: {
            borderRadius: "10px",
            border: "1px solid rgba(239,68,68,0.2)",
            backgroundColor: "rgba(239,68,68,0.06)",
          },

          // ─── OTP input ──────────────────────────────────────
          otpCodeFieldInput: {
            backgroundColor: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px",
            color: "rgba(255,255,255,0.88)",
          },

          // ─── Hide Clerk branding ────────────────────────────
          footerPages: {
            display: "none",
          },
          badge: {
            display: "none",
          },
        },
      }}
    >
      <html lang="en">
        <body style={{ margin: 0, padding: 0, background: "#06090F" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
