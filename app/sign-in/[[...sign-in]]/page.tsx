"use client";

import { SignIn } from "@clerk/nextjs";

/* ─── Apple Liquid Glass Design Tokens ────────────── */
const G = {
  bg: "#030508",
  glass: "rgba(255,255,255,0.025)",
  glassBorder: "rgba(255,255,255,0.055)",
  glassHighlight: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.52)",
  textMuted: "rgba(255,255,255,0.22)",
  accent: "#3B82F6",
  accentSoft: "#5B9BF7",
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: G.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      position: "relative",
      overflow: "hidden",
      fontFamily: "-apple-system, 'SF Pro Display', 'Inter', BlinkMacSystemFont, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { font-family: -apple-system, 'SF Pro Display', 'Inter', BlinkMacSystemFont, sans-serif; box-sizing: border-box; }
        body { margin: 0; background: ${G.bg}; }

        /* ─── Cinematic staggered entrance ─────────── */
        @keyframes si-reveal {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes si-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .si-logo    { animation: si-reveal 700ms ${EASE} 100ms both; }
        .si-card    { animation: si-reveal 700ms ${EASE} 280ms both; }
        .si-footer  { animation: si-reveal 600ms ${EASE} 520ms both; }

        /* ─── Aurora nebula ────────────────────────── */
        .si-aurora {
          position: fixed; inset: 0;
          pointer-events: none; overflow: hidden;
        }
        .si-aurora::before {
          content: '';
          position: absolute;
          top: -50%; left: -30%; width: 160%; height: 150%;
          background:
            radial-gradient(ellipse 700px 500px at 20% 15%, rgba(59,130,246,0.07), transparent),
            radial-gradient(ellipse 500px 400px at 80% 25%, rgba(99,102,241,0.045), transparent),
            radial-gradient(ellipse 600px 350px at 45% 75%, rgba(59,130,246,0.035), transparent),
            radial-gradient(ellipse 300px 300px at 65% 60%, rgba(167,139,250,0.025), transparent);
          animation: si-aurora 18s ease-in-out infinite alternate;
        }
        @keyframes si-aurora {
          0%   { transform: translate(0, 0) rotate(0deg) scale(1); }
          50%  { transform: translate(20px, -15px) rotate(0.5deg) scale(1.02); }
          100% { transform: translate(-10px, 10px) rotate(-0.3deg) scale(0.99); }
        }

        /* ─── Noise grain ─────────────────────────── */
        .si-noise {
          position: fixed; inset: 0;
          pointer-events: none; opacity: 0.02;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 128px 128px;
        }

        /* ─── Vignette ────────────────────────────── */
        .si-vignette {
          position: fixed; inset: 0;
          pointer-events: none;
          background: radial-gradient(ellipse 65% 65% at 50% 42%, transparent 20%, rgba(3,5,8,0.85) 100%);
        }

        /* ─── Dot grid ────────────────────────────── */
        .si-dots {
          position: fixed; inset: 0;
          pointer-events: none;
          background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 32px 32px;
          mask-image: radial-gradient(ellipse 35% 40% at 50% 42%, black 0%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 35% 40% at 50% 42%, black 0%, transparent 100%);
        }

        /* ─── Bottom accent line ──────────────────── */
        .si-accent-line {
          position: fixed; bottom: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent 5%, rgba(59,130,246,0.12) 25%, rgba(91,155,247,0.25) 50%, rgba(59,130,246,0.12) 75%, transparent 95%);
        }

        /* ─── Liquid glass card wrapper ───────────── */
        .si-glass-wrap {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          transition: transform 600ms ${EASE_SPRING}, box-shadow 600ms ${EASE_SPRING};
        }
        .si-glass-wrap::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.02) 80%, rgba(255,255,255,0.06) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -0.5px 0 rgba(255,255,255,0.03);
          transition: opacity 600ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 1;
        }
        .si-glass-wrap::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.015) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 600ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 1;
        }
        .si-glass-wrap:hover::before,
        .si-glass-wrap:hover::after { opacity: 1; }
        .si-glass-wrap:hover {
          transform: translateY(-2px) scale(1.003);
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.08) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.02) inset,
            0 4px 16px rgba(0,0,0,0.18),
            0 24px 64px rgba(0,0,0,0.30);
        }

        /* ─── Clerk card overrides ────────────────── */
        .cl-card,
        .cl-rootBox,
        .cl-signIn-root,
        .cl-signIn-start,
        .cl-cardBox { border-radius: 22px !important; }

        /* ─── Momentum underline ──────────────────── */
        .si-momentum {
          height: 3px; width: 0; border-radius: 2px;
          background: linear-gradient(90deg, rgba(59,130,246,0.08), #3B7BF6, #4A90FF, #5BA0FF, rgba(91,160,255,0.08));
          animation: si-sweep 1s ${EASE} 300ms forwards;
        }
        @keyframes si-sweep {
          0%   { width: 0; opacity: 0; }
          15%  { opacity: 1; }
          100% { width: 100%; opacity: 1; }
        }

        /* ─── Ambient glow behind card ────────────── */
        .si-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 420px; height: 420px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, rgba(59,130,246,0.02) 40%, transparent 70%);
          pointer-events: none;
          animation: si-fadeIn 1.2s ${EASE} 200ms both;
          filter: blur(40px);
        }
      `}</style>

      {/* Layered background */}
      <div className="si-aurora" />
      <div className="si-dots" />
      <div className="si-noise" />
      <div className="si-vignette" />
      <div className="si-accent-line" />

      {/* Logo — exact match from chat header */}
      <div className="si-logo" style={{ marginBottom: 40, textAlign: "center", position: "relative", zIndex: 2 }}>
        <div style={{ display: "inline-block" }}>
          <svg width={156 * 1.1} height={40 * 1.1} viewBox="0 0 156 40" fill="none" style={{ display: "block", marginLeft: 4 }}>
            <text x="2" y="26" fill="#E8ECF4" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="28" letterSpacing="4" fontStyle="italic">ZELREX</text>
            <rect x="2" y="29" width="140" height="6" rx="3" fill="url(#wgrad-si)" />
            <defs>
              <linearGradient id="wgrad-si" x1="2" y1="32" x2="142" y2="32" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5FB2FF" stopOpacity="1" />
                <stop offset="30%" stopColor="#3B8CFF" stopOpacity="0.85" />
                <stop offset="60%" stopColor="#2351A8" stopOpacity="0.45" />
                <stop offset="85%" stopColor="#172238" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      {/* Sign-in card — liquid glass wrapper */}
      <div className="si-card" style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 420 }}>
        <div className="si-glow" />
        <div className="si-glass-wrap" style={{
          background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
          backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
          WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
          border: `0.5px solid ${G.glassBorder}`,
          boxShadow: `
            0 0.5px 0 0 rgba(255,255,255,0.06) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.02) inset,
            0 1px 3px rgba(0,0,0,0.12),
            0 8px 40px rgba(0,0,0,0.22),
            0 0 80px rgba(59,130,246,0.04)
          `,
          padding: 2,
          position: "relative",
        }}>
          <SignIn
            path="/sign-in"
            routing="path"
            signUpUrl="/sign-up"
            afterSignInUrl="/chat"
            appearance={{
              variables: {
                colorPrimary: "#3B82F6",
                colorBackground: "rgba(8,10,16,0.95)",
                colorText: "rgba(255,255,255,0.92)",
                colorTextSecondary: "rgba(255,255,255,0.52)",
                colorInputBackground: "rgba(255,255,255,0.03)",
                colorInputText: "rgba(255,255,255,0.92)",
                borderRadius: "14px",
                fontFamily: "-apple-system, 'SF Pro Display', Inter, sans-serif",
              },
              elements: {
                card: { background: "transparent", boxShadow: "none", border: "none" },
                rootBox: { width: "100%" },
                headerTitle: { fontWeight: 700, letterSpacing: "-0.025em", fontSize: "20px" },
                headerSubtitle: { color: "rgba(255,255,255,0.40)", fontSize: "13px" },
                formButtonPrimary: {
                  background: "linear-gradient(135deg, rgba(59,130,246,0.25), rgba(59,130,246,0.10))",
                  border: "0.5px solid rgba(59,130,246,0.25)",
                  boxShadow: "0 0 20px rgba(59,130,246,0.10), inset 0 0.5px 0 rgba(255,255,255,0.10)",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  borderRadius: "999px",
                  transition: `all 500ms ${EASE_SPRING}`,
                },
                formFieldInput: {
                  background: "rgba(255,255,255,0.025)",
                  border: "0.5px solid rgba(255,255,255,0.055)",
                  borderRadius: "14px",
                  transition: `all 400ms ${EASE}`,
                },
                formFieldLabel: { fontWeight: 600, fontSize: "12px", letterSpacing: "0.02em" },
                footerActionLink: { color: "#5B9BF7", fontWeight: 600 },
                socialButtonsBlockButton: {
                  background: "rgba(255,255,255,0.025)",
                  border: "0.5px solid rgba(255,255,255,0.055)",
                  borderRadius: "14px",
                  transition: `all 400ms ${EASE}`,
                },
                dividerLine: { background: "rgba(255,255,255,0.055)" },
                dividerText: { color: "rgba(255,255,255,0.26)" },
                identityPreview: { background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.055)", borderRadius: "14px" },
                formFieldInputShowPasswordButton: { color: "rgba(255,255,255,0.40)" },
              },
            }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="si-footer" style={{ marginTop: 42, textAlign: "center", position: "relative", zIndex: 2 }}>
        <p style={{
          color: G.textMuted, fontSize: 11, fontWeight: 500, margin: 0,
          letterSpacing: "0.14em", textTransform: "uppercase",
        }}>
          Go independent · Get paid
        </p>
      </div>
    </div>
  );
}
