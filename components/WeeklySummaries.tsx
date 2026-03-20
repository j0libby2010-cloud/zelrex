"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────
interface SummaryMeta {
  id: string;
  week_start: string;
  week_end: string;
  analytics_snapshot: any;
  created_at: string;
}

interface SummaryFull extends SummaryMeta {
  summary_text: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Apple-grade design tokens (matching AnalyticsDashboard) ────
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
};

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

/* Smooth Apple-style spring easing */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SPRING = "cubic-bezier(0.32, 0.72, 0, 1)";

// ─── Main Component ─────────────────────────────────────────────
export function WeeklySummaries({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [summaries, setSummaries] = useState<SummaryMeta[]>([]);
  const [activeSummary, setActiveSummary] = useState<SummaryFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showList, setShowList] = useState(false);

  // Mini-chat state — persisted per summary via localStorage
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatCacheRef = useRef<Record<string, ChatMsg[]>>({});

  const uid = () => Math.random().toString(36).slice(2, 10);

  // Load chat history from localStorage for a summary
  const loadChatForSummary = (summaryId: string) => {
    if (chatCacheRef.current[summaryId]) {
      setChatMessages(chatCacheRef.current[summaryId]);
      return;
    }
    try {
      const stored = localStorage.getItem(`zelrex_sc_${summaryId}`);
      if (stored) {
        const msgs = JSON.parse(stored);
        chatCacheRef.current[summaryId] = msgs;
        setChatMessages(msgs);
        return;
      }
    } catch {}
    setChatMessages([]);
  };

  // Save chat to localStorage whenever messages change
  const saveChatForSummary = (summaryId: string, msgs: ChatMsg[]) => {
    chatCacheRef.current[summaryId] = msgs;
    try { localStorage.setItem(`zelrex_sc_${summaryId}`, JSON.stringify(msgs)); } catch {}
  };

  // Load summaries list
  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", userId }),
      });
      const data = await res.json();
      setSummaries(data.summaries || []);
      // Auto-load the most recent one
      if (data.summaries?.length > 0) {
        await loadSummary(data.summaries[0].id);
      }
    } catch (e) {
      console.error("[Summaries] Load failed:", e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadSummaries(); }, [loadSummaries]);

  const loadSummary = async (id: string) => {
    // Save current chat before switching
    if (activeSummary?.id && chatMessages.length > 0) {
      saveChatForSummary(activeSummary.id, chatMessages);
    }
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", userId, summaryId: id }),
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary(data.summary);
        loadChatForSummary(data.summary.id);
        setShowList(false);
      }
    } catch (e) {
      console.error("[Summaries] Get failed:", e);
    }
  };

  const generateSummary = async () => {
    if (activeSummary?.id && chatMessages.length > 0) {
      saveChatForSummary(activeSummary.id, chatMessages);
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate", userId }),
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary(data.summary);
        setChatMessages([]);
        setSummaries((prev) => [data.summary, ...prev]);
      }
    } catch (e) {
      console.error("[Summaries] Generate failed:", e);
    } finally {
      setGenerating(false);
    }
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !activeSummary || chatSending) return;
    const msg = chatInput.trim();
    setChatInput("");
    const userMsg: ChatMsg = { id: uid(), role: "user", content: msg };
    const updatedWithUser = [...chatMessages, userMsg];
    setChatMessages(updatedWithUser);
    saveChatForSummary(activeSummary.id, updatedWithUser);
    setChatSending(true);

    try {
      const res = await fetch("/api/z/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          userId,
          summaryId: activeSummary.id,
          message: msg,
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) {
        const assistantMsg: ChatMsg = { id: uid(), role: "assistant", content: data.reply };
        const final = [...updatedWithUser, assistantMsg];
        setChatMessages(final);
        saveChatForSummary(activeSummary.id, final);
      }
    } catch (e) {
      const errorMsg: ChatMsg = { id: uid(), role: "assistant", content: "Something went wrong. Try again." };
      const final = [...updatedWithUser, errorMsg];
      setChatMessages(final);
      saveChatForSummary(activeSummary.id, final);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatWeek = (start: string, end: string) => `${formatDate(start)} — ${formatDate(end)}`;

  // Render markdown-lite (bold, bullets)
  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 8 }} />;

      // Header (bold with **)
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return (
          <div key={i} style={{ fontWeight: 700, color: G.text, fontSize: 15, marginTop: i > 0 ? 16 : 0, marginBottom: 6 }}>
            {trimmed.replace(/\*\*/g, "")}
          </div>
        );
      }

      // Bullet
      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        const content = trimmed.slice(2);
        return (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: 4 }}>
            <span style={{ color: G.accent, marginTop: 2, flexShrink: 0 }}>•</span>
            <span style={{ color: G.textSec, fontSize: 14, lineHeight: 1.6 }}>{renderInline(content)}</span>
          </div>
        );
      }

      // Numbered
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, paddingLeft: 4 }}>
            <span style={{ color: G.accent, fontWeight: 700, fontSize: 13, minWidth: 18, flexShrink: 0 }}>{numMatch[1]}.</span>
            <span style={{ color: G.textSec, fontSize: 14, lineHeight: 1.6 }}>{renderInline(numMatch[2])}</span>
          </div>
        );
      }

      return <p key={i} style={{ color: G.textSec, fontSize: 14, lineHeight: 1.7, marginBottom: 4 }}>{renderInline(trimmed)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: G.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Render chat assistant messages with markdown support
  const renderChatMessage = (text: string) => {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 6 }} />;
      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, paddingLeft: 2 }}>
            <span style={{ color: G.accent, flexShrink: 0, fontSize: 11, marginTop: 2 }}>•</span>
            <span>{renderInline(trimmed.slice(2))}</span>
          </div>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ display: "flex", gap: 6, marginBottom: 3, paddingLeft: 2 }}>
            <span style={{ color: G.accent, fontWeight: 700, fontSize: 12, flexShrink: 0, minWidth: 14 }}>{numMatch[1]}.</span>
            <span>{renderInline(numMatch[2])}</span>
          </div>
        );
      }
      return <p key={i} style={{ marginBottom: 3 }}>{renderInline(trimmed)}</p>;
    });
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: "rgba(2,3,5,0.82)",
      backdropFilter: "blur(72px) saturate(1.3) brightness(0.92)",
      WebkitBackdropFilter: "blur(72px) saturate(1.3) brightness(0.92)",
      display: "flex", overflow: "hidden",
      opacity: mounted ? 1 : 0,
      transition: `opacity 450ms ${EASE}`,
    }}>
      <style>{`
        @keyframes zs-spin { to { transform: rotate(360deg) } }
        @keyframes zs-fadeUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes zs-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes zs-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%      { opacity: 1; transform: scale(1.1); }
        }
        /* ── Cards with liquid glass hover ── */
        .zs-card {
          transition: transform 500ms ${EASE_SPRING}, box-shadow 500ms ${EASE_SPRING}, border-color 500ms ${EASE_SPRING};
          will-change: transform;
          position: relative;
          overflow: hidden;
        }
        .zs-card::before {
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
        .zs-card::after {
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
        .zs-card:hover::before, .zs-card:hover::after { opacity: 1; }
        .zs-card:hover {
          transform: translateY(-1px) scale(1.005) !important;
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.09) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 2px 8px rgba(0,0,0,0.15),
            0 16px 48px rgba(0,0,0,0.28) !important;
          border-color: rgba(255,255,255,0.10) !important;
          backdrop-filter: blur(20px) brightness(1.15) saturate(1.5);
          -webkit-backdrop-filter: blur(20px) brightness(1.15) saturate(1.5);
        }
        .zs-card:active { transform: scale(0.98) translateY(0) !important; transition-duration: 120ms; }
        .zs-card > * { position: relative; z-index: 1; }

        /* ── Buttons with liquid glass hover ── */
        .zs-btn {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING};
          cursor: pointer;
        }
        .zs-btn::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.12) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.04);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .zs-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
          z-index: 0;
        }
        .zs-btn:hover::before, .zs-btn:hover::after { opacity: 1; }
        .zs-btn:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(20px) brightness(1.22) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) brightness(1.22) saturate(1.6);
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.45);
          transform: translateY(-0.5px);
        }
        .zs-btn:active { transform: scale(0.97) translateY(0); transition-duration: 120ms; }
        .zs-btn > * { position: relative; z-index: 1; }

        /* ── Green accent variant ── */
        .zs-btn-green {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING};
          cursor: pointer;
        }
        .zs-btn-green::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(52,211,153,0.24) 0%, rgba(52,211,153,0.04) 18%, transparent 48%, transparent 58%, rgba(52,211,153,0.03) 82%, rgba(52,211,153,0.16) 100%);
          box-shadow: inset 0 1px 0 rgba(52,211,153,0.4), inset 0 -0.5px 0 rgba(52,211,153,0.05);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .zs-btn-green::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(52,211,153,0.15) 0%, rgba(52,211,153,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .zs-btn-green:hover::before, .zs-btn-green:hover::after { opacity: 1; }
        .zs-btn-green:hover {
          background: rgba(52,211,153,0.06) !important;
          border-color: rgba(52,211,153,0.18) !important;
          backdrop-filter: blur(20px) brightness(1.18) saturate(1.6);
          -webkit-backdrop-filter: blur(20px) brightness(1.18) saturate(1.6);
          box-shadow: 0 0 0 0.5px rgba(52,211,153,0.25), 0 2px 8px rgba(52,211,153,0.06), 0 8px 32px rgba(0,0,0,0.04), 0 0 24px rgba(52,211,153,0.04), inset 0 1px 0 rgba(52,211,153,0.4);
          transform: translateY(-0.5px);
        }
        .zs-btn-green:active { transform: scale(0.97) translateY(0); transition-duration: 120ms; }

        /* ── Close button ── */
        .zs-close {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING} !important;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .zs-close::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.12) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.04);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .zs-close::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .zs-close:hover::before, .zs-close:hover::after { opacity: 1; }
        .zs-close:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          -webkit-backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.45) !important;
          transform: translateY(-0.5px);
        }
        .zs-close:active { transform: scale(0.92) translateY(0); transition-duration: 120ms; }

        /* ── Stat cards ── */
        .zs-stat {
          transition: transform 500ms ${EASE}, box-shadow 500ms ${EASE}, border-color 500ms ${EASE};
          will-change: transform;
        }
        .zs-stat:hover {
          transform: translateY(-1px) scale(1.005) !important;
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.09) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 2px 8px rgba(0,0,0,0.15),
            0 16px 48px rgba(0,0,0,0.28) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }

        /* ── Scrollbar ── */
        .zs-gs::-webkit-scrollbar { width: 5px; }
        .zs-gs::-webkit-scrollbar-track { background: transparent; }
        .zs-gs::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          transition: background 300ms ease;
        }
        .zs-gs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }

        /* ── Chat input ── */
        .zs-chat-input {
          transition: all 350ms ${EASE} !important;
        }
        .zs-chat-input:focus {
          outline: none;
          border-color: rgba(59,130,246,0.25) !important;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.06), 0 0 16px rgba(59,130,246,0.04) !important;
          background: rgba(255,255,255,0.035) !important;
        }

        /* ── Send button ── */
        .zs-send {
          transition: all 400ms ${EASE_SPRING};
        }
        .zs-send:hover:not(:disabled) {
          transform: translateY(-0.5px);
          box-shadow: 0 4px 16px rgba(59,130,246,0.25);
        }
        .zs-send:active:not(:disabled) { transform: scale(0.93); transition-duration: 120ms; }

        /* ── Suggestion pills ── */
        .zs-suggest {
          position: relative;
          overflow: hidden;
          transition: all 500ms ${EASE_SPRING};
        }
        .zs-suggest::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(59,130,246,0.20) 0%, rgba(59,130,246,0.03) 18%, transparent 48%, transparent 58%, rgba(59,130,246,0.02) 82%, rgba(59,130,246,0.12) 100%);
          box-shadow: inset 0 1px 0 rgba(59,130,246,0.3);
          transition: opacity 500ms ${EASE_SPRING};
          pointer-events: none;
        }
        .zs-suggest:hover::before { opacity: 1; }
        .zs-suggest:hover {
          background: rgba(59,130,246,0.05) !important;
          border-color: rgba(59,130,246,0.15) !important;
          color: ${G.accentSoft} !important;
          transform: translateY(-0.5px);
        }
        .zs-suggest:active { transform: scale(0.97); transition-duration: 120ms; }
      `}</style>

      {/* ─── LEFT: Mini Chat ──────────────────────────── */}
      <div style={{
        width: 340, flexShrink: 0, display: "flex", flexDirection: "column",
        borderRight: `0.5px solid ${G.glassBorder}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, rgba(6,9,15,0.5) 100%)",
        animation: "zs-fadeIn 500ms ease both",
      }}>
        {/* Chat header */}
        <div style={{
          padding: "18px 20px", borderBottom: `0.5px solid ${G.glassBorder}`,
          display: "flex", alignItems: "center", gap: 12,
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 11,
            background: `linear-gradient(135deg, ${G.accentGlow}, rgba(59,130,246,0.04))`,
            border: `0.5px solid rgba(59,130,246,0.15)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px rgba(59,130,246,0.06)`,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={G.accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: G.text }}>Ask Zelrex</div>
            <div style={{ fontSize: 11, color: G.textMuted }}>
              {activeSummary ? `About ${formatWeek(activeSummary.week_start, activeSummary.week_end)}` : "Select a summary first"}
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {chatMessages.length === 0 && activeSummary && (
            <div style={{ textAlign: "center", padding: "32px 16px", color: G.textMuted, animation: "zs-fadeIn 400ms ease" }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, margin: "0 auto 12px", background: `linear-gradient(135deg, ${G.accentGlow}, transparent)`, border: `0.5px solid rgba(59,130,246,0.12)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3c-4.97 0-9 3.185-9 7.115 0 2.557 1.522 4.82 3.889 6.185l-.724 2.7 3.135-1.567c.87.18 1.775.282 2.7.282 4.97 0 9-3.185 9-7.115C21 6.685 16.97 3 12 3z" stroke={G.accent} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" opacity="0.7"/></svg>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: G.textSec, marginBottom: 12 }}>Ask anything about this summary</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {[
                  "How can I improve my click rate?",
                  "What should I focus on this week?",
                  "Why is my traffic low?",
                  "Give me 3 outreach ideas",
                  "How does my site compare to benchmarks?",
                ].map((q, i) => (
                  <button key={q} className="zs-suggest" onClick={() => { setChatInput(q); }} style={{
                    padding: "9px 14px", borderRadius: 999, border: `0.5px solid ${G.glassBorder}`,
                    background: G.glass, color: G.textSec, fontSize: 12, textAlign: "left",
                    cursor: "pointer", animation: `zs-fadeUp 280ms cubic-bezier(0.22,1,0.36,1) ${i * 40}ms both`,
                  }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {!activeSummary && (
            <div style={{ textAlign: "center", padding: "60px 16px", color: G.textMuted, fontSize: 13 }}>
              Generate or select a summary to start chatting.
            </div>
          )}
          {chatMessages.map((m, idx) => (
            <div key={m.id} style={{
              animation: `zs-fadeUp 320ms cubic-bezier(0.22,1,0.36,1) ${Math.min(idx * 30, 200)}ms both`,
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "88%",
            }}>
              {m.role === "assistant" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 5, background: G.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: G.accent }}>Z</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: G.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Zelrex</span>
                </div>
              )}
              <div style={{
                padding: "11px 15px",
                ...(m.role === "user" ? {
                  background: `linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(59,130,246,0.08) 100%)`,
                  border: `0.5px solid rgba(59,130,246,0.20)`,
                  borderRadius: "16px 16px 4px 16px",
                  boxShadow: `0 2px 12px rgba(59,130,246,0.08)`,
                } : {
                  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                  border: `0.5px solid ${G.glassBorder}`,
                  borderRadius: "16px 16px 16px 4px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.15), inset 0 0.5px 0 rgba(255,255,255,0.06)",
                }),
                fontSize: 13, lineHeight: 1.65,
                color: m.role === "user" ? G.text : G.textSec,
              }}>
                {m.role === "assistant" ? renderChatMessage(m.content) : m.content}
              </div>
            </div>
          ))}
          {chatSending && (
            <div style={{ alignSelf: "flex-start", maxWidth: "88%", animation: "zs-fadeUp 200ms ease" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, paddingLeft: 2 }}>
                <div style={{ width: 16, height: 16, borderRadius: 5, background: G.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 8, fontWeight: 800, color: G.accent }}>Z</span>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: G.textMuted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Zelrex</span>
              </div>
              <div style={{ padding: "12px 15px", background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)", border: `0.5px solid ${G.glassBorder}`, borderRadius: "16px 16px 16px 4px" }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: G.accent, opacity: 0.4, animation: `pulse 1s ease-in-out ${i * 0.15}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input + controls */}
        <div style={{ padding: 12, borderTop: `0.5px solid ${G.glassBorder}` }}>
          {chatMessages.length > 0 && activeSummary && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <button className="zs-btn" onClick={() => {
                setChatMessages([]);
                if (activeSummary?.id) saveChatForSummary(activeSummary.id, []);
              }} style={{
                padding: "4px 12px", borderRadius: 999, border: `0.5px solid ${G.glassBorder}`,
                background: "transparent", color: G.textMuted, fontSize: 11, fontWeight: 500, cursor: "pointer",
              }}>
                Clear conversation
              </button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="zs-chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder={activeSummary ? "Ask about this summary..." : "Select a summary first"}
              disabled={!activeSummary}
              style={{
                flex: 1, padding: "10px 14px", borderRadius: 999,
                border: `0.5px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.03)",
                color: G.text, fontSize: 13, transition: "all 300ms cubic-bezier(0.22,1,0.36,1)",
                fontFamily: "'SF Pro Text', 'Inter', -apple-system, sans-serif",
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || !activeSummary || chatSending}
              className="zs-send"
              style={{
                width: 38, height: 38, borderRadius: 999, border: "none",
                background: chatInput.trim() ? `linear-gradient(135deg, ${G.accent}, ${G.accentSoft})` : "rgba(255,255,255,0.04)",
                color: chatInput.trim() ? "#fff" : G.textMuted,
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 300ms cubic-bezier(0.22,1,0.36,1)",
                boxShadow: chatInput.trim() ? `0 0 20px ${G.accent}30` : "none",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ─── RIGHT: Summary Content ──────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `0.5px solid ${G.glassBorder}`,
          background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: `linear-gradient(135deg, ${G.greenGlow}, rgba(52,211,153,0.04))`,
              border: `0.5px solid rgba(52,211,153,0.15)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 20px rgba(52,211,153,0.06)`,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke={G.green} strokeWidth="1.3" opacity="0.8" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke={G.green} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.025em", fontFamily: "'SF Pro Display', 'Inter', -apple-system, sans-serif" }}>Weekly Summary</div>
              <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>
                {activeSummary ? formatWeek(activeSummary.week_start, activeSummary.week_end) : "Your business performance"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Past Summaries button */}
            <button className="zs-btn" onClick={() => setShowList(!showList)} style={{
              padding: "8px 16px", borderRadius: 999,
              border: `0.5px solid ${showList ? G.accent + "40" : G.glassBorder}`,
              background: showList ? G.accentGlow : "transparent",
              color: showList ? G.accent : G.textSec, fontSize: 12, fontWeight: 600,
              letterSpacing: "-0.01em",
            }}>
              {showList ? "Back" : `Past Summaries${summaries.length > 0 ? ` (${summaries.length})` : ""}`}
            </button>

            {/* Generate button */}
            <button className="zs-btn-green" onClick={generateSummary} disabled={generating} style={{
              padding: "8px 16px", borderRadius: 999, border: `0.5px solid rgba(52,211,153,0.15)`,
              background: `linear-gradient(135deg, ${G.green}20, ${G.green}08)`,
              boxShadow: `0 0 16px ${G.green}10, inset 0 0.5px 0 rgba(255,255,255,0.08)`,
              color: G.green, fontSize: 12, fontWeight: 700,
              opacity: generating ? 0.6 : 1, letterSpacing: "-0.01em",
            }}>
              {generating ? "Generating..." : "Generate New"}
            </button>

            {/* Close */}
            <button className="zs-close" onClick={() => {
              if (activeSummary?.id && chatMessages.length > 0) saveChatForSummary(activeSummary.id, chatMessages);
              onClose();
            }} style={{
              width: 36, height: 36, borderRadius: 999,
              border: `0.5px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.03)",
              color: G.textSec, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 300ms cubic-bezier(0.22,1,0.36,1)",
            }}>✕</button>
          </div>
        </div>

        {/* Content area */}
        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: G.textSec }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.green, animation: "zs-spin 1s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14, fontFamily: "'SF Pro Text', 'Inter', -apple-system, sans-serif" }}>Loading summaries...</div>
              </div>
            </div>
          ) : showList ? (
            /* ─── Past Summaries List ─────────────────── */
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 16 }}>All Weekly Summaries</div>
              {summaries.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: G.textMuted }}>
                  <div style={{ fontSize: 15, marginBottom: 8 }}>No summaries yet</div>
                  <div style={{ fontSize: 13 }}>Click "Generate New" to create your first weekly summary.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {summaries.map((s, i) => {
                    const snap = s.analytics_snapshot || {};
                    return (
                      <button key={s.id} className="zs-card" onClick={() => loadSummary(s.id)} style={{
                        ...liquidGlass, padding: 18, cursor: "pointer", textAlign: "left", width: "100%",
                        animation: `zs-fadeUp 350ms cubic-bezier(0.22,1,0.36,1) ${i * 50}ms both`,
                        border: activeSummary?.id === s.id ? `0.5px solid ${G.accent}40` : `0.5px solid ${G.glassBorder}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>
                            {formatWeek(s.week_start, s.week_end)}
                          </div>
                          <div style={{ fontSize: 11, color: G.textMuted }}>
                            {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 16 }}>
                          <Stat label="Views" value={snap.pageviews ?? 0} color={G.accent} />
                          <Stat label="Visitors" value={snap.visitors ?? 0} color={G.green} />
                          <Stat label="Clicks" value={snap.ctaClicks ?? 0} color={G.amber} />
                          {snap.revenue > 0 && <Stat label="Revenue" value={`$${(snap.revenue / 100).toFixed(0)}`} color={G.purple} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeSummary ? (
            /* ─── Active Summary Content ──────────────── */
            <div style={{ maxWidth: 740, margin: "0 auto" }}>
              {/* Quick stats bar */}
              <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Pageviews", value: activeSummary.analytics_snapshot?.pageviews ?? 0, prev: activeSummary.analytics_snapshot?.prevPageviews, color: G.accent },
                  { label: "Visitors", value: activeSummary.analytics_snapshot?.visitors ?? 0, prev: activeSummary.analytics_snapshot?.prevVisitors, color: G.green },
                  { label: "CTA Clicks", value: activeSummary.analytics_snapshot?.ctaClicks ?? 0, prev: activeSummary.analytics_snapshot?.prevCtaClicks, color: G.amber },
                  { label: "Revenue", value: activeSummary.analytics_snapshot?.revenue ? `$${(activeSummary.analytics_snapshot.revenue / 100).toFixed(2)}` : "$0", color: G.purple },
                ].map((s, i) => (
                  <div key={i} className="zs-stat" style={{
                    flex: 1, ...liquidGlass, padding: "14px 16px",
                    animation: `zs-fadeUp 350ms cubic-bezier(0.22,1,0.36,1) ${i * 60}ms both`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color, boxShadow: `0 0 8px ${s.color}40` }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", fontFamily: "'SF Pro Display', 'Inter', -apple-system, sans-serif" }}>
                      {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                    </div>
                    {s.prev !== undefined && typeof s.value === "number" && (
                      <div style={{ fontSize: 11, color: s.value > s.prev ? G.green : s.value < s.prev ? "#EF4444" : G.textMuted, marginTop: 2 }}>
                        {s.value > s.prev ? "↑" : s.value < s.prev ? "↓" : "→"} vs last week ({s.prev})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary text */}
              <div style={{ ...liquidGlass, padding: 28, animation: "zs-fadeUp 350ms cubic-bezier(0.22,1,0.36,1) 200ms both" }}>
                {renderText(activeSummary.summary_text)}
              </div>
            </div>
          ) : (
            /* ─── Empty State ─────────────────────────── */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px",
                  background: `linear-gradient(135deg, ${G.greenGlow}, rgba(52,211,153,0.02))`,
                  border: `0.5px solid rgba(52,211,153,0.12)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 30px rgba(52,211,153,0.06)`,
                  animation: "zs-fadeUp 400ms cubic-bezier(0.22,1,0.36,1) both",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke={G.green} strokeWidth="1.3" opacity="0.8" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke={G.green} strokeWidth="1.3" strokeLinecap="round" opacity="0.8" />
                  </svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 8, letterSpacing: "-0.025em", fontFamily: "'SF Pro Display', 'Inter', -apple-system, sans-serif" }}>No weekly summaries yet</div>
                <div style={{ fontSize: 14, color: G.textSec, lineHeight: 1.6, marginBottom: 20, fontFamily: "'SF Pro Text', 'Inter', -apple-system, sans-serif" }}>
                  Generate your first weekly summary to see how your business is performing. Zelrex will analyze your traffic, clicks, and revenue.
                </div>
                <button className="zs-btn-green" onClick={generateSummary} disabled={generating} style={{
                  padding: "12px 24px", borderRadius: 999, border: `0.5px solid rgba(52,211,153,0.15)`,
                  background: `linear-gradient(135deg, ${G.green}25, ${G.green}10)`,
                  boxShadow: `0 0 20px ${G.green}15, inset 0 0.5px 0 rgba(255,255,255,0.08)`,
                  color: G.green, fontSize: 14, fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}>
                  {generating ? "Generating..." : "Generate First Summary"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 4, height: 4, borderRadius: 999, background: color, boxShadow: `0 0 6px ${color}40` }} />
      <span style={{ fontSize: 12, color: G.textMuted, fontFamily: "'SF Pro Text', 'Inter', -apple-system, sans-serif" }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: G.text, fontVariantNumeric: "tabular-nums" }}>{typeof value === "number" ? value.toLocaleString() : value}</span>
    </div>
  );
}