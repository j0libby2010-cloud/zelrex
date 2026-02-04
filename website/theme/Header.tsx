"use client";

import { useState } from "react";
import { ZelrexWebsite } from "../core/websiteTypes";

export function Header({ website }: { website: ZelrexWebsite }) {
  const [open, setOpen] = useState(false);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {website.branding.logo && (
            <img
              src={website.branding.logo}
              alt={website.branding.name}
              style={{ height: 32 }}
            />
          )}
          <strong>{website.branding.name}</strong>
        </div>

        {/* Desktop nav */}
        <div className="nav-desktop">
          {website.pages.map((p) => (
            <a key={p.slug} href={`/${p.slug}`}>
              {p.title}
            </a>
          ))}
          <a className="cta" href="/contact">
            Get started
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="nav-toggle"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <span className={open ? "line open" : "line"} />
          <span className={open ? "line open" : "line"} />
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="nav-mobile">
          {website.pages.map((p) => (
            <a key={p.slug} href={`/${p.slug}`}>
              {p.title}
            </a>
          ))}
          <a className="cta" href="/contact">
            Get started
          </a>
        </div>
      )}
    </header>
  );
}
