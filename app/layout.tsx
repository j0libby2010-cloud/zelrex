/**
 * ROOT LAYOUT
 * 
 * Wraps the entire app with ClerkProvider for authentication.
 * This replaces your existing layout.tsx.
 */

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
          colorBackground: "#06090F",
          colorInputBackground: "#0A0F1A",
          colorInputText: "rgba(255,255,255,0.88)",
          colorText: "rgba(255,255,255,0.88)",
          colorTextSecondary: "rgba(255,255,255,0.50)",
          borderRadius: "0.75rem",
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        },
        elements: {
          card: {
            backgroundColor: "#0A0F1A",
            border: "1px solid rgba(255,255,255,0.07)",
            boxShadow: "0 32px 80px rgba(0,0,0,0.5), inset 0 0.5px 0 rgba(255,255,255,0.06)",
            backdropFilter: "blur(40px) saturate(1.6)",
          },
          headerTitle: {
            color: "rgba(255,255,255,0.92)",
            fontWeight: "800",
          },
          headerSubtitle: {
            color: "rgba(255,255,255,0.40)",
          },
          socialButtonsBlockButton: {
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            "&:hover": {
              backgroundColor: "rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px) saturate(1.8)",
            },
          },
          formButtonPrimary: {
            backgroundColor: "#4A90FF",
            boxShadow: "0 4px 16px rgba(74,144,255,0.3)",
            "&:hover": {
              backgroundColor: "#3A7FEE",
            },
          },
          footerActionLink: {
            color: "#4A90FF",
          },
          formFieldInput: {
            backgroundColor: "#080D17",
            border: "1px solid rgba(255,255,255,0.07)",
            "&:focus": {
              borderColor: "#4A90FF",
              boxShadow: "0 0 0 2px rgba(74,144,255,0.15)",
            },
          },
          identityPreview: {
            backgroundColor: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.07)",
          },
          userButtonPopoverCard: {
            backgroundColor: "#0A0F1A",
            border: "1px solid rgba(255,255,255,0.07)",
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
