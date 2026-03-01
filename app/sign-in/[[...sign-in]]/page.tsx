"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#030508",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: 'Inter', system-ui, -apple-system, sans-serif; box-sizing: border-box; }
        body { margin: 0; background: #030508; }

        /* ─── Cinematic entrance ──────────────────────── */
        .si-logo {
          opacity: 0;
          transform: translateY(16px) scale(0.96);
          animation: siReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) 100ms forwards;
        }
        .si-card {
          opacity: 0;
          transform: translateY(20px) scale(0.97);
          animation: siReveal 800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms forwards;
        }
        .si-footer {
          opacity: 0;
          transform: translateY(10px);
          animation: siReveal 700ms cubic-bezier(0.16, 1, 0.3, 1) 600ms forwards;
        }
        @keyframes siReveal {
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ─── Aurora background ───────────────────────── */
        .si-aurora {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .si-aurora::before {
          content: '';
          position: absolute;
          top: -40%;
          left: -20%;
          width: 140%;
          height: 100%;
          background: 
            radial-gradient(ellipse 600px 400px at 25% 20%, rgba(74,144,255,0.06), transparent),
            radial-gradient(ellipse 500px 350px at 75% 30%, rgba(99,102,241,0.04), transparent),
            radial-gradient(ellipse 400px 300px at 50% 80%, rgba(59,130,246,0.03), transparent);
          animation: auroraShift 12s ease-in-out infinite alternate;
        }
        @keyframes auroraShift {
          0% { transform: translateX(0) translateY(0) rotate(0deg); }
          100% { transform: translateX(30px) translateY(-20px) rotate(1deg); }
        }

        /* ─── Noise grain ─────────────────────────────── */
        .si-noise {
          position: fixed;
          inset: 0;
          pointer-events: none;
          opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 128px 128px;
        }

        /* ─── Radial vignette ─────────────────────────── */
        .si-vignette {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 70% 70% at 50% 45%, transparent 30%, rgba(3,5,8,0.8) 100%);
        }

        /* ─── Momentum line animation ─────────────────── */
        .si-momentum {
          height: 3px;
          width: 0;
          border-radius: 2px;
          background: linear-gradient(90deg, rgba(59,123,246,0.1), #3B7BF6, #4A90FF, #5BA0FF, rgba(91,160,255,0.1));
          animation: momentumSweep 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) 400ms forwards;
          margin: 6px auto 0;
        }
        @keyframes momentumSweep {
          0% { width: 0; opacity: 0; }
          20% { opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }

        /* ─── Dot grid ────────────────────────────────── */
        .si-dots {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.035) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 40% 45% at 50% 45%, black 0%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 40% 45% at 50% 45%, black 0%, transparent 100%);
        }

        /* ─── Bottom accent line ──────────────────────── */
        .si-accent-line {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(74,144,255,0.15), rgba(74,144,255,0.3), rgba(74,144,255,0.15), transparent);
        }
      `}</style>

      {/* Layered background */}
      <div className="si-aurora" />
      <div className="si-dots" />
      <div className="si-noise" />
      <div className="si-vignette" />
      <div className="si-accent-line" />

      {/* Logo */}
      <div className="si-logo" style={{ marginBottom: 36, textAlign: "center", position: "relative", zIndex: 2 }}>
        <div style={{ display: "inline-block" }}>
          <svg width={160} height={48} viewBox="0 0 168 46" fill="none" style={{ display: "block" }}>
            <text x="6" y="30" fill="rgba(232,236,244,0.95)" fontFamily="Inter, system-ui, sans-serif" fontWeight="900" fontSize="30" letterSpacing="6" fontStyle="italic">ZELREX</text>
          </svg>
          <div className="si-momentum" style={{ maxWidth: 152, marginLeft: 6 }} />
        </div>
      </div>

      {/* Sign-in card */}
      <div className="si-card" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 400 }}>
        <SignIn
          path="/sign-in"
          routing="path"
          signUpUrl="/sign-up"
          afterSignInUrl="/chat"
        />
      </div>

      {/* Footer */}
      <div className="si-footer" style={{ marginTop: 36, textAlign: "center", position: "relative", zIndex: 2 }}>
        <p style={{ color: "rgba(255,255,255,0.14)", fontSize: 11.5, fontWeight: 500, margin: 0, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Go independent · Get paid
        </p>
      </div>
    </div>
  );
}
