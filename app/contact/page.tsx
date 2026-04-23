// @ts-nocheck
"use client";
import React, { useState } from "react";

const G = {
  bg: "#050709",
  glass: "rgba(255,255,255,0.025)",
  glassBorder: "rgba(255,255,255,0.055)",
  glassHighlight: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.52)",
  textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6",
  accentSoft: "#5B9BF7",
  green: "#34D399",
  red: "#F87171",
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`,
  boxShadow: `0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 -0.5px 0 0 rgba(255,255,255,0.02) inset, 0 8px 32px rgba(0,0,0,0.4)`,
  borderRadius: 20,
};

type FormData = {
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
};

export default function ContactPage() {
  const [form, setForm] = useState<FormData>({
    name: "", email: "", subject: "", category: "general", message: "",
  });
  const [honeypot, setHoneypot] = useState(""); // Hidden field — bots fill this, real users don't
  const [formStartTime] = useState(() => Date.now()); // Track how long form takes to fill (bots submit instantly)
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const categories = [
    { value: "general", label: "General Inquiry" },
    { value: "support", label: "Technical Support" },
    { value: "billing", label: "Billing & Subscription" },
    { value: "feature", label: "Feature Request" },
    { value: "bug", label: "Bug Report" },
    { value: "enterprise", label: "Enterprise / Partnership" },
  ];

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setErrorMsg("Name, email, and message are required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    // Client-side anti-bot: form submitted too quickly (bots submit instantly)
    const timeElapsed = Date.now() - formStartTime;
    if (timeElapsed < 3000) {
      // Real humans take at least a few seconds. Silently fake success to not tip off bot.
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", category: "general", message: "" });
      return;
    }

    setStatus("sending");
    setErrorMsg("");

    try {
      // AbortController with timeout — fetch shouldn't hang forever
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      const res = await fetch("/api/z/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, honeypot }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error("Failed to send");
      setStatus("sent");
      setForm({ name: "", email: "", subject: "", category: "general", message: "" });
    } catch (err: any) {
      setStatus("error");
      if (err?.name === 'AbortError') {
        setErrorMsg("Request timed out. Please try again or email support@zelrex.ai directly.");
      } else {
        setErrorMsg("Failed to send message. Please try again or email support@zelrex.ai directly.");
      }
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 16px",
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${G.glassBorder}`,
    borderRadius: 10,
    color: G.text,
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    transition: `border-color 200ms ${EASE}`,
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 6,
    fontSize: 13,
    fontWeight: 500,
    color: G.textSec,
    letterSpacing: "0.01em",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: G.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "40px 20px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif",
    }}>
      <div style={{ ...liquidGlass, maxWidth: 560, width: "100%", padding: 0, overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "32px 32px 24px",
          borderBottom: `1px solid ${G.glassBorder}`,
        }}>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 700, color: G.text,
            letterSpacing: "-0.02em",
          }}>
            Contact Zelrex
          </h1>
          <p style={{
            margin: "8px 0 0", fontSize: 14, color: G.textSec, lineHeight: 1.6,
          }}>
            Have a question, issue, or idea? We typically respond within 24 hours.
          </p>
        </div>

        {status === "sent" ? (
          <div style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: 28, margin: "0 auto 20px",
              background: "rgba(52,211,153,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
              border: `1px solid rgba(52,211,153,0.2)`,
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: G.text }}>Message Sent</h2>
            <p style={{ margin: "10px 0 24px", fontSize: 14, color: G.textSec, lineHeight: 1.6 }}>
              We'll get back to you as soon as possible. Check your email for a confirmation.
            </p>
            <button
              onClick={() => setStatus("idle")}
              style={{
                padding: "10px 24px", borderRadius: 10, border: `1px solid ${G.glassBorder}`,
                background: "rgba(255,255,255,0.04)", color: G.text, fontSize: 14,
                fontWeight: 500, cursor: "pointer", transition: `background 200ms ${EASE}`,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.07)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <div style={{ padding: "24px 32px 32px" }}>
            {/* HONEYPOT: Hidden from real users, bots often fill all inputs */}
            <input
              type="text"
              name="company_url"
              value={honeypot}
              onChange={e => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{
                position: "absolute",
                left: "-9999px",
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: "none",
              }}
            />
            {/* Name + Email row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }} className="contact-name-email">
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text" value={form.name} placeholder="Your name"
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = G.accent)}
                  onBlur={e => (e.target.style.borderColor = G.glassBorder)}
                />
              </div>
              <div>
                <label style={labelStyle}>Email *</label>
                <input
                  type="email" value={form.email} placeholder="you@company.com"
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = G.accent)}
                  onBlur={e => (e.target.style.borderColor = G.glassBorder)}
                />
              </div>
            </div>

            {/* Category */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                style={{
                  ...inputStyle,
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 14px center",
                  paddingRight: 36,
                }}
              >
                {categories.map(c => (
                  <option key={c.value} value={c.value} style={{ background: "#111", color: "#fff" }}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Subject</label>
              <input
                type="text" value={form.subject} placeholder="Brief description"
                onChange={e => setForm({ ...form, subject: e.target.value })}
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = G.accent)}
                onBlur={e => (e.target.style.borderColor = G.glassBorder)}
              />
            </div>

            {/* Message */}
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Message *</label>
              <textarea
                value={form.message} placeholder="Tell us what's on your mind..."
                onChange={e => setForm({ ...form, message: e.target.value })}
                rows={5}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 120,
                  lineHeight: 1.6,
                }}
                onFocus={e => (e.target.style.borderColor = G.accent)}
                onBlur={e => (e.target.style.borderColor = G.glassBorder)}
              />
            </div>

            {/* Error */}
            {errorMsg && (
              <div style={{
                padding: "10px 14px", borderRadius: 8, marginBottom: 16,
                background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.15)",
                color: G.red, fontSize: 13,
              }}>
                {errorMsg}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={status === "sending"}
              style={{
                width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
                background: status === "sending" ? "rgba(59,130,246,0.3)" : G.accent,
                color: "#fff", fontSize: 15, fontWeight: 600, cursor: status === "sending" ? "wait" : "pointer",
                transition: `all 200ms ${EASE}`, letterSpacing: "-0.01em",
              }}
              onMouseEnter={e => { if (status !== "sending") e.currentTarget.style.background = G.accentSoft; }}
              onMouseLeave={e => { if (status !== "sending") e.currentTarget.style.background = G.accent; }}
            >
              {status === "sending" ? "Sending..." : "Send Message"}
            </button>

            {/* Alt contact */}
            <p style={{
              margin: "16px 0 0", fontSize: 12, color: G.textMuted, textAlign: "center",
            }}>
              Or email us directly at <span style={{ color: G.textSec }}>support@zelrex.ai</span>
            </p>
          </div>
        )}
      </div>

      {/* Mobile responsive */}
      <style>{`
        @media (max-width: 480px) {
          .contact-name-email { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}