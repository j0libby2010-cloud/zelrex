import type { ReactNode } from "react";
import type { ZelrexWebsite } from "../core/websiteTypes";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { resolveTheme } from "./themes";

export function BasePage({
  website,
  children,
}: {
  website: ZelrexWebsite;
  children: ReactNode;
}) {
  const theme = resolveTheme(website.theme, website.branding);

  // Determine safe background (handle potential gradients in Aura theme)
  const bgColor = theme.background.includes("gradient") ? "#020617" : theme.background;

  return (
    <div
      style={{
        background: theme.background,
        color: theme.textPrimary,
        fontFamily: theme.fontFamily,
        fontWeight: theme.bodyWeight,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          scroll-behavior: smooth;
        }
        body {
          margin: 0; padding: 0;
          background: ${bgColor};
          color: ${theme.textPrimary};
          font-family: ${theme.fontFamily};
          line-height: 1.6;
        }
        a { color: inherit; text-decoration: none; }
        img { max-width: 100%; height: auto; }
        ::selection { background: ${theme.accent}; color: ${theme.background.includes("gradient") ? "#fff" : bgColor}; }

        /* Google Fonts - Inter for most themes, JetBrains Mono for Carbon */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');
      `}</style>

      <Header website={website} />

      <main style={{ flex: 1, width: "100%" }}>
        {children}
      </main>

      <Footer website={website} />
    </div>
  );
}
