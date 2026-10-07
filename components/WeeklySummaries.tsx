"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatMessage } from "@/app/chat/formatMessage";
import { TesseractThinking } from "@/components/TesseractThinking";

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
  createdAt: number;
  animate?: boolean; // only real replies get the typewriter, not errors or "stopped"
  failed?: boolean; // error and "stopped" bubbles: shown to the user, never sent back to the model
}

/* Zelrex design tokens, same values as the C object in ChatPageClient.tsx. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentGlow: "rgba(74,144,255,0.15)", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  userBubble: "rgba(74,144,255,0.10)", userBorder: "rgba(74,144,255,0.15)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Icon paths copied from the main chat's Ic set so the buttons are identical. */
const ICONS: Record<string, React.ReactNode> = {
  copy: <><rect x="9" y="3" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" /><rect x="4" y="8" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" /></>,
  mic: <><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor" /><path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><path d="M12 19v2M8 21h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
  send: <path d="M20 12 4 20l4-8-4-8 16 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />,
  close: <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
  summary: <><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" /><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="15.5" cy="16" r="1.15" fill="currentColor" /></>,
};
const Ic = ({ n, style }: { n: keyof typeof ICONS; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 24 24" fill="none" style={style}>{ICONS[n]}</svg>
);
const ArrowUpIcon = ({ size = 10, color = C.green }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 19V5M5 12l7-7 7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const ArrowDownIcon = ({ size = 10, color = C.red }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const InlineArrow = ({ dir }: { dir: "↑" | "↓" | "→" }) => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: "inline-block", verticalAlign: "-1px", margin: "0 1px", color: C.textSec }}>
    <path d={dir === "↑" ? "M12 19V5M5 12l7-7 7 7" : dir === "↓" ? "M12 5v14M5 12l7 7 7-7" : "M5 12h14M12 5l7 7-7 7"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Spinner = ({ size = 12 }: { size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: 999, border: "2px solid rgba(255,255,255,0.25)", borderTopColor: "#fff", animation: "zs-spin 0.7s linear infinite", flexShrink: 0 }} />
);

/* The Z mark used as the assistant avatar in the main chat. */
function ZelrexZIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "block" }}>
      <text x="4" y="23" fill="#F0F4FC" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="24" fontStyle="italic">Z</text>
      <line x1="3" y1="28" x2="27" y2="28" stroke="url(#zszigrad)" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="zszigrad" x1="3" y1="28" x2="27" y2="28">
          <stop offset="0%" stopColor="#3B7BF6" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#4A90FF" />
          <stop offset="100%" stopColor="#5BA0FF" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* Same reveal the main chat uses for new replies. */
function Typewriter({ text, speed = 6, onFinish, onTick }: { text: string; speed?: number; onFinish?: () => void; onTick?: () => void }) {
  const [n, setN] = useState(0);
  const finishRef = useRef(onFinish);
  const tickRef = useRef(onTick);
  useEffect(() => { finishRef.current = onFinish; tickRef.current = onTick; }, [onFinish, onTick]);
  useEffect(() => {
    setN(0);
    let i = 0;
    const t = window.setInterval(() => {
      i++; setN(i);
      if (i % 12 === 0) tickRef.current?.();
      if (i >= text.length) { clearInterval(t); tickRef.current?.(); finishRef.current?.(); }
    }, speed);
    return () => clearInterval(t);
  }, [text, speed]);
  return <div>{formatMessage(text.slice(0, n))}</div>;
}

/* Questions worth asking about THIS week's numbers, picked from the data
   (no AI call). With very little traffic, the first one is the honest one. */
