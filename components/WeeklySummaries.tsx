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

/* Zelrex design tokens — same values as the C object in ChatPageClient.tsx. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  userBubble: "rgba(74,144,255,0.10)", userBorder: "rgba(74,144,255,0.15)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Drawn icons, same set and stroke as the main interface. The header icon is
   the exact drawing and color the sidebar uses for Weekly Summaries. */
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const SummarySheetIcon = ({ size = 16, color = C.green }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke={color} strokeWidth="1.5" /><path d="M8 8h8M8 12h8M8 16h5" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><circle cx="15.5" cy="16" r="1.15" fill={color} /></svg>
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
const Spinner = ({ size = 12 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 999, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "zs-spin 0.7s linear infinite", flexShrink: 0 }} />
);

export function WeeklySummaries({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "history">("summary");
  const [summaries, setSummaries] = useState<SummaryMeta[]>([]);
  const [activeSummary, setActiveSummary] = useState<SummaryFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genElapsed, setGenElapsed] = useState(0);
  const [mounted, setMounted] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const uid = () => Math.random().toString(36).slice(2, 10);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  useEffect(() => () => { genAbortRef.current?.abort(); if (genTimerRef.current) clearInterval(genTimerRef.current); }, []);

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
        setTab("summary");
      }
    } catch (e) {
      console.error("[Summaries] Get failed:", e);
    }
  };

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

  // Generation can take a while, so it shows elapsed time and can be
  // cancelled. Cancelling stops the wait on this screen; if the server has
  // already started the summary it may still appear in History later.
  const generateSummary = async () => {
    setGenerating(true);
    setGenElapsed(0);
    const ctrl = new AbortController();
    genAbortRef.current = ctrl;
    if (genTimerRef.current) clearInterval(genTimerRef.current);
    genTimerRef.current = setInterval(() => setGenElapsed((e) => e + 1), 1000);
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({ action: "generate", userId }),
      });
      const data = await res.json();
      if (data.summary) {
        setActiveSummary(data.summary);
        setChatMessages([]);
        setSummaries((prev) => [data.summary, ...prev]);
        setTab("summary");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("[Summaries] Generate failed:", e);
    } finally {
      genAbortRef.current = null;
      if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; }
      setGenerating(false);
    }
  };
  const cancelGenerating = () => genAbortRef.current?.abort();

  const sendChat = async (override?: string) => {
    const msg = (override ?? chatInput).trim();
    if (!msg || !activeSummary || chatSending) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { id: uid(), role: "user", content: msg }]);
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

  // Only follow the conversation once there is one. Without this guard the
  // page would jump to the bottom the moment the summary opens.
  useEffect(() => { if (chatMessages.length > 0) chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chatMessages, chatSending]);

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formatWeek = (start: string, end: string) => `${formatDate(start)} — ${formatDate(end)}`;

  const renderInline = (text: string) =>
    text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>
        : <span key={i}>{part}</span>
    );

  // Markdown-lite: bold headers, bullets, numbered lines. Markers are muted
  // (accent is reserved for actions), bullets are a drawn dot, not a glyph.
  const renderText = (text: string) =>
    text.split("\n").map((line, i) => {
      const t = line.trim();
      if (!t) return <div key={i} style={{ height: 8 }} />;
      if (t.startsWith("**") && t.endsWith("**")) {
        return <div key={i} style={{ fontWeight: 600, color: C.text, fontSize: 15, letterSpacing: "-0.01em", marginTop: i > 0 ? 22 : 0, marginBottom: 8 }}>{t.replace(/\*\*/g, "")}</div>;
      }
      if (t.startsWith("- ") || t.startsWith("• ")) {
        return (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 6, paddingLeft: 2 }}>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: C.textMuted, marginTop: 10, flexShrink: 0 }} />
            <span style={{ color: C.textSec, fontSize: 14, lineHeight: 1.7 }}>{renderInline(t.slice(2))}</span>
          </div>
        );
      }
      const num = t.match(/^(\d+)\.\s*(.*)/);
      if (num) {
        return (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 6, paddingLeft: 2 }}>
            <span style={{ color: C.textMuted, fontWeight: 600, fontSize: 13, minWidth: 18, lineHeight: 1.85, flexShrink: 0 }}>{num[1]}.</span>
            <span style={{ color: C.textSec, fontSize: 14, lineHeight: 1.7 }}>{renderInline(num[2])}</span>
          </div>
        );
      }
      return <p key={i} style={{ color: C.textSec, fontSize: 14, lineHeight: 1.7, margin: "0 0 6px" }}>{renderInline(t)}</p>;
    });

  const snap = activeSummary?.analytics_snapshot || {};
  const metrics: { label: string; value: number | string; raw?: number; prev?: number }[] = activeSummary ? [
    { label: "Pageviews", value: (snap.pageviews ?? 0).toLocaleString(), raw: snap.pageviews ?? 0, prev: snap.prevPageviews },
    { label: "Visitors", value: (snap.visitors ?? 0).toLocaleString(), raw: snap.visitors ?? 0, prev: snap.prevVisitors },
    { label: "Clicks", value: (snap.ctaClicks ?? 0).toLocaleString(), raw: snap.ctaClicks ?? 0, prev: snap.prevCtaClicks },
    { label: "Revenue", value: snap.revenue ? `$${(snap.revenue / 100).toFixed(2)}` : "$0" },
  ] : [];

  // Percent change vs last week, shown only when there's a real baseline.
  const delta = (raw?: number, prev?: number) => {
    if (typeof raw !== "number" || typeof prev !== "number" || raw === prev) return null;
    const up = raw > prev;
    const label = prev > 0 ? `${Math.round((Math.abs(raw - prev) / prev) * 100)}%` : `+${raw}`;
    return { up, label };
  };

  const hasSummaries = summaries.length > 0 || !!activeSummary;
  const showInput = !loading && tab === "summary" && !!activeSummary;

  const generateControl = (large = false) => generating ? (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: large ? "10px 20px" : "7px 14px", borderRadius: 999, background: C.accent, color: "#fff", fontSize: large ? 13 : 12, fontWeight: 600, opacity: 0.8 }}>
        <Spinner />Generating… <span style={{ fontVariantNumeric: "tabular-nums" }}>{genElapsed}s</span>
      </div>
      <button className="zs-btn" onClick={cancelGenerating} style={{ padding: large ? "10px 14px" : "7px 12px", borderRadius: 999, color: C.textSec, fontSize: large ? 13 : 12, fontWeight: 500 }}>Cancel</button>
    </div>
  ) : (
    <button className="zs-btn-accent" onClick={generateSummary} style={{ padding: large ? "10px 22px" : "7px 14px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: large ? 13 : 12, fontWeight: 600 }}>
      {large ? "Generate summary" : "Generate new"}
    </button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9600, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}` }}>
      <style>{`
        @keyframes zs-spin{to{transform:rotate(360deg)}}
        @keyframes zs-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes zs-pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}

        .zs-btn{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-btn:hover{background:rgba(255,255,255,0.04);color:${C.text}!important}
        .zs-btn-accent{transition:filter 150ms ${EASE},transform 100ms ${EASE};cursor:pointer}
        .zs-btn-accent:hover{filter:brightness(1.1)}
        .zs-btn-accent:active{transform:scale(0.98)}
        .zs-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
        .zs-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
        .zs-tab{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-tab:hover{background:rgba(255,255,255,0.04)}
        .zs-tab.zs-tab-active,.zs-tab.zs-tab-active:hover{background:rgba(255,255,255,0.07)}
        .zs-card{transition:border-color 150ms ${EASE}}
        .zs-card:hover{border-color:${C.borderHover}!important}
        .zs-link{transition:color 150ms ${EASE};cursor:pointer;background:none;border:none;padding:0;text-align:left;font-family:inherit}
        .zs-link:hover{color:${C.text}!important}
        .zs-input-wrap{transition:border-color 150ms ${EASE}}
        .zs-input-wrap:focus-within{border-color:${C.borderHover}}

        .zs-gs::-webkit-scrollbar{width:5px}
        .zs-gs::-webkit-scrollbar-track{background:transparent}
        .zs-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .zs-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

        /* Same top bar as every other panel: 52px, grid (1fr auto 1fr) so the
           tabs sit on the true center of the page. */
        .zs-header{height:52px;padding:0 14px 0 20px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid ${C.border}}
        .zs-title{display:flex;align-items:center;gap:8px}
        .zs-actions{justify-self:end;display:flex;align-items:center;gap:6px}

        @media(max-width:768px){
          .zs-header{height:auto;padding:10px 10px 10px 16px;grid-template-columns:1fr auto;grid-template-areas:"title actions" "tabs tabs";row-gap:8px}
          .zs-title{grid-area:title}
          .zs-actions{grid-area:actions}
          .zs-tabs{grid-area:tabs;justify-self:start}
          .zs-body{padding:18px 16px!important}
          .zs-strip-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .zs-strip-wrap::-webkit-scrollbar{display:none}
        }
        @supports(padding-bottom:env(safe-area-inset-bottom)){
          .zs-input-area{padding-bottom:calc(14px + env(safe-area-inset-bottom))!important}
        }
      `}</style>

      <div className="zs-header">
        <div className="zs-title">
          <SummarySheetIcon size={16} color={C.green} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Weekly Summaries</span>
        </div>

        <div className="zs-tabs" style={{ display: "flex", gap: 2, visibility: hasSummaries ? "visible" : "hidden" }}>
          {([["summary", "Summary"], ["history", "History"]] as const).map(([id, label]) => (
            <button key={id} className={tab === id ? "zs-tab zs-tab-active" : "zs-tab"} onClick={() => setTab(id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500, color: tab === id ? C.text : C.textSec }}>{label}</button>
          ))}
        </div>

        <div className="zs-actions">
          {hasSummaries && generateControl()}
          <button className="zs-btn-icon" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={17} /></button>
        </div>
      </div>

      <div className="zs-gs zs-body" style={{ flex: 1, overflow: "auto", padding: "28px 24px", display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "zs-spin 0.8s linear infinite" }} />
          </div>
        ) : !hasSummaries ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: 380, animation: "zs-fadeUp 300ms ease 80ms both" }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>How did your week go?</h1>
              <p style={{ margin: "10px auto 24px", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>
                Zelrex looks at your traffic, clicks, and revenue and explains what changed.
              </p>
              {generateControl(true)}
            </div>
          </div>
        ) : tab === "history" ? (
          <div style={{ maxWidth: 680, width: "100%", margin: "0 auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {summaries.map((s, i) => {
                const a = s.analytics_snapshot || {};
                const parts = [`${(a.pageviews ?? 0).toLocaleString()} views`, `${(a.visitors ?? 0).toLocaleString()} visitors`, `${(a.ctaClicks ?? 0).toLocaleString()} clicks`];
                if (a.revenue > 0) parts.push(`$${(a.revenue / 100).toFixed(0)}`);
                const isActive = activeSummary?.id === s.id;
                return (
                  <button key={s.id} className="zs-card" onClick={() => loadSummary(s.id)} style={{ background: C.bgElevated, border: `1px solid ${isActive ? C.accent + "55" : C.border}`, borderRadius: 14, padding: "16px 18px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: "inherit", animation: `zs-fadeUp 220ms ease ${i * 30}ms both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{formatWeek(s.week_start, s.week_end)}</span>
                      <span style={{ fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }}>
                        {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}{s.auto_generated ? " · Auto" : ""}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted }}>{parts.join(" · ")}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : activeSummary ? (
          <div style={{ maxWidth: 680, width: "100%", margin: "0 auto", animation: "zs-fadeUp 250ms ease both" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, color: C.text }}>{formatWeek(activeSummary.week_start, activeSummary.week_end)}</h1>
            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
              Generated {new Date(activeSummary.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{activeSummary.auto_generated ? " · Auto" : ""}
            </div>

            {/* One strip, not four boxes — same pattern as Outreach. */}
            <div className="zs-strip-wrap" style={{ marginTop: 20, marginBottom: 28 }}>
              <div style={{ display: "inline-flex", alignItems: "center", background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 999, padding: "9px 6px" }}>
                {metrics.map((m, i) => {
                  const d = delta(m.raw, m.prev);
                  return (
                    <React.Fragment key={m.label}>
                      <div title={typeof m.prev === "number" ? `Last week: ${m.prev}` : undefined} style={{ display: "flex", alignItems: "baseline", gap: 7, padding: "0 16px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 500 }}>{m.label}</span>
                        <span style={{ fontSize: 13, color: C.text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{m.value}</span>
                        {d && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: d.up ? C.green : C.red }}>
                            {d.up ? <ArrowUpIcon /> : <ArrowDownIcon />}{d.label}
                          </span>
                        )}
                      </div>
                      {i < metrics.length - 1 && <div style={{ width: 1, height: 14, background: C.border }} />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* The summary reads like a document: no card around it. */}
            <div>{renderText(activeSummary.summary_text)}</div>

            {/* Follow-up questions use the main chat's message styling. */}
            <div style={{ marginTop: 36, paddingTop: 24, borderTop: `1px solid ${C.border}` }}>
              {chatMessages.length === 0 ? (
                <div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 10 }}>Ask about this week</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                    {["How can I improve my click rate?", "What should I post this week?", "Why is my traffic low?"].map((q) => (
                      <button key={q} className="zs-link" onClick={() => setChatInput(q)} style={{ fontSize: 13, color: C.textSec }}>{q}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {chatMessages.map((m) => m.role === "user" ? (
                    <div key={m.id} style={{ display: "flex", justifyContent: "flex-end", animation: "zs-fadeUp 200ms ease" }}>
                      <div style={{ display: "inline-block", maxWidth: "85%", padding: "8px 16px", borderRadius: 999, background: C.userBubble, border: `1px solid ${C.userBorder}`, color: C.text, fontSize: 14, lineHeight: 1.5 }}>{m.content}</div>
                    </div>
                  ) : (
                    <div key={m.id} style={{ padding: "4px 0 4px 14px", borderLeft: `2px solid ${C.accent}18`, color: C.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap", animation: "zs-fadeUp 200ms ease" }}>{m.content}</div>
                  ))}
                  {chatSending && (
                    <div style={{ display: "flex", gap: 4, padding: "6px 0 6px 14px" }}>
                      {[0, 1, 2].map((i) => <div key={i} style={{ width: 5, height: 5, borderRadius: 999, background: C.textMuted, animation: `zs-pulse 1s ease-in-out ${i * 0.15}s infinite` }} />)}
                    </div>
                  )}
                </div>
              )}
              <div ref={chatEndRef} style={{ height: 1 }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Message box and disclaimer, same as the main chat. */}
      {showInput && (
        <div className="zs-input-area" style={{ padding: "10px 16px 14px", flexShrink: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div className="zs-input-wrap" style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.border}`, borderRadius: 999, background: C.bgInput, padding: "6px 6px 6px 20px" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                placeholder="Ask about this week"
                aria-label="Ask about this week"
                style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", color: C.text, fontSize: 15, fontFamily: "inherit", padding: "8px 0" }}
              />
              <button className="zs-btn-icon" onClick={() => sendChat()} disabled={!chatInput.trim() || chatSending} aria-label="Send" style={{
                width: 34, height: 34, border: "none", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                background: chatInput.trim() ? C.accent : "transparent", color: chatInput.trim() ? "#fff" : C.textMuted,
                cursor: chatInput.trim() ? "pointer" : "default",
              }}><SendIcon size={15} /></button>
            </div>
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 500, color: C.textSec }}>Zelrex can make mistakes. Check important info before making business decisions.</div>
          </div>
        </div>
      )}
    </div>
  );
}