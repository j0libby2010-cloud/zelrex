"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────────────────
interface SummaryMeta {
  id: string;
  week_start: string;
  week_end: string;
  analytics_snapshot: any;
  created_at: string;
  auto_generated?: boolean;
}

interface SummaryFull extends SummaryMeta {
  summary_text: string;
}

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Colors ─────────────────────────────────────────────────────
const G = {
  bg: "#06090F",
  glass: "rgba(255,255,255,0.03)",
  glassBorder: "rgba(255,255,255,0.06)",
  glassBorderHover: "rgba(255,255,255,0.10)",
  text: "rgba(255,255,255,0.88)",
  textSec: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.28)",
  accent: "#4A90FF",
  accentGlow: "rgba(74,144,255,0.15)",
  green: "#10B981",
  greenGlow: "rgba(16,185,129,0.15)",
  amber: "#F59E0B",
  purple: "#8B5CF6",
  purpleGlow: "rgba(139,92,246,0.12)",
};

const glass: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
  backdropFilter: "blur(40px) saturate(1.5)",
  WebkitBackdropFilter: "blur(40px) saturate(1.5)",
  border: `1px solid ${G.glassBorder}`,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const pill: React.CSSProperties = { ...glass, borderRadius: 999 };

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

  // Mini-chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const uid = () => Math.random().toString(36).slice(2, 10);

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
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", userId, summaryId: id }),
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary(data.summary);
        setChatMessages([]);
        setShowList(false);
      }
    } catch (e) {
      console.error("[Summaries] Get failed:", e);
    }
  };

  const generateSummary = async () => {
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
    setChatMessages((prev) => [...prev, userMsg]);
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
        setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.reply }]);
      }
    } catch (e) {
      setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "Something went wrong. Try again." }]);
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
    // Bold
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: G.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  const [mobileView, setMobileView] = useState<"summary" | "chat">("summary");
  const [isMobileWS, setIsMobileWS] = useState(false);
  useEffect(() => { const c = () => setIsMobileWS(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: "rgb(3,5,8)",
      display: "flex", flexDirection: isMobileWS ? "column" : "row", overflow: "hidden",
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .zs-card{transition:all 200ms ease}
        .zs-card:hover{background:rgba(255,255,255,0.04)!important;border-color:rgba(255,255,255,0.10)!important;transform:translateY(-1px)}
        .zs-btn{transition:all 200ms ease;cursor:pointer}
        .zs-btn:hover{background:rgba(255,255,255,0.06)!important;transform:translateY(-1px)}
        .zs-gs::-webkit-scrollbar{width:5px}
        .zs-gs::-webkit-scrollbar-track{background:transparent}
        .zs-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .zs-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.15)}
        .zs-chat-input:focus{outline:none;border-color:${G.accent}40!important;box-shadow:0 0 0 3px ${G.accent}10}
        /* ─ Liquid glass close button ─ */
        .zs-close-btn{position:relative;overflow:hidden;transition:all 500ms cubic-bezier(0.22,1,0.36,1)!important;backdrop-filter:none;-webkit-backdrop-filter:none}
        .zs-close-btn::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(160deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.04) 15%,transparent 42%,transparent 58%,rgba(255,255,255,0.03) 80%,rgba(255,255,255,0.12) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -0.5px 0 rgba(255,255,255,0.04);transition:opacity 500ms cubic-bezier(0.22,1,0.36,1);pointer-events:none}
        .zs-close-btn::after{content:'';position:absolute;top:-50%;left:5%;width:90%;height:80%;border-radius:50%;background:radial-gradient(ellipse at 40% 25%,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.02) 35%,transparent 70%);opacity:0;transition:opacity 500ms cubic-bezier(0.22,1,0.36,1);pointer-events:none}
        .zs-close-btn:hover::before,.zs-close-btn:hover::after{opacity:1}
        .zs-close-btn:hover{background:rgba(255,255,255,0.05)!important;border-color:rgba(255,255,255,0.12)!important;backdrop-filter:blur(20px) brightness(1.22) saturate(1.6)!important;-webkit-backdrop-filter:blur(20px) brightness(1.22) saturate(1.6)!important;box-shadow:0 0 0 0.5px rgba(255,255,255,0.18),0 2px 8px rgba(0,0,0,0.08),0 8px 32px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.45)!important;transform:translateY(-0.5px)}
        .zs-close-btn:active{transform:scale(0.92) translateY(0);transition-duration:120ms}
        @media(max-width:768px){
          .zs-header-actions{flex-wrap:wrap;gap:6px!important}
          .zs-header-actions button{font-size:11px!important;padding:8px 14px!important;min-height:38px}
          .zs-stat-bar{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
          .zs-gs{padding:12px!important}
          .zs-summary-header{flex-direction:column!important;gap:10px!important;padding:14px 16px!important}
          .zs-summary-header > div:last-child{width:100%;display:flex;flex-wrap:wrap;gap:6px}
          .zs-summary-text{padding:18px!important}
          .zs-close-btn{position:absolute!important;right:14px!important;top:14px!important;width:38px!important;height:38px!important}
        }
        @media(max-width:480px){
          .zs-stat-bar{gap:6px!important}
          .zs-stat-bar > div{padding:10px 12px!important}
          .zs-header-actions button{font-size:10px!important;padding:6px 10px!important}
          .zs-gs{padding:10px!important}
          .zs-summary-header{padding:12px 14px!important}
        }
        /* Mobile safe area */
        @supports(padding-bottom: env(safe-area-inset-bottom)){
          .zs-gs{padding-bottom:calc(12px + env(safe-area-inset-bottom))!important}
        }
        /* Mobile touch improvements */
        @media(hover:none){
          .zs-btn:active{transform:scale(0.97)!important;transition-duration:100ms!important}
          .zs-card:active{transform:scale(0.99)!important;transition-duration:120ms!important}
        }
      `}</style>

      {/* ─── Mobile Tab Toggle ──────────────────────── */}
      {isMobileWS && (
        <div style={{ display: "flex", padding: "10px 14px", gap: 6, borderBottom: `0.5px solid ${G.glassBorder}`, background: "rgba(6,9,15,0.85)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}>
          {(["summary", "chat"] as const).map((v) => (
            <button key={v} className="zs-btn" onClick={() => setMobileView(v)} style={{
              flex: 1, padding: "10px 0", borderRadius: 999, border: "none",
              background: mobileView === v ? `linear-gradient(135deg, ${G.accent}25, ${G.accent}10)` : "transparent",
              color: mobileView === v ? G.accent : G.textSec, fontSize: 14, fontWeight: 600, textTransform: "capitalize", cursor: "pointer",
              boxShadow: mobileView === v ? `0 0 12px ${G.accent}10, inset 0 0.5px 0 rgba(255,255,255,0.10)` : "none",
              transition: `all 300ms ease`,
              minHeight: 44,
            }}>{v === "chat" ? "Ask Zelrex" : "Summary"}</button>
          ))}
        </div>
      )}

      {/* ─── LEFT: Mini Chat ──────────────────────────── */}
      <div style={{
        width: isMobileWS ? "100%" : 340, flexShrink: 0, display: (isMobileWS && mobileView !== "chat") ? "none" : "flex", flexDirection: "column",
        borderRight: isMobileWS ? "none" : `1px solid ${G.glassBorder}`,
        background: "rgba(6,9,15,0.6)",
        flex: isMobileWS ? 1 : undefined,
      }}>
        {/* Chat header */}
        <div style={{
          padding: "16px 18px", borderBottom: `1px solid ${G.glassBorder}`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: G.accentGlow,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {chatMessages.length === 0 && activeSummary && (
            <div style={{ textAlign: "center", padding: "40px 16px", color: G.textMuted }}>
              <div style={{ fontSize: 13, marginBottom: 8 }}>Ask anything about this summary</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["How can I improve my click rate?", "What should I post this week?", "Why is my traffic low?"].map((q) => (
                  <button key={q} className="zs-btn" onClick={() => { setChatInput(q); }} style={{
                    padding: "8px 12px", borderRadius: 999, border: `1px solid ${G.glassBorder}`,
                    background: G.glass, color: G.textSec, fontSize: 12, textAlign: "left",
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
          {chatMessages.map((m) => (
            <div key={m.id} style={{
              animation: "fadeUp 200ms ease",
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
            }}>
              <div style={{
                padding: "10px 14px", borderRadius: 16,
                ...(m.role === "user" ? {
                  background: `linear-gradient(135deg, ${G.accent}30, ${G.accent}15)`,
                  border: `1px solid ${G.accent}25`,
                  borderBottomRightRadius: 4,
                } : {
                  ...glass,
                  borderBottomLeftRadius: 4,
                }),
                fontSize: 13, lineHeight: 1.6,
                color: m.role === "user" ? G.text : G.textSec,
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {chatSending && (
            <div style={{ display: "flex", gap: 4, padding: "8px 14px", animation: "fadeUp 200ms ease" }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: 999, background: G.accent,
                  opacity: 0.4, animation: `pulse 1s ease-in-out ${i * 0.15}s infinite`,
                }} />
              ))}
              <style>{`@keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}`}</style>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <div style={{ padding: 12, borderTop: `1px solid ${G.glassBorder}` }}>
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
                border: `1px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.03)",
                color: G.text, fontSize: isMobileWS ? 16 : 13, transition: "all 200ms ease",
                minHeight: isMobileWS ? 44 : undefined,
              }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || !activeSummary || chatSending}
              style={{
                width: 38, height: 38, borderRadius: 999, border: "none",
                background: chatInput.trim() ? G.accent : "rgba(255,255,255,0.05)",
                color: chatInput.trim() ? "#fff" : G.textMuted,
                cursor: chatInput.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 200ms ease",
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
      <div style={{ flex: 1, display: (isMobileWS && mobileView !== "summary") ? "none" : "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div className="zs-summary-header" style={{
          padding: "16px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${G.glassBorder}`,
          position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 12,
              background: G.greenGlow,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke={G.green} strokeWidth="1.4" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke={G.green} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Weekly Summary</div>
              <div style={{ fontSize: 12, color: G.textMuted, marginTop: 1 }}>
                {activeSummary ? formatWeek(activeSummary.week_start, activeSummary.week_end) : "Your business performance"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* Past Summaries button */}
            <button className="zs-btn" onClick={() => setShowList(!showList)} style={{
              padding: "8px 16px", borderRadius: 999,
              border: `1px solid ${showList ? G.accent + "40" : G.glassBorder}`,
              background: showList ? G.accentGlow : G.glass,
              color: showList ? G.accent : G.textSec, fontSize: 12, fontWeight: 600,
            }}>
              {showList ? "Back" : `Past Summaries${summaries.length > 0 ? ` (${summaries.length})` : ""}`}
            </button>

            {/* Generate button */}
            <button className="zs-btn" onClick={generateSummary} disabled={generating} style={{
              padding: "8px 16px", borderRadius: 999, border: "none",
              background: `linear-gradient(135deg, ${G.green}20, ${G.green}08)`,
              boxShadow: `0 0 12px ${G.green}10, inset 0 0.5px 0 rgba(255,255,255,0.1)`,
              color: G.green, fontSize: 12, fontWeight: 700,
              opacity: generating ? 0.6 : 1,
            }}>
              {generating ? "Generating..." : "Generate New"}
            </button>

            {/* Close */}
            <button className="zs-close-btn" onClick={onClose} style={{
              width: 36, height: 36, borderRadius: 999,
              border: `1px solid ${G.glassBorder}`, background: G.glass,
              color: G.textSec, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>✕</button>
          </div>
        </div>

        {/* Content area */}
        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", color: G.textSec }}>
                <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.green, animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
                <div style={{ fontSize: 14 }}>Loading summaries...</div>
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
                        ...glass, padding: 18, cursor: "pointer", textAlign: "left", width: "100%",
                        animation: `fadeUp 200ms ease ${i * 50}ms both`,
                        border: activeSummary?.id === s.id ? `1px solid ${G.accent}40` : `1px solid ${G.glassBorder}`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>
                              {formatWeek(s.week_start, s.week_end)}
                            </div>
                            {(s as any).auto_generated && (
                              <span style={{ padding: "2px 8px", borderRadius: 999, background: `${G.purple}15`, border: `0.5px solid ${G.purple}25`, fontSize: 9, fontWeight: 600, color: G.purple, letterSpacing: "0.04em" }}>AUTO</span>
                            )}
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
              <div className="zs-stat-bar" style={{ display: "flex", gap: 12, marginBottom: 24 }}>
                {[
                  { label: "Pageviews", value: activeSummary.analytics_snapshot?.pageviews ?? 0, prev: activeSummary.analytics_snapshot?.prevPageviews, color: G.accent },
                  { label: "Visitors", value: activeSummary.analytics_snapshot?.visitors ?? 0, prev: activeSummary.analytics_snapshot?.prevVisitors, color: G.green },
                  { label: "CTA Clicks", value: activeSummary.analytics_snapshot?.ctaClicks ?? 0, prev: activeSummary.analytics_snapshot?.prevCtaClicks, color: G.amber },
                  { label: "Revenue", value: activeSummary.analytics_snapshot?.revenue ? `$${(activeSummary.analytics_snapshot.revenue / 100).toFixed(2)}` : "$0", color: G.purple },
                ].map((s, i) => (
                  <div key={i} style={{
                    flex: 1, ...glass, padding: "14px 16px",
                    animation: `fadeUp 200ms ease ${i * 60}ms both`,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>
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
              <div className="zs-summary-text" style={{ ...glass, padding: 28, animation: "fadeUp 300ms ease 200ms both" }}>
                {renderText(activeSummary.summary_text)}
              </div>
            </div>
          ) : (
            /* ─── Empty State ─────────────────────────── */
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", maxWidth: 400 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px",
                  background: `linear-gradient(135deg, ${G.greenGlow}, transparent)`,
                  border: `1px solid rgba(16,185,129,0.15)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke={G.green} strokeWidth="1.4" />
                    <path d="M16 2v4M8 2v4M3 10h18" stroke={G.green} strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 8 }}>No weekly summaries yet</div>
                <div style={{ fontSize: 14, color: G.textSec, lineHeight: 1.6, marginBottom: 20 }}>
                  Generate your first weekly summary to see how your business is performing. Zelrex will analyze your traffic, clicks, and revenue.
                </div>
                <button className="zs-btn" onClick={generateSummary} disabled={generating} style={{
                  padding: "12px 24px", borderRadius: 999, border: "none",
                  background: `linear-gradient(135deg, ${G.green}25, ${G.green}10)`,
                  boxShadow: `0 0 16px ${G.green}15, inset 0 0.5px 0 rgba(255,255,255,0.1)`,
                  color: G.green, fontSize: 14, fontWeight: 700,
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
      <div style={{ width: 4, height: 4, borderRadius: 999, background: color, opacity: 0.7 }} />
      <span style={{ fontSize: 12, color: G.textMuted }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: G.text }}>{value}</span>
    </div>
  );
}