import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { zelrexClerkAppearance } from "@/lib/clerkAppearance";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Zelrex",
  description: "AI Business Engine for Freelancers",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Zelrex",
  },
  themeColor: "#06090F",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider appearance={zelrexClerkAppearance}>
      <html lang="en">
        <body style={{ margin: 0, padding: 0, background: "#06090F" }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
