"use client";
import React, { useState } from "react";
import type { ZelrexWebsite } from "../core/websiteTypes";
import { resolveTheme } from "./themes";
import { NavLink, withAlpha, siteHref } from "../pages/components/ui";

export function Header({ website }: { website: ZelrexWebsite }) {
  const theme = resolveTheme(website.theme, website.branding);
  const [menuOpen, setMenuOpen] = useState(false);

  const bgColor = theme.background.includes("gradient") ? "#020617" : theme.background;

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Offer", href: "/offer" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: withAlpha(bgColor, 0.88),
      backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      borderBottom: `1px solid ${theme.border}`,
    }}>
      <div style={{
        maxWidth: theme.maxWidth, margin: "0 auto",
        padding: `0 ${theme.pagePadding}px`, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <a href={siteHref(website, "/")} style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none", color: theme.textPrimary,
          fontWeight: 700, fontSize: 16, fontFamily: theme.fontFamily,
        }}>
          {website.branding.name}
        </a>

        <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="desktop-nav">
          {navItems.map((item) => (
            <NavLink key={item.href} website={website} href={item.href}>{item.label}</NavLink>
          ))}
        </nav>

        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="mobile-menu-btn"
          style={{
            display: "none", background: "none",
            border: `1px solid ${theme.border}`, borderRadius: 10,
            padding: "8px 12px", cursor: "pointer",
            color: theme.textPrimary, fontSize: 18,
          }}
          aria-label="Toggle menu"
        >
          {menuOpen ? "\u2715" : "\u2630"}
        </button>
      </div>

      {menuOpen && (
        <div className="mobile-menu" style={{
          display: "none", flexDirection: "column",
          padding: `12px ${theme.pagePadding}px 20px`,
          borderTop: `1px solid ${theme.border}`, background: bgColor,
        }}>
          {navItems.map((item) => (
            <a key={item.href} href={siteHref(website, item.href)}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block", padding: "12px 14px", borderRadius: 10,
                color: theme.textPrimary, textDecoration: "none", fontSize: 15, fontWeight: 500,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (min-width: 769px) { .desktop-nav { display: flex !important; } .mobile-menu-btn { display: none !important; } .mobile-menu { display: none !important; } }
        @media (max-width: 768px) { .desktop-nav { display: none !important; } .mobile-menu-btn { display: block !important; } .mobile-menu { display: flex !important; } }
      `}</style>
    </header>
  );
}