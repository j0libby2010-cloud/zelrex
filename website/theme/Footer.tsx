"use client";
import React from "react";
import type { ZelrexWebsite } from "../core/websiteTypes";
import { themes } from "./themes";
import { siteHref, withAlpha } from "../pages/components/ui";

export function Footer({ website }: { website: ZelrexWebsite }) {
  const theme = themes[website.theme as keyof typeof themes] ?? themes.obsidian;

  const navItems = [
    { label: "Home", href: "/" },
    { label: "Offer", href: "/offer" },
    { label: "Pricing", href: "/pricing" },
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
  ];

  return (
    <footer
      style={{
        borderTop: `1px solid ${theme.border}`,
        padding: `40px ${theme.pagePadding}px`,
        marginTop: 40,
      }}
    >
      <div
        style={{
          maxWidth: theme.maxWidth,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            color: theme.textSecondary,
            fontSize: 14,
          }}
        >
          <span>{website.branding.name}</span>
          <span style={{ opacity: 0.5 }}>
            &middot; {new Date().getFullYear()}
          </span>
        </div>

        <nav style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {navItems.map((item) => (
            <a
              key={item.href}
              href={siteHref(website, item.href)}
              style={{
                color: theme.textSecondary,
                textDecoration: "none",
                fontSize: 13,
                padding: "4px 10px",
                borderRadius: 8,
                transition: "color 150ms",
              }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}