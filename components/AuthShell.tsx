import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The frame around Clerk's sign-in and sign-up forms: flat app background, the
 * wordmark, and one link to the other page. Clerk's own footer is hidden app-wide,
 * so this link is the only way between the two pages.
 */
const C = { bg: "#06090F", text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)", accent: "#4A90FF" };

export default function AuthShell({
  children, tagline, switchText, switchLabel, switchHref,
}: { children: ReactNode; tagline: string; switchText: string; switchLabel: string; switchHref: string }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .auth-link{color:${C.accent};font-weight:500;text-decoration:none;transition:color 150ms cubic-bezier(0.22,1,0.36,1)}
        .auth-link:hover{color:#6AADFF}
        .auth-link:focus-visible{outline:1px solid ${C.accent};outline-offset:3px;border-radius:4px}
      `}</style>

      <svg width={172} height={44} viewBox="0 0 156 40" fill="none" role="img" aria-label="Zelrex" style={{ display: "block", marginBottom: 12 }}>
        <text x="2" y="26" fill="#E8ECF4" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="28" letterSpacing="4" fontStyle="italic">ZELREX</text>
        <rect x="2" y="29" width="140" height="6" rx="3" fill="url(#zx-auth-bar)" />
        <defs>
          <linearGradient id="zx-auth-bar" x1="2" y1="32" x2="142" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#5FB2FF" stopOpacity="1" />
            <stop offset="30%" stopColor="#3B8CFF" stopOpacity="0.85" />
            <stop offset="60%" stopColor="#2351A8" stopOpacity="0.45" />
            <stop offset="85%" stopColor="#172238" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: C.textSec }}>{tagline}</p>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", justifyContent: "center" }}>{children}</div>

      <p style={{ margin: "24px 0 0", fontSize: 13, color: C.textSec }}>
        {switchText}{" "}
        <Link href={switchHref} className="auth-link">{switchLabel}</Link>
      </p>
    </div>
  );
}
