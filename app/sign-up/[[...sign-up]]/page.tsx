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
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
        body { margin: 0; background: #05070B; }

        .auth-wrapper {
          opacity: 0;
          transform: translateY(12px);
          animation: authIn 600ms cubic-bezier(0.16, 1, 0.3, 1) 150ms forwards;
        }
        .auth-wrapper-delay {
          opacity: 0;
          transform: translateY(12px);
          animation: authIn 600ms cubic-bezier(0.16, 1, 0.3, 1) 350ms forwards;
        }
        .auth-footer-anim {
          opacity: 0;
          animation: authIn 600ms cubic-bezier(0.16, 1, 0.3, 1) 550ms forwards;
        }
        @keyframes authIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-24px) scale(1.04); }
        }

        .auth-grid {
          position: fixed; inset: 0; pointer-events: none;
          background-image: 
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, black 10%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 50% 50% at 50% 50%, black 10%, transparent 80%);
        }
      `}</style>

      {/* Background effects */}
      <div className="auth-grid" />
      <div style={{ position: "fixed", top: "12%", left: "18%", width: 420, height: 420, borderRadius: "50%", background: "rgba(74,144,255,0.025)", filter: "blur(100px)", pointerEvents: "none", animation: "orbFloat 9s ease-in-out infinite" }} />
      <div style={{ position: "fixed", bottom: "8%", right: "12%", width: 360, height: 360, borderRadius: "50%", background: "rgba(139,92,246,0.02)", filter: "blur(100px)", pointerEvents: "none", animation: "orbFloat 11s ease-in-out infinite reverse" }} />

      {/* Logo */}
      <div className="auth-wrapper" style={{ marginBottom: 28, textAlign: "center", position: "relative", zIndex: 1 }}>
        <svg width={150} height={44} viewBox="0 0 156 42" fill="none" style={{ display: "block", margin: "0 auto" }}>
          <text x="4" y="27" fill="#E8ECF4" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="28" letterSpacing="5" fontStyle="italic">ZELREX</text>
          <rect x="4" y="31" width="142" height="4.5" rx="2.25" fill="url(#ml-su)" />
          <defs>
            <linearGradient id="ml-su" x1="4" y1="33" x2="146" y2="33" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(59,123,246,0.12)" />
              <stop offset="25%" stopColor="#3B7BF6" />
              <stop offset="50%" stopColor="#4A90FF" />
              <stop offset="75%" stopColor="#5BA0FF" />
              <stop offset="100%" stopColor="rgba(91,160,255,0.12)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Sign-up card */}
      <div className="auth-wrapper-delay" style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 400 }}>
        <SignUp
          path="/sign-up"
          routing="path"
          signInUrl="/sign-in"
          afterSignUpUrl="/chat"
        />
      </div>

      {/* Footer */}
      <div className="auth-footer-anim" style={{ marginTop: 28, textAlign: "center", position: "relative", zIndex: 1 }}>
        <p style={{ color: "rgba(255,255,255,0.18)", fontSize: 12, fontWeight: 500, margin: 0, letterSpacing: "0.04em" }}>
          Build your business. Own your future.
        </p>
      </div>
    </div>
  );
}
