"use client";
import React, { useState, useEffect, useCallback } from "react";

interface Prospect {
  id: string;
  name: string;
  company: string;
  platform: string;
  platform_url: string;
  relevance_score: number;
  relevance_reason: string;
  status: string;
  outreach_emails?: Email[];
  created_at: string;
}

interface Email {
  id: string;
  subject: string;
  body: string;
  email_to: string;
  status: string;
  sent_at: string | null;
  replied_at: string | null;
}

interface Stats {
  discovered: number;
  queued: number;
  sent: number;
  replied: number;
  archived: number;
  replyRate: number;
}

interface Settings {
  daily_limit: number;
  tone: string;
  target_description: string;
  follow_up_days: number;
  auto_queue: boolean;
  active: boolean;
}

/* ─── Apple Liquid Glass Design System ────────────── */
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
  accentGlow: "rgba(59,130,246,0.12)",
  green: "#34D399",
  greenGlow: "rgba(52,211,153,0.10)",
  amber: "#FBBF24",
  amberGlow: "rgba(251,191,36,0.10)",
  purple: "#A78BFA",
  purpleGlow: "rgba(167,139,250,0.10)",
  red: "#F87171",
};

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

/* Apple Liquid Glass — layered depth, luminous edge, soft refraction */
const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`,
  boxShadow: `
    0 0.5px 0 0 rgba(255,255,255,0.06) inset,
    0 -0.5px 0 0 rgba(255,255,255,0.02) inset,
    0 1px 3px rgba(0,0,0,0.12),
    0 8px 40px rgba(0,0,0,0.22)
  `,
  borderRadius: 22,
};

const liquidPill: React.CSSProperties = {
  ...liquidGlass,
  borderRadius: 999,
  boxShadow: `
    0 0.5px 0 0 rgba(255,255,255,0.06) inset,
    0 1px 2px rgba(0,0,0,0.10),
    0 4px 16px rgba(0,0,0,0.14)
  `,
};

export function OutreachSystem({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"queue" | "sent" | "settings">("queue");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Settings form
  const [formTarget, setFormTarget] = useState("");
  const [formTone, setFormTone] = useState("professional");
  const [formLimit, setFormLimit] = useState(5);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const api = async (action: string, extra: any = {}) => {
    const res = await fetch("/api/z/outreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, userId, ...extra }),
    });
    return res.json();
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    const [listRes, statsRes, settingsRes] = await Promise.all([
      api("list", { status: "all" }),
      api("stats"),
      api("get-settings"),
    ]);
    setProspects(listRes.prospects || []);
    setStats(statsRes);
    if (settingsRes.settings) {
      setSettings(settingsRes.settings);
      setFormTarget(settingsRes.settings.target_description || "");
      setFormTone(settingsRes.settings.tone || "professional");
      setFormLimit(settingsRes.settings.daily_limit || 5);
    } else {
      setSetupMode(true);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async () => {
    await api("setup", { targetDescription: formTarget, tone: formTone, dailyLimit: formLimit });
    setSettings({ daily_limit: formLimit, tone: formTone, target_description: formTarget, follow_up_days: 3, auto_queue: false, active: true });
    setSetupMode(false);
  };

  const findProspects = async () => {
    setFinding(true);
    const data = await api("find");
    if (data.prospects) setProspects((p) => [...data.prospects, ...p]);
    const s = await api("stats");
    setStats(s);
    setFinding(false);
  };

  const generateEmails = async (prospectIds?: string[]) => {
    setGenerating(true);
    const data = await api("generate", { prospectIds });
    if (data.emails) {
      const listRes = await api("list", { status: "all" });
      setProspects(listRes.prospects || []);
    }
    const s = await api("stats");
    setStats(s);
    setGenerating(false);
  };

  const markSent = async (emailId: string) => {
    await api("mark-sent", { emailId });
    const [listRes, s] = await Promise.all([api("list", { status: "all" }), api("stats")]);
    setProspects(listRes.prospects || []);
    setStats(s);
  };

  const markReplied = async (emailId: string, prospectId: string) => {
    await api("mark-replied", { emailId, prospectId });
    const [listRes, s] = await Promise.all([api("list", { status: "all" }), api("stats")]);
    setProspects(listRes.prospects || []);
    setStats(s);
  };

  const archiveProspect = async (prospectId: string) => {
    await api("archive", { prospectId });
    setProspects((p) => p.filter((pr) => pr.id !== prospectId));
    const s = await api("stats");
    setStats(s);
  };

  const regenerateEmail = async (prospectId: string) => {
    setGenerating(true);
    await api("regenerate", { prospectId });
    const listRes = await api("list", { status: "all" });
    setProspects(listRes.prospects || []);
    setGenerating(false);
  };

  const openInEmail = (email: Email, prospect: Prospect) => {
    const mailto = `mailto:${email.email_to || ''}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(mailto, '_blank');
  };

  const copyEmail = (email: Email) => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
  };

  const queueProspects = prospects.filter((p) => ["discovered", "queued"].includes(p.status));
  const sentProspects = prospects.filter((p) => ["sent", "replied"].includes(p.status));

  const platformIcon = (p: string) => {
    const icons: Record<string, string> = { youtube: "▶", instagram: "◎", linkedin: "in", website: "◆", other: "●" };
    return icons[p] || "●";
  };

  const platformColor = (p: string) => {
    const colors: Record<string, string> = { youtube: "#FF0000", instagram: "#E1306C", linkedin: "#0A66C2", website: G.accent, other: G.textMuted };
    return colors[p] || G.textMuted;
  };

  const statusColor = (s: string) => {
    const colors: Record<string, string> = { discovered: G.amber, queued: G.accent, sent: G.purple, replied: G.green, archived: G.textMuted };
    return colors[s] || G.textMuted;
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: "rgba(1,2,3,0.92)",
      backdropFilter: "blur(100px) saturate(1.4) brightness(0.78)",
      WebkitBackdropFilter: "blur(100px) saturate(1.4) brightness(0.78)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: mounted ? 1 : 0,
      transition: `opacity 450ms ${EASE}`,
    }}>
      <style>{`
        @keyframes or-fadeUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes or-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes or-spin { to { transform: rotate(360deg) } }
        @keyframes or-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        @keyframes or-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* ─ Liquid glass card ─ */
        .or-card {
          position: relative;
          overflow: hidden;
          transition: transform 500ms ${EASE_SPRING}, box-shadow 500ms ${EASE_SPRING}, border-color 500ms ${EASE_SPRING};
          will-change: transform;
        }
        .or-card::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.10) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(255,255,255,0.03);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .or-card::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .or-card:hover::before, .or-card:hover::after { opacity: 1; }
        .or-card:hover {
          transform: translateY(-1px) scale(1.003) !important;
          border-color: rgba(255,255,255,0.10) !important;
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.09) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 2px 8px rgba(0,0,0,0.15),
            0 16px 48px rgba(0,0,0,0.28) !important;
        }
        .or-card > * { position: relative; z-index: 1; }

        /* ─ Liquid glass button ─ */
        .or-btn {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          border-radius: 999px;
          transition: all 500ms ${EASE_SPRING};
        }
        .or-btn::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.02) 80%, rgba(255,255,255,0.08) 100%);
          box-shadow: inset 0 0.5px 0 rgba(255,255,255,0.30);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .or-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.015) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .or-btn:hover::before, .or-btn:hover::after { opacity: 1; }
        .or-btn:hover { transform: translateY(-0.5px); }
        .or-btn:active { transform: scale(0.95); transition-duration: 120ms; }
        .or-btn > * { position: relative; z-index: 1; }

        /* ─ Liquid glass close button ─ */
        .or-close {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING} !important;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .or-close::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.12) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.04);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .or-close::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .or-close:hover::before, .or-close:hover::after { opacity: 1; }
        .or-close:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          -webkit-backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.45) !important;
          transform: translateY(-0.5px);
        }
        .or-close:active { transform: scale(0.92) translateY(0); transition-duration: 120ms; }

        /* ─ Stat card hover ─ */
        .or-stat {
          transition: transform 500ms ${EASE_SPRING}, box-shadow 500ms ${EASE_SPRING}, border-color 500ms ${EASE_SPRING};
          will-change: transform;
        }
        .or-stat:hover {
          transform: translateY(-1px) scale(1.01) !important;
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.09) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 2px 8px rgba(0,0,0,0.15),
            0 12px 40px rgba(0,0,0,0.25) !important;
          border-color: rgba(255,255,255,0.09) !important;
        }

        /* ─ Tab pill ─ */
        .or-tab {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING};
        }
        .or-tab::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.10) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(255,255,255,0.03);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .or-tab:hover::before { opacity: 1; }
        .or-tab:hover { background: rgba(255,255,255,0.04) !important; }
        .or-tab:active { transform: scale(0.95); transition-duration: 120ms; }
        .or-tab > * { position: relative; z-index: 1; }

        /* ─ Scrollbar ─ */
        .or-gs::-webkit-scrollbar { width: 5px; }
        .or-gs::-webkit-scrollbar-track { background: transparent; }
        .or-gs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 999px; }
        .or-gs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.10); }

        /* ─ Input focus ─ */
        .or-input:focus {
          border-color: rgba(59,130,246,0.35) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.08), 0 0 20px rgba(59,130,246,0.06) !important;
          outline: none;
        }

        /* ─── Mobile Responsive ─── */
        @media (max-width: 768px) {
          .or-header { flex-direction: column !important; gap: 10px !important; padding: 12px 14px !important; }
          .or-header > div:first-child { width: 100%; }
          .or-stats-bar {
            flex-wrap: nowrap !important; gap: 6px !important; padding: 8px 14px !important;
            overflow-x: auto !important; -webkit-overflow-scrolling: touch;
          }
          .or-stats-bar::-webkit-scrollbar { display: none; }
          .or-stat {
            flex: none !important; padding: 8px 14px !important; border-radius: 12px !important;
            min-width: auto !important; white-space: nowrap !important;
          }
          .or-content { padding: 12px !important; }
          .or-actions { flex-direction: column !important; }
          .or-actions button { width: 100% !important; }
          .or-email-actions { flex-wrap: wrap !important; }
          .or-email-actions button { flex: 1 !important; min-width: calc(50% - 4px) !important; padding: 8px 10px !important; }
          .or-settings-form { padding: 18px !important; }
        }
        @media (max-width: 480px) {
          .or-email-actions button { min-width: 100% !important; }
        }
      `}</style>

      {/* ─── Header ─────────────────────────────────── */}
      <div className="or-header" style={{
        padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `0.5px solid ${G.glassBorder}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 14,
            background: `linear-gradient(135deg, ${G.amber}18, ${G.amber}06)`,
            border: `0.5px solid ${G.amber}20`,
            boxShadow: `0 0 20px ${G.amber}12, 0 0 60px ${G.amber}06`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={G.amber} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.025em", fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif" }}>Outreach</div>
            <div style={{ fontSize: 12, color: G.textMuted, letterSpacing: "0.01em" }}>Find clients while you sleep</div>
          </div>
        </div>

        {/* Tabs — Sliding Glass Pill */}
        <div style={{ display: "flex", gap: 4, padding: 3, ...liquidPill, position: "relative" }}>
          {(["queue", "sent", "settings"] as const).map((t) => (
            <button key={t} className="or-tab" onClick={() => { setTab(t); setSetupMode(false); }} style={{
              padding: "7px 18px", border: "none", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
              borderRadius: 999, cursor: "pointer",
              background: tab === t ? `linear-gradient(135deg, ${G.accent}25, ${G.accent}10)` : "transparent",
              color: tab === t ? G.accentSoft : G.textSec,
              boxShadow: tab === t ? `0 0 16px ${G.accent}15, inset 0 0.5px 0 rgba(255,255,255,0.12)` : "none",
              transition: `all 400ms ${EASE_SPRING}`,
            }}>
              <span>{t}</span>
            </button>
          ))}
        </div>

        <button className="or-close" onClick={onClose} style={{
          width: 38, height: 38, borderRadius: 12,
          border: `0.5px solid ${G.glassBorder}`,
          background: G.glass, color: G.textSec,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 15, fontWeight: 300,
        }}>✕</button>
      </div>

      {/* ─── Stats Bar ──────────────────────────────── */}
      {stats && !setupMode && (
        <div className="or-stats-bar" style={{
          padding: "14px 28px", display: "flex", gap: 12,
          borderBottom: `0.5px solid ${G.glassBorder}`,
          animation: `or-fadeIn 400ms ${EASE} 200ms both`,
        }}>
          {[
            { label: "Discovered", value: stats.discovered, color: G.amber, glow: G.amberGlow },
            { label: "Queued", value: stats.queued, color: G.accent, glow: G.accentGlow },
            { label: "Sent", value: stats.sent, color: G.purple, glow: G.purpleGlow },
            { label: "Replied", value: stats.replied, color: G.green, glow: G.greenGlow },
            { label: "Reply Rate", value: `${stats.replyRate}%`, color: stats.replyRate > 10 ? G.green : G.textMuted, glow: stats.replyRate > 10 ? G.greenGlow : "rgba(255,255,255,0.04)" },
          ].map((s, i) => (
            <div key={i} className="or-stat" style={{
              ...liquidGlass, borderRadius: 16, padding: "10px 16px",
              flex: 1, display: "flex", alignItems: "center", gap: 10,
              animation: `or-fadeUp 350ms ${EASE} ${180 + i * 60}ms both`,
            }}>
              <div style={{ position: "relative" }}>
                <div style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
                <div style={{ position: "absolute", inset: -3, borderRadius: 999, background: s.color, opacity: 0.25, filter: "blur(4px)" }} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: G.textMuted, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 15, color: G.text, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Content ────────────────────────────────── */}
      <div className="or-gs or-content" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{
              width: 44, height: 44, borderRadius: 999,
              border: `2px solid ${G.glassBorder}`, borderTopColor: G.amber,
              animation: "or-spin 1s linear infinite",
              boxShadow: `0 0 20px ${G.amber}15`,
            }} />
          </div>
        ) : setupMode || tab === "settings" ? (
          /* ─── Settings / Setup ────────────────────── */
          <div style={{ maxWidth: 580, margin: "0 auto", animation: `or-fadeUp 400ms ${EASE} 100ms both` }}>
            <div className="or-settings-form" style={{ ...liquidGlass, padding: 32 }}>
              <div style={{
                fontSize: 20, fontWeight: 700, color: G.text, marginBottom: 6,
                letterSpacing: "-0.025em",
                fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
              }}>
                {settings ? "Outreach Settings" : "Set Up Outreach"}
              </div>
              <div style={{ fontSize: 13, color: G.textMuted, marginBottom: 28, lineHeight: 1.6 }}>
                {settings ? "Adjust how Zelrex finds and contacts prospects." : "Tell Zelrex who your ideal clients are and how to reach them."}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                <div style={{ animation: `or-fadeUp 350ms ${EASE} 200ms both` }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 8, display: "block", letterSpacing: "0.02em" }}>Who is your ideal client?</label>
                  <textarea className="or-input" value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="e.g., YouTube creators with 10k-100k subscribers who post weekly but have inconsistent editing quality" style={{
                    width: "100%", padding: "14px 16px", borderRadius: 16,
                    border: `0.5px solid ${G.glassBorder}`,
                    background: "rgba(255,255,255,0.025)",
                    color: G.text, fontSize: 13, lineHeight: 1.7, resize: "vertical", minHeight: 90,
                    transition: `all 400ms ${EASE}`,
                    fontFamily: "-apple-system, 'SF Pro Text', BlinkMacSystemFont, sans-serif",
                  }} />
                </div>

                <div style={{ animation: `or-fadeUp 350ms ${EASE} 280ms both` }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 8, display: "block", letterSpacing: "0.02em" }}>Email tone</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["professional", "casual", "bold"].map((t) => (
                      <button key={t} className="or-btn" onClick={() => setFormTone(t)} style={{
                        padding: "9px 20px", border: `0.5px solid ${formTone === t ? G.accent + "40" : G.glassBorder}`,
                        background: formTone === t ? `linear-gradient(135deg, ${G.accent}18, ${G.accent}06)` : G.glass,
                        color: formTone === t ? G.accentSoft : G.textSec, fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                        boxShadow: formTone === t ? `0 0 12px ${G.accent}10` : "none",
                      }}>
                        <span>{t}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ animation: `or-fadeUp 350ms ${EASE} 360ms both` }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 8, display: "block", letterSpacing: "0.02em" }}>Daily prospect limit</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[3, 5, 10].map((n) => (
                      <button key={n} className="or-btn" onClick={() => setFormLimit(n)} style={{
                        padding: "9px 20px", border: `0.5px solid ${formLimit === n ? G.accent + "40" : G.glassBorder}`,
                        background: formLimit === n ? `linear-gradient(135deg, ${G.accent}18, ${G.accent}06)` : G.glass,
                        color: formLimit === n ? G.accentSoft : G.textSec, fontSize: 12, fontWeight: 700,
                        boxShadow: formLimit === n ? `0 0 12px ${G.accent}10` : "none",
                      }}>
                        <span>{n}/day</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button className="or-btn" onClick={saveSettings} style={{
                  padding: "13px 28px", border: "none", marginTop: 10,
                  background: `linear-gradient(135deg, ${G.green}22, ${G.green}08)`,
                  color: G.green, fontSize: 14, fontWeight: 700,
                  boxShadow: `0 0 20px ${G.green}12, inset 0 0.5px 0 rgba(255,255,255,0.10)`,
                  animation: `or-fadeUp 350ms ${EASE} 440ms both`,
                  letterSpacing: "-0.01em",
                }}>
                  <span>{settings ? "Save Settings" : "Start Finding Clients"}</span>
                </button>
              </div>
            </div>
          </div>
        ) : tab === "queue" ? (
          /* ─── Queue Tab ───────────────────────────── */
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            {/* Action buttons */}
            <div className="or-actions" style={{ display: "flex", gap: 10, marginBottom: 22, animation: `or-fadeUp 350ms ${EASE} 100ms both` }}>
              <button className="or-btn" onClick={findProspects} disabled={finding} style={{
                padding: "11px 22px", border: "none",
                background: `linear-gradient(135deg, ${G.amber}20, ${G.amber}06)`,
                color: G.amber, fontSize: 13, fontWeight: 700, opacity: finding ? 0.55 : 1,
                boxShadow: `0 0 16px ${G.amber}10, inset 0 0.5px 0 rgba(255,255,255,0.08)`,
                letterSpacing: "-0.01em",
              }}>
                <span>{finding ? "Finding..." : "Find New Prospects"}</span>
              </button>
              {queueProspects.some((p) => p.status === "discovered") && (
                <button className="or-btn" onClick={() => generateEmails()} disabled={generating} style={{
                  padding: "11px 22px", border: "none",
                  background: `linear-gradient(135deg, ${G.accent}20, ${G.accent}06)`,
                  color: G.accentSoft, fontSize: 13, fontWeight: 700, opacity: generating ? 0.55 : 1,
                  boxShadow: `0 0 16px ${G.accent}10, inset 0 0.5px 0 rgba(255,255,255,0.08)`,
                  letterSpacing: "-0.01em",
                }}>
                  <span>{generating ? "Writing Emails..." : "Generate Emails"}</span>
                </button>
              )}
            </div>

            {queueProspects.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 40px", color: G.textMuted,
                animation: `or-fadeUp 400ms ${EASE} 200ms both`,
              }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 22, margin: "0 auto 22px",
                  background: `linear-gradient(135deg, ${G.amber}14, ${G.amber}04)`,
                  border: `0.5px solid ${G.amber}18`,
                  boxShadow: `0 0 30px ${G.amber}10, 0 0 60px ${G.amber}05`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={G.amber} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 700, color: G.text, marginBottom: 8,
                  letterSpacing: "-0.025em",
                  fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
                }}>No prospects yet</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>
                  Click &ldquo;Find New Prospects&rdquo; to discover potential clients based on your business.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {queueProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  const isExpanded = expandedId === p.id;
                  return (
                    <div key={p.id} className="or-card" onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{
                      ...liquidGlass, padding: 20, cursor: "pointer",
                      animation: `or-fadeUp 350ms ${EASE} ${120 + i * 50}ms both`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: `${platformColor(p.platform)}12`,
                            border: `0.5px solid ${platformColor(p.platform)}20`,
                            boxShadow: `0 0 12px ${platformColor(p.platform)}08`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, color: platformColor(p.platform), fontWeight: 700,
                          }}>
                            {platformIcon(p.platform)}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.01em" }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 1 }}>{p.company} · {p.platform}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            padding: "4px 12px", borderRadius: 999,
                            background: `${statusColor(p.status)}12`,
                            border: `0.5px solid ${statusColor(p.status)}20`,
                            fontSize: 11, fontWeight: 600, color: statusColor(p.status),
                            textTransform: "capitalize", letterSpacing: "0.02em",
                          }}>
                            {p.status}
                          </div>
                          <div style={{
                            fontSize: 12, color: G.textMuted, fontWeight: 600,
                            background: `rgba(255,255,255,0.03)`, padding: "3px 8px", borderRadius: 8,
                          }}>{p.relevance_score}%</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: G.textSec, marginTop: 10, lineHeight: 1.6 }}>{p.relevance_reason}</div>

                      {isExpanded && email && (
                        <div style={{
                          marginTop: 16, padding: 18, borderRadius: 16,
                          background: "linear-gradient(165deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)",
                          border: `0.5px solid ${G.glassBorder}`,
                          boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.04)",
                          animation: `or-fadeUp 250ms ${EASE}`,
                        }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: G.accentSoft, marginBottom: 6, letterSpacing: "-0.01em" }}>Subject: {email.subject}</div>
                          <div style={{ fontSize: 13, color: G.textSec, lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: 16 }}>{email.body}</div>
                          <div className="or-email-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="or-btn" onClick={() => { openInEmail(email, p); markSent(email.id); }} style={{
                              padding: "9px 18px", border: "none",
                              background: `linear-gradient(135deg, ${G.green}20, ${G.green}06)`,
                              color: G.green, fontSize: 12, fontWeight: 700,
                              boxShadow: `0 0 12px ${G.green}08`,
                            }}><span>Open in Email ↗</span></button>
                            <button className="or-btn" onClick={() => copyEmail(email)} style={{
                              padding: "9px 18px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.textSec, fontSize: 12, fontWeight: 600,
                            }}><span>Copy</span></button>
                            <button className="or-btn" onClick={() => regenerateEmail(p.id)} style={{
                              padding: "9px 18px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.textSec, fontSize: 12, fontWeight: 600,
                            }}><span>Rewrite</span></button>
                            <button className="or-btn" onClick={() => archiveProspect(p.id)} style={{
                              padding: "9px 18px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.red, fontSize: 12, fontWeight: 600,
                            }}><span>Skip</span></button>
                          </div>
                        </div>
                      )}

                      {isExpanded && !email && p.status === "discovered" && (
                        <div style={{ marginTop: 16, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <button className="or-btn" onClick={() => generateEmails([p.id])} disabled={generating} style={{
                            padding: "9px 22px", border: "none",
                            background: `linear-gradient(135deg, ${G.accent}20, ${G.accent}06)`,
                            color: G.accentSoft, fontSize: 12, fontWeight: 700,
                            boxShadow: `0 0 12px ${G.accent}08`,
                          }}><span>{generating ? "Writing..." : "Write Email"}</span></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ─── Sent Tab ────────────────────────────── */
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            {sentProspects.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 40px", color: G.textMuted,
                animation: `or-fadeUp 400ms ${EASE} 200ms both`,
              }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 22, margin: "0 auto 22px",
                  background: `linear-gradient(135deg, ${G.purple}14, ${G.purple}04)`,
                  border: `0.5px solid ${G.purple}18`,
                  boxShadow: `0 0 30px ${G.purple}10`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" stroke={G.purple} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{
                  fontSize: 19, fontWeight: 700, color: G.text, marginBottom: 8,
                  letterSpacing: "-0.025em",
                  fontFamily: "-apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif",
                }}>No sent emails yet</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, maxWidth: 380, margin: "0 auto" }}>
                  Find prospects and send your first outreach emails.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sentProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  return (
                    <div key={p.id} className="or-card" style={{
                      ...liquidGlass, padding: 20,
                      animation: `or-fadeUp 350ms ${EASE} ${120 + i * 50}ms both`,
                      borderLeft: `2.5px solid ${p.status === "replied" ? G.green : G.purple}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.01em" }}>{p.name} — {p.company}</div>
                          <div style={{ fontSize: 12, color: G.textMuted, marginTop: 3 }}>{email?.subject || "No subject"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            padding: "4px 12px", borderRadius: 999,
                            background: `${statusColor(p.status)}12`,
                            border: `0.5px solid ${statusColor(p.status)}20`,
                            fontSize: 11, fontWeight: 600, color: statusColor(p.status),
                            textTransform: "capitalize", letterSpacing: "0.02em",
                          }}>
                            {p.status}
                          </div>
                          {p.status === "sent" && email && (
                            <button className="or-btn" onClick={() => markReplied(email.id, p.id)} style={{
                              padding: "6px 14px", border: `0.5px solid ${G.green}25`,
                              background: `linear-gradient(135deg, ${G.green}15, ${G.green}05)`,
                              color: G.green, fontSize: 11, fontWeight: 700,
                              boxShadow: `0 0 10px ${G.green}08`,
                            }}><span>Mark Replied</span></button>
                          )}
                        </div>
                      </div>
                      {email?.sent_at && (
                        <div style={{ fontSize: 11, color: G.textMuted, marginTop: 8, letterSpacing: "0.01em" }}>
                          Sent {new Date(email.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          {email.replied_at && ` · Replied ${new Date(email.replied_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}