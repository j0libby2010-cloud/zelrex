"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

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

/* Zelrex design tokens — mirrors the C object in ChatPageClient.tsx. Same
   values everywhere, so this panel reads as part of the same product. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Icons drawn to match the main interface's set (1.5 stroke, round caps) */
const XIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const SummaryIcon = ({ size = 16, color = C.accent }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="1.5" /><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const ChatIcon = ({ size = 15, color = C.accent }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const SendIcon = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ArrowUpIcon = ({ size = 10, color = C.green }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ArrowDownIcon = ({ size = 10, color = C.red }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function WeeklySummaries({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [summaries, setSummaries] = useState<SummaryMeta[]>([]);
  const [activeSummary, setActiveSummary] = useState<SummaryFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showList, setShowList] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const uid = () => Math.random().toString(36).slice(2, 10);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", userId }),
      });
      const data = await res.json();
      setSummaries(data.summaries || []);
      if (data.summaries?.length > 0) await loadSummary(data.summaries[0].id);
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
        method: "POST", headers: { "Content-Type": "application/json" },
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
        method: "POST", headers: { "Content-Type": "application/json" },
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat", userId, summaryId: activeSummary.id, message: msg,
          history: chatMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (data.reply) setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: data.reply }]);
    } catch (e) {
      setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formatWeek = (start: string, end: string) => `${formatDate(start)} — ${formatDate(end)}`;

  // Render markdown-lite (bold, bullets)
  const renderText = (text: string) => {
    return text.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 8 }} />;
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
        return <div key={i} style={{ fontWeight: 600, color: C.text, fontSize: 14, marginTop: i > 0 ? 16 : 0, marginBottom: 6 }}>{trimmed.replace(/\*\*/g, "")}</div>;
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
        const content = trimmed.slice(2);
        return (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: 4 }}>
            <span style={{ color: C.accent, marginTop: 2, flexShrink: 0 }}>•</span>
            <span style={{ color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>{renderInline(content)}</span>
          </div>
        );
      }
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        return (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, paddingLeft: 4 }}>
            <span style={{ color: C.accent, fontWeight: 600, fontSize: 12, minWidth: 18, flexShrink: 0 }}>{numMatch[1]}.</span>
            <span style={{ color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>{renderInline(numMatch[2])}</span>
          </div>
        );
      }
      return <p key={i} style={{ color: C.textSec, fontSize: 13, lineHeight: 1.7, marginBottom: 4 }}>{renderInline(trimmed)}</p>;
    });
  };

  const renderInline = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });
  };

  const [mobileView, setMobileView] = useState<"summary" | "chat">("summary");
  const [isMobileWS, setIsMobileWS] = useState(false);
  useEffect(() => { const c = () => setIsMobileWS(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600, background: C.bg,
      display: "flex", flexDirection: isMobileWS ? "column" : "row", overflow: "hidden",
      opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}`,
    }}>
      <style>{`
        @keyframes zs-spin{to{transform:rotate(360deg)}}
        @keyframes zs-fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes zs-pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}

        .zs-card{transition:border-color 150ms ${EASE}}
        .zs-card:hover{border-color:${C.borderHover}!important}
        .zs-btn{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-btn:hover{background:rgba(255,255,255,0.04)}
        .zs-btn:disabled{opacity:0.5;cursor:not-allowed}
        .zs-btn-outlined{transition:background-color 150ms ${EASE},border-color 150ms ${EASE};cursor:pointer}
        .zs-btn-outlined:hover{background:rgba(255,255,255,0.04);border-color:${C.borderHover}}
        .zs-btn-accent{transition:filter 150ms ${EASE};cursor:pointer}
        .zs-btn-accent:hover{filter:brightness(1.1)}
        .zs-btn-accent:disabled{opacity:0.5;cursor:not-allowed;filter:none}
        .zs-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
        .zs-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
        .zs-tab{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-tab.zs-tab-active{background:rgba(255,255,255,0.07)}

        .zs-gs::-webkit-scrollbar{width:5px}
        .zs-gs::-webkit-scrollbar-track{background:transparent}
        .zs-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .zs-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

        .zs-chat-input{transition:border-color 150ms ${EASE}}
        .zs-chat-input:focus{outline:none;border-color:${C.accent}}

        @media(max-width:768px){
          .zs-header-actions{flex-wrap:wrap;gap:6px!important}
          .zs-header-actions button{font-size:11px!important;padding:8px 14px!important;min-height:38px}
          .zs-stat-bar{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
          .zs-gs{padding:12px!important}
          .zs-summary-header{flex-direction:column!important;gap:10px!important;padding:14px 16px!important;height:auto!important}
          .zs-summary-header > div:last-child{width:100%;display:flex;flex-wrap:wrap;gap:6px}
          .zs-summary-text{padding:18px!important}
        }
        @media(max-width:480px){
          .zs-stat-bar{gap:6px!important}
          .zs-stat-bar > div{padding:10px 12px!important}
          .zs-header-actions button{font-size:10px!important;padding:6px 10px!important}
          .zs-gs{padding:10px!important}
          .zs-summary-header{padding:12px 14px!important}
        }
        @supports(padding-bottom: env(safe-area-inset-bottom)){
          .zs-gs{padding-bottom:calc(12px + env(safe-area-inset-bottom))!important}
        }
      `}</style>

      {/* Mobile tab toggle */}
      {isMobileWS && (
        <div style={{ display: "flex", padding: "10px 14px", gap: 4, borderBottom: `1px solid ${C.border}`, background: C.bgElevated }}>
          {(["summary", "chat"] as const).map((v) => (
            <button key={v} className={mobileView === v ? "zs-tab zs-tab-active" : "zs-tab"} onClick={() => setMobileView(v)} style={{
              flex: 1, padding: "10px 0", borderRadius: 999,
              color: mobileView === v ? C.text : C.textSec, fontSize: 13, fontWeight: 500, textTransform: "capitalize",
              minHeight: 40,
            }}>{v === "chat" ? "Ask Zelrex" : "Summary"}</button>
          ))}
        </div>
      )}

      {/* LEFT: Mini chat */}
      <div style={{
        width: isMobileWS ? "100%" : 340, flexShrink: 0, display: (isMobileWS && mobileView !== "chat") ? "none" : "flex", flexDirection: "column",
        borderRight: isMobileWS ? "none" : `1px solid ${C.border}`,
        background: C.bgElevated, flex: isMobileWS ? 1 : undefined,
      }}>
        <div style={{ height: isMobileWS ? "auto" : 52, padding: isMobileWS ? "14px 16px" : "0 16px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <ChatIcon size={15} color={C.accent} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Ask Zelrex</div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{activeSummary ? `About ${formatWeek(activeSummary.week_start, activeSummary.week_end)}` : "Select a summary first"}</div>
          </div>
        </div>

        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {chatMessages.length === 0 && activeSummary && (
            <div style={{ textAlign: "center", padding: "40px 16px", color: C.textMuted }}>
              <div style={{ fontSize: 13, marginBottom: 10 }}>Ask anything about this summary</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {["How can I improve my click rate?", "What should I post this week?", "Why is my traffic low?"].map((q) => (
                  <button key={q} className="zs-btn-outlined" onClick={() => setChatInput(q)} style={{
                    padding: "8px 12px", borderRadius: 10, border: `1px solid ${C.border}`,
                    background: "none", color: C.textSec, fontSize: 12, textAlign: "left",
                  }}>{q}</button>
                ))}
              </div>
            </div>
          )}
          {!activeSummary && <div style={{ textAlign: "center", padding: "60px 16px", color: C.textMuted, fontSize: 13 }}>Generate or select a summary to start chatting.</div>}
          {chatMessages.map((m) => (
            <div key={m.id} style={{ animation: "zs-fadeUp 200ms ease", alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "90%" }}>
              <div style={{
                padding: "9px 13px", borderRadius: 14,
                ...(m.role === "user"
                  ? { background: C.accentSoft, border: `1px solid ${C.accent}30`, borderBottomRightRadius: 4 }
                  : { background: C.bgInput, border: `1px solid ${C.border}`, borderBottomLeftRadius: 4 }),
                fontSize: 13, lineHeight: 1.6, color: m.role === "user" ? C.text : C.textSec,
              }}>{m.content}</div>
            </div>
          ))}
          {chatSending && (
            <div style={{ display: "flex", gap: 4, padding: "8px 14px" }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: 999, background: C.accent, opacity: 0.4, animation: `zs-pulse 1s ease-in-out ${i * 0.15}s infinite` }} />)}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="zs-chat-input"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder={activeSummary ? "Ask about this summary…" : "Select a summary first"}
              disabled={!activeSummary}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: isMobileWS ? 16 : 13, outline: "none", minHeight: isMobileWS ? 44 : undefined }}
            />
            <button className="zs-btn-accent" onClick={sendChat} disabled={!chatInput.trim() || !activeSummary || chatSending} style={{
              width: 36, height: 36, borderRadius: 999, border: "none",
              background: chatInput.trim() ? C.accent : C.bgInput,
              color: chatInput.trim() ? "#fff" : C.textMuted,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}><SendIcon size={14} /></button>
          </div>
        </div>
      </div>

      {/* RIGHT: Summary content */}
      <div style={{ flex: 1, display: (isMobileWS && mobileView !== "summary") ? "none" : "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="zs-summary-header" style={{ height: 52, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <SummaryIcon size={16} color={C.accent} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Weekly Summary</div>
              <div style={{ fontSize: 11, color: C.textMuted }}>{activeSummary ? formatWeek(activeSummary.week_start, activeSummary.week_end) : "Your business performance"}</div>
            </div>
          </div>

          <div className="zs-header-actions" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="zs-btn-outlined" onClick={() => setShowList(!showList)} style={{
              padding: "7px 14px", borderRadius: 999, border: `1px solid ${showList ? C.accent + "55" : C.border}`,
              background: showList ? C.accentSoft : "none", color: showList ? C.accent : C.textSec, fontSize: 12, fontWeight: 600,
            }}>{showList ? "Back" : `Past Summaries${summaries.length > 0 ? ` (${summaries.length})` : ""}`}</button>

            <button className="zs-btn-accent" onClick={generateSummary} disabled={generating} style={{
              padding: "7px 14px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 12, fontWeight: 600,
            }}>{generating ? "Generating…" : "Generate New"}</button>

            <button className="zs-btn-icon" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={16} /></button>
          </div>
        </div>

        <div className="zs-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ width: 32, height: 32, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "zs-spin 0.8s linear infinite" }} />
            </div>
          ) : showList ? (
            <div style={{ maxWidth: 700, margin: "0 auto" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>All Weekly Summaries</div>
              {summaries.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <div style={{ fontSize: 14, color: C.text, marginBottom: 6 }}>No summaries yet</div>
                  <div style={{ fontSize: 13, color: C.textMuted }}>Click "Generate New" to create your first weekly summary.</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {summaries.map((s, i) => {
                    const snap = s.analytics_snapshot || {};
                    return (
                      <button key={s.id} className="zs-card" onClick={() => loadSummary(s.id)} style={{
                        background: C.bgElevated, border: `1px solid ${activeSummary?.id === s.id ? C.accent + "55" : C.border}`, borderRadius: 14,
                        padding: 18, cursor: "pointer", textAlign: "left", width: "100%", animation: `zs-fadeUp 200ms ease ${i * 40}ms both`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{formatWeek(s.week_start, s.week_end)}</div>
                            {s.auto_generated && <span style={{ padding: "2px 8px", borderRadius: 999, background: C.bgInput, border: `1px solid ${C.border}`, fontSize: 9, fontWeight: 600, color: C.textMuted, letterSpacing: "0.04em" }}>AUTO</span>}
                          </div>
                          <div style={{ fontSize: 11, color: C.textMuted }}>{new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
                        </div>
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                          <Stat label="Views" value={snap.pageviews ?? 0} />
                          <Stat label="Visitors" value={snap.visitors ?? 0} />
                          <Stat label="Clicks" value={snap.ctaClicks ?? 0} />
                          {snap.revenue > 0 && <Stat label="Revenue" value={`$${(snap.revenue / 100).toFixed(0)}`} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeSummary ? (
            <div style={{ maxWidth: 740, margin: "0 auto" }}>
              {/* Quick stats — consistent treatment, no per-card color.
                  These are metrics, not statuses. */}
              <div className="zs-stat-bar" style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Pageviews", value: activeSummary.analytics_snapshot?.pageviews ?? 0, prev: activeSummary.analytics_snapshot?.prevPageviews },
                  { label: "Visitors", value: activeSummary.analytics_snapshot?.visitors ?? 0, prev: activeSummary.analytics_snapshot?.prevVisitors },
                  { label: "CTA Clicks", value: activeSummary.analytics_snapshot?.ctaClicks ?? 0, prev: activeSummary.analytics_snapshot?.prevCtaClicks },
                  { label: "Revenue", value: activeSummary.analytics_snapshot?.revenue ? `$${(activeSummary.analytics_snapshot.revenue / 100).toFixed(2)}` : "$0" },
                ].map((s, i) => (
                  <div key={i} className="zs-card" style={{ flex: 1, background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px 16px", animation: `zs-fadeUp 250ms ease ${i * 40}ms both` }}>
                    <div style={{ fontSize: 10, fontWeight: 500, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{typeof s.value === "number" ? s.value.toLocaleString() : s.value}</div>
                    {s.prev !== undefined && typeof s.value === "number" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: s.value > s.prev ? C.green : s.value < s.prev ? C.red : C.textMuted, marginTop: 6 }}>
                        {s.value > s.prev ? <ArrowUpIcon /> : s.value < s.prev ? <ArrowDownIcon /> : null}
                        vs last week ({s.prev})
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="zs-summary-text" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 24, animation: "zs-fadeUp 300ms ease 180ms both" }}>
                {renderText(activeSummary.summary_text)}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
              <div style={{ textAlign: "center", maxWidth: 380, animation: "zs-fadeUp 300ms ease 80ms both" }}>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>No weekly summaries yet</h1>
                <p style={{ margin: "10px auto 24px", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>
                  Generate your first weekly summary to see how your business is performing — traffic, clicks, and revenue, explained.
                </p>
                <button className="zs-btn-accent" onClick={generateSummary} disabled={generating} style={{ padding: "10px 24px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>
                  {generating ? "Generating…" : "Generate First Summary"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 12, color: C.textMuted }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{value}</span>
    </div>
  );
}