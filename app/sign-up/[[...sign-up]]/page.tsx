/**
 * SIGN UP PAGE
 * 
 * Route: /sign-up
 * Uses Clerk's SignUp component with Zelrex branding.
 */

"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#05070B",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    }}>
      {/* Zelrex branding */}
      <div style={{ marginBottom: 32, textAlign: "center" }}>
        <svg width={120} height={36} viewBox="0 0 156 40" fill="none" style={{ display: "block", margin: "0 auto 12px" }}>
          <text x="2" y="26" fill="#E8ECF4" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="28" letterSpacing="4" fontStyle="italic">ZELREX</text>
          <rect x="2" y="29" width="140" height="6" rx="3" fill="url(#wgrad)" />
          <defs>
            <linearGradient id="wgrad" x1="2" y1="32" x2="142" y2="32" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#5FB2FF" stopOpacity="1" />
              <stop offset="30%" stopColor="#3B8CFF" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#2351A8" stopOpacity="0.45" />
              <stop offset="85%" stopColor="#172238" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, fontWeight: 500, letterSpacing: "0.04em", margin: 0 }}>
          Go independent. Get paid.
        </p>
      </div>

      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        afterSignUpUrl="/chat"
        appearance={{
          elements: {
            rootBox: { width: "100%", maxWidth: 400 },
          },
        }}
      />

      {/* Subtle background glow */}
      <div style={{
        position: "fixed", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(74,144,255,0.04) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />
    </div>
  );
}