function suggestionsFor(a: any): string[] {
  const out: string[] = [];
  const visitors = a?.visitors ?? 0, clicks = a?.ctaClicks ?? 0, prevClicks = a?.prevCtaClicks, revenue = a?.revenue ?? 0;
  if (visitors < 30) out.push("Is this enough traffic to draw conclusions?");
  if (typeof prevClicks === "number" && clicks > prevClicks) out.push("What might explain the extra clicks?");
  else if (typeof prevClicks === "number" && clicks < prevClicks) out.push("Why might clicks have dropped?");
  if (revenue === 0 && clicks > 0) out.push("What could be slowing down sales?");
  out.push("What stands out most this week?", "What should I look at next week?");
  return out.slice(0, 3);
}

export function WeeklySummaries({ userId, userName, userEmail, onClose }: { userId: string; userName?: string; userEmail?: string; onClose: () => void }) {
  const [tab, setTab] = useState<"summary" | "history" | "chat">("summary");
  const [summaries, setSummaries] = useState<SummaryMeta[]>([]);
  const [activeSummary, setActiveSummary] = useState<SummaryFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genElapsed, setGenElapsed] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, "good" | "bad">>({});
  const [animatedIds, setAnimatedIds] = useState<string[]>([]);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const genAbortRef = useRef<AbortController | null>(null);
  const genTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  // Bumped whenever the conversation is reset or the summary changes, so a
  // reply that arrives late for the old conversation is dropped, not shown.
  const reqIdRef = useRef(0);

  const uid = () => Math.random().toString(36).slice(2, 10);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  useEffect(() => { const c = () => setIsMobile(window.innerWidth < 768); c(); window.addEventListener("resize", c); return () => window.removeEventListener("resize", c); }, []);
  useEffect(() => { if (!isMobile && tab === "chat") setTab("summary"); }, [isMobile, tab]);
  useEffect(() => () => { genAbortRef.current?.abort(); chatAbortRef.current?.abort(); if (genTimerRef.current) clearInterval(genTimerRef.current); }, []);

  const resetChat = () => {
    reqIdRef.current++;
    chatAbortRef.current?.abort();
    setChatMessages([]);
    setChatSending(false);
  };
  const activate = (s: SummaryFull) => { resetChat(); setActiveSummary(s); };

  const loadSummary = async (id: string) => {
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get", userId, summaryId: id }),
      });
      const data = await res.json();
      if (data.summary) { activate(data.summary); setTab("summary"); }
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

  // Generation shows elapsed time and can be cancelled. Cancelling stops the
  // wait on this screen; if the server already started it, the summary may
  // still show up in History later.
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
        activate(data.summary);
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

  /* ── Chat ─────────────────────────────────────────────────────────── */
  const ask = async (msg: string, base: ChatMsg[]) => {
    const text = msg.trim();
    if (!text || !activeSummary) return;
    const myReq = ++reqIdRef.current;
    const ctrl = new AbortController();
    chatAbortRef.current = ctrl;
    setChatMessages([...base, { id: uid(), role: "user", content: text, createdAt: Date.now() }]);
    setChatSending(true);
    try {
      const res = await fetch("/api/z/summary", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
        body: JSON.stringify({
          action: "chat", userId, summaryId: activeSummary.id, message: text,
          history: base.filter((m) => !m.failed).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      let data: any = null;
      try { data = await res.json(); } catch {}
      if (reqIdRef.current !== myReq) return;
      const reply = typeof data?.reply === "string" ? data.reply.trim() : "";
      if (!res.ok || !reply) {
        // Keep the server's actual answer in the console so a failure can be diagnosed.
        console.error("[Summaries] chat failed:", res.status, data);
        const why = !res.ok ? `error ${res.status}` : "empty reply";
        setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: `Something went wrong (${why}). Try again.`, createdAt: Date.now(), failed: true }]);
        return;
      }
      setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: reply, createdAt: Date.now(), animate: true }]);
    } catch (e: any) {
      if (reqIdRef.current !== myReq) return;
      const stopped = e?.name === "AbortError";
      if (!stopped) console.error("[Summaries] chat request failed:", e);
      setChatMessages((prev) => [...prev, { id: uid(), role: "assistant", content: stopped ? "_Response stopped._" : "Couldn't reach Zelrex. Check your connection and try again.", createdAt: Date.now(), failed: true }]);
    } finally {
      if (reqIdRef.current === myReq) { chatAbortRef.current = null; setChatSending(false); }
    }
  };

  const sendFromInput = () => {
    if (!chatInput.trim() || chatSending) return;
    const text = chatInput;
    setChatInput("");
    ask(text, chatMessages);
  };
  const stopChat = () => chatAbortRef.current?.abort();

  // Retry drops the last question and its answer, then asks again, so the
  // question never shows up twice.
  const retryLast = () => {
    if (chatSending) return;
    const idx = chatMessages.map((m) => m.role).lastIndexOf("user");
    if (idx < 0) return;
    ask(chatMessages[idx].content, chatMessages.slice(0, idx));
  };

  const startSpeech = () => {
    const S = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!S) return;
    const r = new S();
    r.lang = "en-US";
    r.start();
    setListening(true);
    r.onresult = (e: any) => { const t = e.results[0][0].transcript; setChatInput((p) => (p ? p + " " : "") + t); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
  };

  const copyMsg = (m: ChatMsg) => {
    navigator.clipboard.writeText(m.content);
    setCopiedMsgId(m.id);
    setTimeout(() => setCopiedMsgId(null), 1200);
  };

  // Same payload the main chat sends, so feedback lands in the same inbox.
  const sendFeedback = async (messageId: string, type: "good" | "bad") => {
    if (feedbackMap[messageId] === type) {
      setFeedbackMap((prev) => { const n = { ...prev }; delete n[messageId]; return n; });
      return;
    }
    setFeedbackMap((prev) => ({ ...prev, [messageId]: type }));
    try {
      await fetch("/api/z/contact", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName || "User",
          email: userEmail || "unknown",
          category: "feedback",
          message: `${type === "good" ? "👍" : "👎"} feedback on message ${messageId} in weekly summary ${activeSummary?.id || ""}`,
          feedbackType: type,
          messageId,
          chatId: activeSummary?.id || "",
        }),
      });
    } catch {}
  };

  // Same auto-grow as the main input: 42px up to 180px.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "42px";
    if (chatInput) el.style.height = `${Math.max(42, Math.min(180, el.scrollHeight))}px`;
  }, [chatInput]);

  // Jump to the bottom when a message is added; while a reply types out,
  // follow it only if the reader is already near the bottom.
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el && chatMessages.length > 0) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatMessages.length, chatSending]);
  const followIfNearBottom = () => {
    const el = chatScrollRef.current;
    if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 140) el.scrollTop = el.scrollHeight;
  };

  /* ── Summary rendering ───────────────────────────────────────────── */
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const formatWeek = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`;

  // Inline pieces: **bold**, *italic*, `code`, and the arrows the model likes to
  // type (↑ ↓ →), which become the same drawn arrows used everywhere else.
  const renderInline = (text: string): React.ReactNode[] =>
    text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*|[↑↓→])/g).filter((p) => p !== "").map((part, i) => {
      if (part.length > 4 && part.startsWith("**") && part.endsWith("**")) return <strong key={i} style={{ color: C.text, fontWeight: 600 }}>{part.slice(2, -2)}</strong>;
      if (part.length > 2 && part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: "0.88em", background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 6 }}>{part.slice(1, -1)}</code>;
      if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <em key={i}>{part.slice(1, -1)}</em>;
      if (part === "↑" || part === "↓" || part === "→") return <InlineArrow key={i} dir={part} />;
      return <span key={i}>{part}</span>;
    });

  // Decorative emoji the model adds to headings and bullets read as noise in a business document.
  const stripEmoji = (t: string) => {
    try { return t.replace(new RegExp("\\p{Extended_Pictographic}\\uFE0F?\\s*", "gu"), ""); } catch { return t; }
  };

  // The summary is markdown. Render headings, lists, quotes and rules properly
  // so no stray # or ** ever shows. A leading "# Title" is dropped because the
  // page heading above already says which week this is.
  const renderText = (raw: string) => {
    const lines = stripEmoji(raw).replace(/\r/g, "").split("\n");
    let i = 0;
    while (i < lines.length && !lines[i].trim()) i++;
    if (i < lines.length && /^#\s+/.test(lines[i].trim())) i++;
    const out: React.ReactNode[] = [];
    let prev: "none" | "heading" | "list" | "para" = "none";
    for (; i < lines.length; i++) {
      const line = lines[i];
      const t = line.trim();
      if (!t) continue;
      const key = `b${i}`;
      if (/^([-*_])\1{2,}$/.test(t)) { out.push(<div key={key} style={{ height: 1, background: C.border, margin: "28px 0 4px" }} />); prev = "none"; continue; }
      const h = t.match(/^(#{1,6})\s+(.*?)\s*#*$/);
      const boldOnly = t.match(/^\*\*([^*]+)\*\*:?$/);
      if (h || boldOnly) {
        const level = h ? (h[1].length <= 2 ? 2 : 3) : 3;
        const label = (h ? h[2] : boldOnly![1]).replace(/\*\*/g, "");
        const first = out.length === 0;
        out.push(level === 2
          ? <h2 key={key} style={{ margin: `${first ? 0 : 36}px 0 12px`, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.3, color: C.text }}>{renderInline(label)}</h2>
          : <h3 key={key} style={{ margin: `${first ? 0 : 24}px 0 8px`, fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.4, color: C.text }}>{renderInline(label)}</h3>);
        prev = "heading"; continue;
      }
      const bullet = line.match(/^(\s*)[-*•]\s+(.*)$/);
      if (bullet) {
        const nested = bullet[1].replace(/\t/g, "  ").length >= 2;
        out.push(
          <div key={key} style={{ display: "flex", gap: 12, margin: "0 0 7px", paddingLeft: nested ? 22 : 2 }}>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: C.textMuted, marginTop: 11, flexShrink: 0 }} />
            <span style={{ color: C.text, fontSize: 15, lineHeight: 1.7, minWidth: 0, overflowWrap: "anywhere" }}>{renderInline(bullet[2])}</span>
          </div>
        );
        prev = "list"; continue;
      }
      const num = t.match(/^(\d+)[.)]\s+(.*)$/);
      if (num) {
        out.push(
          <div key={key} style={{ display: "flex", gap: 10, margin: "0 0 7px", paddingLeft: 2 }}>
            <span style={{ color: C.textMuted, fontWeight: 600, fontSize: 14, minWidth: 20, lineHeight: 1.82, flexShrink: 0 }}>{num[1]}.</span>
            <span style={{ color: C.text, fontSize: 15, lineHeight: 1.7, minWidth: 0, overflowWrap: "anywhere" }}>{renderInline(num[2])}</span>
          </div>
        );
        prev = "list"; continue;
      }
      const quote = t.match(/^>\s?(.*)$/);
      if (quote) {
        out.push(<div key={key} style={{ margin: "0 0 14px", padding: "2px 0 2px 14px", borderLeft: `2px solid ${C.border}`, color: C.textSec, fontSize: 15, lineHeight: 1.7 }}>{renderInline(quote[1])}</div>);
        prev = "para"; continue;
      }
      out.push(<p key={key} style={{ margin: `${prev === "list" ? 10 : 0}px 0 14px`, color: C.text, fontSize: 15, lineHeight: 1.7, overflowWrap: "anywhere" }}>{renderInline(t)}</p>);
      prev = "para";
    }
    return out;
  };

  const snap = activeSummary?.analytics_snapshot || {};
  const metrics: { label: string; value: string; raw?: number; prev?: number }[] = activeSummary ? [
    { label: "Pageviews", value: (snap.pageviews ?? 0).toLocaleString(), raw: snap.pageviews ?? 0, prev: snap.prevPageviews },
    { label: "Visitors", value: (snap.visitors ?? 0).toLocaleString(), raw: snap.visitors ?? 0, prev: snap.prevVisitors },
    { label: "Clicks", value: (snap.ctaClicks ?? 0).toLocaleString(), raw: snap.ctaClicks ?? 0, prev: snap.prevCtaClicks },
    { label: "Revenue", value: snap.revenue ? `$${(snap.revenue / 100).toFixed(2)}` : "$0" },
  ] : [];

  const delta = (raw?: number, prev?: number) => {
    // No baseline (last week was 0) means "+16" just repeats the value, so show nothing.
    if (typeof raw !== "number" || typeof prev !== "number" || prev === 0 || raw === prev) return null;
    const up = raw > prev;
    const label = `${Math.round((Math.abs(raw - prev) / prev) * 100)}%`;
    return { up, label };
  };

  const hasSummaries = summaries.length > 0 || !!activeSummary;
  const chatVisible = (loading || hasSummaries) && (isMobile ? tab === "chat" : true);
  const mainVisible = !(isMobile && tab === "chat");
  const chatEmpty = chatMessages.length === 0 && !chatSending;
  const canSend = !!chatInput.trim();
  const tabs: [typeof tab, string][] = [["summary", "Summary"], ["history", "History"], ...(isMobile ? [["chat", "Ask"] as [typeof tab, string]] : [])];

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

        .zs-btn{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-btn:hover{background:rgba(255,255,255,0.04);color:${C.text}!important}
        .zs-btn-accent{transition:filter 150ms ${EASE},transform 100ms ${EASE};cursor:pointer}
        .zs-btn-accent:hover{filter:brightness(1.1)}
        .zs-btn-accent:active{transform:scale(0.98)}
        .zs-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE}!important;cursor:pointer;border-radius:999px!important}
        .zs-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
        .zs-btn-icon:active{background:rgba(255,255,255,0.10)!important;transition-duration:80ms!important}
        .zs-tab{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .zs-tab:hover{background:rgba(255,255,255,0.04)}
        .zs-tab.zs-tab-active,.zs-tab.zs-tab-active:hover{background:rgba(255,255,255,0.07)}
        .zs-card{transition:border-color 150ms ${EASE}}
        .zs-card:hover{border-color:${C.borderHover}!important}

        .zs-gs::-webkit-scrollbar{width:5px}
        .zs-gs::-webkit-scrollbar-track{background:transparent}
        .zs-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .zs-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

        /* Same top bar as every other panel: 52px, grid (1fr auto 1fr). */
        .zs-header{height:52px;padding:0 14px 0 20px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid ${C.border}}
        .zs-title{display:flex;align-items:center;gap:8px}
        .zs-actions{justify-self:end;display:flex;align-items:center;gap:6px}
        .zs-chat{width:clamp(280px,20vw,320px);flex-shrink:0;display:flex;flex-direction:column;border-right:1px solid ${C.border};min-height:0}

        /* ── Message actions: copied 1:1 from the main chat ── */
        .zs-msg-actions{display:flex;align-items:center;gap:2px;margin-top:6px;opacity:0.55;transition:opacity 400ms cubic-bezier(0.32,0.72,0,1)}
        .zs-msg-row:hover .zs-msg-actions{opacity:1}
        .zs-user-row .zs-msg-actions{opacity:0}
        .zs-user-row:hover .zs-msg-actions{opacity:1}
        .zs-user-row .zs-msg-act{color:rgba(255,255,255,0.55)}
        .zs-msg-act{display:flex;align-items:center;justify-content:center;width:30px;height:28px;border-radius:999px;border:1px solid transparent;background:transparent;color:${C.textMuted};cursor:pointer;transition:background 200ms ease,border-color 200ms ease,color 200ms ease;padding:0}
        .zs-msg-act:hover{background:rgba(255,255,255,0.06);border-color:rgba(255,255,255,0.12);color:${C.text}}
        .zs-msg-act:active{transform:scale(0.92) translateY(0);transition-duration:120ms}
        .zs-msg-act svg{width:15px;height:15px}
        .zs-user-time{font-size:11px;color:rgba(255,255,255,0.7);font-weight:500;letter-spacing:0.01em}
        .zs-welcome-link{background:none;border:none;padding:6px 12px;border-radius:999px;color:${C.textSec};font-size:14px;font-weight:500;letter-spacing:-0.005em;cursor:pointer;transition:background-color 150ms ${EASE},color 150ms ${EASE};font-family:inherit;text-align:center}
        .zs-welcome-link:hover{background:rgba(255,255,255,0.04);color:${C.text}}

        /* ── Input focus ring: same animation as the main input ── */
        .zs-input-focus-glow{animation:zsRingIn 600ms cubic-bezier(0.32,0.72,0,1) forwards,zsRingOut 600ms cubic-bezier(0.32,0.72,0,1) 500ms forwards}
        @keyframes zsRingIn{
          0%{border-color:rgba(255,255,255,0.07);box-shadow:0 4px 24px rgba(0,0,0,0.3),0 0 0 0px rgba(74,144,255,0),0 0 0px rgba(74,144,255,0)}
          60%{border-color:#5BA0FF;box-shadow:0 4px 24px rgba(0,0,0,0.3),0 0 0 3px rgba(74,144,255,0.35),0 0 32px rgba(74,144,255,0.15)}
          100%{border-color:#4A90FF;box-shadow:0 4px 24px rgba(0,0,0,0.3),0 0 0 2.5px rgba(74,144,255,0.25),0 0 20px rgba(74,144,255,0.10)}
        }
        @keyframes zsRingOut{
          0%{border-color:#4A90FF;box-shadow:0 4px 24px rgba(0,0,0,0.3),0 0 0 2.5px rgba(74,144,255,0.25),0 0 20px rgba(74,144,255,0.10)}
          100%{border-color:rgba(255,255,255,0.14);box-shadow:0 4px 24px rgba(0,0,0,0.3),0 0 0 0px rgba(74,144,255,0),0 0 0px rgba(74,144,255,0)}
        }

        @media(max-width:768px){
          .zs-header{height:auto;padding:10px 10px 10px 16px;grid-template-columns:1fr auto;grid-template-areas:"title actions" "tabs tabs";row-gap:8px}
          .zs-title{grid-area:title}
          .zs-actions{grid-area:actions}
          .zs-tabs{grid-area:tabs;justify-self:start}
          .zs-chat{width:100%;border-right:none}
          .zs-main{padding:18px 16px!important}
          .zs-strip-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
          .zs-strip-wrap::-webkit-scrollbar{display:none}
          .zs-msg-actions{opacity:1}
          .zs-msg-act{width:36px!important;height:34px!important}
          .zs-msg-act svg{width:17px!important;height:17px!important}
        }
        @supports(padding-bottom:env(safe-area-inset-bottom)){
          .zs-input-area{padding-bottom:calc(12px + env(safe-area-inset-bottom))!important}
        }
      `}</style>

      <div className="zs-header">
        <div className="zs-title">
          <Ic n="summary" style={{ width: 16, height: 16, color: C.green }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Weekly Summaries</span>
        </div>

        <div className="zs-tabs" style={{ display: "flex", gap: 2, visibility: hasSummaries ? "visible" : "hidden" }}>
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? "zs-tab zs-tab-active" : "zs-tab"} onClick={() => setTab(id)} style={{ padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500, color: tab === id ? C.text : C.textSec }}>{label}</button>
          ))}
        </div>

        <div className="zs-actions">
          {hasSummaries && generateControl()}
          <button className="zs-btn-icon" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="close" style={{ width: 17, height: 17 }} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* ── Side chat: the main chat's messages and input, smaller ── */}
        {chatVisible && (
          <aside className="zs-chat">
            <div style={{ height: 44, padding: "0 8px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: C.textMuted }}>{activeSummary ? `About ${formatWeek(activeSummary.week_start, activeSummary.week_end)}` : ""}</span>
              {chatMessages.length > 0 && <button className="zs-btn" onClick={resetChat} style={{ padding: "5px 10px", borderRadius: 999, fontSize: 12, color: C.textSec }}>Clear</button>}
            </div>

            <div ref={chatScrollRef} className="zs-gs" style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column" }}>
              {chatEmpty && activeSummary ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center", animation: "zs-fadeUp 300ms ease 60ms both" }}>
                    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, marginBottom: 10 }}>Ask about this week</div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                      {suggestionsFor(snap).map((q) => <button key={q} type="button" className="zs-welcome-link" onClick={() => ask(q, [])}>{q}</button>)}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  {chatMessages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={m.id} className={isUser ? "zs-user-row" : "zs-msg-row"} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16, gap: 10, animation: "zs-fadeUp 200ms ease" }}>
                        {!isUser && <div style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2 }}><ZelrexZIcon size={26} /></div>}
                        <div style={{ maxWidth: isUser ? "100%" : "calc(100% - 36px)", minWidth: 0 }}>
                          {isUser ? (
                            <>
                              <div style={{ display: "inline-block", padding: "8px 16px", borderRadius: 999, background: C.userBubble, border: `1px solid ${C.userBorder}`, maxWidth: "100%" }}>
                                <div style={{ fontSize: 15, lineHeight: 1.7, color: C.text, overflowWrap: "anywhere" }}>{m.content}</div>
                              </div>
                              <div className="zs-msg-actions" style={{ justifyContent: "flex-end" }}>
                                <span className="zs-user-time" style={{ marginRight: 4 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                                <button className="zs-msg-act" title="Copy" onClick={() => copyMsg(m)}><Ic n="copy" /></button>
                                {copiedMsgId === m.id && <span style={{ fontSize: 10, color: C.accent, fontWeight: 500, marginLeft: 4 }}>Copied</span>}
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: "4px 0 4px 14px", borderLeft: `2px solid ${C.accent}18` }}>
                              {m.animate && !animatedIds.includes(m.id) ? (
                                <Typewriter text={m.content} speed={6} onTick={followIfNearBottom} onFinish={() => setAnimatedIds((p) => p.includes(m.id) ? p : [...p, m.id])} />
                              ) : (
                                <div className="zs-msg-content">{formatMessage(m.content)}</div>
                              )}
                              <div className="zs-msg-actions">
                                <button className="zs-msg-act" title="Copy" onClick={() => copyMsg(m)}><Ic n="copy" /></button>
                                <button className="zs-msg-act" title="Good response" onClick={() => sendFeedback(m.id, "good")} style={feedbackMap[m.id] === "good" ? { color: "#34D399" } : undefined}>
                                  <svg viewBox="0 0 24 24" fill={feedbackMap[m.id] === "good" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12" /><path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2a3.13 3.13 0 013 3.88z" /></svg>
                                </button>
                                <button className="zs-msg-act" title="Bad response" onClick={() => sendFeedback(m.id, "bad")} style={feedbackMap[m.id] === "bad" ? { color: "#F87171" } : undefined}>
                                  <svg viewBox="0 0 24 24" fill={feedbackMap[m.id] === "bad" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2" /><path d="M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22a3.13 3.13 0 01-3-3.88z" /></svg>
                                </button>
                                <button className="zs-msg-act" title="Retry" onClick={retryLast}>
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>
                                </button>
                              </div>
                              {copiedMsgId === m.id && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>Copied</div>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {chatSending && <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}><TesseractThinking /></div>}
                </div>
              )}
            </div>

            {/* Input box and disclaimer: the main chat's, minus the attach button */}
            <div className="zs-input-area" style={{ padding: "8px 14px 12px", flexShrink: 0 }}>
              {/* The main chat's + button attaches images and files. This side chat
                  doesn't have that yet: its endpoint isn't known to accept them. */}
              <div className={inputFocused ? "zs-input-focus-glow" : undefined} style={{ position: "relative", borderRadius: 24, border: `1px solid ${inputFocused ? C.borderHover : C.border}`, background: C.bgInput, boxShadow: "0 4px 24px rgba(0,0,0,0.3)", transition: "border-color 500ms cubic-bezier(0.32,0.72,0,1), box-shadow 500ms cubic-bezier(0.32,0.72,0,1)" }}>
                <div style={{ display: "flex", alignItems: "center", padding: isMobile ? "4px 6px" : "4px 8px" }}>
                  <textarea
                    ref={textareaRef}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFromInput(); } }}
                    placeholder="Ask about this week"
                    aria-label="Ask about this week"
                    disabled={!activeSummary}
                    style={{ flex: 1, minWidth: 0, maxHeight: 200, minHeight: isMobile ? 44 : 42, height: isMobile ? 44 : 42, resize: "none", background: "none", border: "none", outline: "none", padding: isMobile ? "11px 8px 11px 14px" : "10px 8px 10px 14px", fontSize: isMobile ? 16 : 14, lineHeight: 1.5, color: C.text, boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                  <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 2 }}>
                    <button type="button" onClick={startSpeech} className="zs-btn-icon" aria-label="Voice input" style={{ width: isMobile ? 42 : 38, height: isMobile ? 42 : 38, background: "none", border: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", color: listening ? C.accent : C.textMuted }}>
                      <Ic n="mic" style={{ width: 20, height: 20 }} />
                    </button>
                    <button
                      type="button"
                      onClick={chatSending ? stopChat : sendFromInput}
                      title={chatSending ? "Stop generation" : "Send message"}
                      aria-label={chatSending ? "Stop generation" : "Send message"}
                      style={{
                        width: isMobile ? 42 : 38, height: isMobile ? 42 : 38, border: "none", borderRadius: 999, cursor: "pointer",
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        background: chatSending ? "#EF4444" : canSend ? C.accent : "rgba(255,255,255,0.06)",
                        color: chatSending || canSend ? "#fff" : C.textMuted,
                        boxShadow: chatSending ? "0 2px 10px rgba(239,68,68,0.4)" : canSend ? `0 2px 10px ${C.accentGlow}` : "none",
                        transition: "all 200ms ease",
                      }}>
                      {chatSending ? <Ic n="stop" style={{ width: 18, height: 18 }} /> : <Ic n="send" style={{ width: 20, height: 20 }} />}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 500, color: C.textSec }}>Zelrex can make mistakes. Check important info before making business decisions.</div>
            </div>
          </aside>
        )}

        {/* ── Summary ── */}
        {mainVisible && (
          <div className="zs-gs zs-main" style={{ flex: 1, minWidth: 0, overflow: "auto", padding: "28px 36px", display: "flex", flexDirection: "column" }}>
            {loading ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 32, height: 32, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "zs-spin 0.8s linear infinite" }} />
              </div>
            ) : !hasSummaries ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", maxWidth: 380, animation: "zs-fadeUp 300ms ease 80ms both" }}>
                  <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>How did your week go?</h1>
                  <p style={{ margin: "10px auto 24px", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>Zelrex looks at your traffic, clicks, and revenue and explains what changed.</p>
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
              <div style={{ maxWidth: 640, width: "100%", margin: "0 auto", animation: "zs-fadeUp 250ms ease both" }}>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.2, color: C.text }}>{formatWeek(activeSummary.week_start, activeSummary.week_end)}</h1>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
                  Generated {new Date(activeSummary.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}{activeSummary.auto_generated ? " · Auto" : ""}
                </div>

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

                <div>{renderText(activeSummary.summary_text)}</div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}