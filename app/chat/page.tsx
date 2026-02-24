"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatMessage } from "./formatMessage";
import { WebsiteSurvey, SurveyData } from "@/website/pages/components/Websitesurvey";

type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string; createdAt: number; previewUrl?: string };
type Chat = { id: string; title: string; messages: Msg[]; updatedAt: number; pendingSurvey?: boolean };
type DraftAttachment = { id: string; file: File; kind: "image" | "file"; previewUrl?: string };
type BusinessPhase = "ready" | "intake" | "evaluating" | "building" | "live";

const STORAGE_KEY = "zelrex_chats_v1";
const ANIMATED_KEY = "zelrex_animated_ids"; // persist animated IDs so typewriter never replays

const C = {
  bg: "#06090F", bgSurface: "#0A0F1A", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentGlow: "rgba(74,144,255,0.15)", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  userBubble: "rgba(74,144,255,0.10)", userBorder: "rgba(74,144,255,0.15)",
};

function uid(p = "id") { return `${p}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`; }
function safeJson<T>(v: string | null, f: T): T { if (!v) return f; try { return JSON.parse(v); } catch { return f; } }
function cx(...xs: Array<string | false | undefined | null>) { return xs.filter(Boolean).join(" "); }

function makeTitle(text: string) {
  const w = text.trim().replace(/\s+/g, " ").replace(/[^\w\s'-]/g, "").split(" ").filter(Boolean).slice(0, 5);
  const t = w.map((s) => (s.length <= 2 ? s.toLowerCase() : s[0].toUpperCase() + s.slice(1))).join(" ");
  return t.length > 30 ? t.slice(0, 30).trim() + "\u2026" : t || "New chat";
}

function detectPhase(msgs: Msg[]): BusinessPhase {
  if (!msgs.length) return "ready";
  const r = msgs.slice(-5).map((m) => m.content.toLowerCase()).join(" ");
  if (msgs.some((m) => m.previewUrl) || r.includes("site is ready")) return "live";
  if (r.includes("building") || r.includes("generating")) return "building";
  if (r.includes("market evaluation") || r.includes("evaluating")) return "evaluating";
  if (msgs.length >= 2) return "intake";
  return "ready";
}

function getBusinessName(msgs: Msg[]): string | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "assistant" && msgs[i].previewUrl) {
      const m = msgs[i].content.match(/\*\*(.+?)\*\*/);
      if (m) return m[1];
    }
  }
  return null;
}

// ─── ICONS ─────────────────────────────────────────────────────────
function Ic({ n, className, style }: { n: string; className?: string; style?: React.CSSProperties }) {
  const cls = cx("inline-block", className);
  const d: Record<string, React.ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    close: <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    plus: <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    compose: <><path d="M12 20h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
    search: <><path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="1.6" /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    copy: <><rect x="9" y="3" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" /><rect x="4" y="8" width="11" height="13" rx="2" stroke="currentColor" strokeWidth="1.4" /></>,
    dots: <><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></>,
    trash: <path d="M9 3h6m-9 4h12m-10 0 1 14h6l1-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />,
    pencil: <><path d="M12 20h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
    send: <path d="M20 12 4 20l4-8-4-8 16 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />,
    user: <><path d="M20 21a8 8 0 1 0-16 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" stroke="currentColor" strokeWidth="1.6" /></>,
    mic: <><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3z" fill="currentColor" /><path d="M19 11v1a7 7 0 0 1-14 0v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><path d="M12 19v2M8 21h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
    rocket: <><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>,
    chart: <><path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 17V9M13 17V5M8 17v-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
    target: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="2" fill="currentColor" /></>,
    preview: <><rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
    flag: <><path d="M6 3v18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /><path d="M6 5c2-1 4-1 6 0s4 1 6 0v8c-2 1-4 1-6 0s-4-1-6 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
    settings: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" /><path d="M12 1v2m0 18v2m-9-11h2m18 0h2m-3.3-6.7-1.4 1.4M4.7 19.3l-1.4-1.4m0-11.6 1.4 1.4m14.2 14.2-1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
    signin: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
    bolt: <><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>,
  };
  return <svg className={cls} style={style} viewBox="0 0 24 24" fill="none">{d[n]}</svg>;
}

// ─── ZELREX BRAND MARKS ─────────────────────────────────────────────

function ZelrexWordmark({ size = 16 }: { size?: number }) {
  const h = size;
  const w = h * 5.2;
  return (
    <svg width={w} height={h + 10} viewBox="0 0 156 40" fill="none" style={{ display: "block", marginLeft: 4 }}>
      <text x="2" y="26" fill="#E8ECF4" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="28" letterSpacing="4" fontStyle="italic">ZELREX</text>
      <rect x="2" y="29" width="140" height="6" rx="3" fill="url(#wgrad)" />
      <defs>
        <linearGradient id="wgrad" x1="2" y1="32" x2="142" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5FB2FF" stopOpacity="1" />
          <stop offset="30%" stopColor="#3B8CFF" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#2351A8" stopOpacity="0.45" />
          <stop offset="85%" stopColor="#172238" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0B1220" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ZelrexZIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" style={{ display: "block" }}>
      <text x="4" y="23" fill="#F0F4FC" fontFamily="Inter, system-ui, sans-serif" fontWeight="800" fontSize="24" fontStyle="italic">Z</text>
      <line x1="3" y1="28" x2="27" y2="28" stroke="url(#zigrad)" strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="zigrad" x1="3" y1="28" x2="27" y2="28">
          <stop offset="0%" stopColor="#3B7BF6" stopOpacity="0.3" />
          <stop offset="50%" stopColor="#4A90FF" />
          <stop offset="100%" stopColor="#5BA0FF" stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── SUB-COMPONENTS ────────────────────────────────────────────────

function ZelrexThinking({ stage }: { stage?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
      <span style={{ color: C.textSec, fontSize: 14 }}>{stage || "Thinking\u2026"}</span>
      <style>{`
        .z-momentum-line{position:absolute;bottom:-2px;left:0;width:100%;height:2px;background:linear-gradient(90deg,transparent,${C.accent},transparent);border-radius:2px;animation:zml 1.3s ease-in-out infinite}
        @keyframes zml{0%{opacity:0;transform:translateX(-90%)}35%{opacity:1}65%{opacity:1}100%{opacity:0;transform:translateX(90%)}}
      `}</style>
    </div>
  );
}

function Typewriter({ text, speed = 8, onFinish }: { text: string; speed?: number; onFinish?: () => void }) {
  const [n, setN] = useState(0);
  const cbRef = useRef(onFinish);
  useEffect(() => { cbRef.current = onFinish; }, [onFinish]);
  useEffect(() => { setN(0); let i = 0; const t = window.setInterval(() => { i++; setN(i); if (i >= text.length) { clearInterval(t); cbRef.current?.(); } }, speed); return () => clearInterval(t); }, [text, speed]);
  return <div>{formatMessage(text.slice(0, n))}</div>;
}

function StatusBar({ phase, businessName, sidebarOpen }: { phase: BusinessPhase; businessName: string | null; sidebarOpen: boolean }) {
  const phases: { key: BusinessPhase; label: string }[] = [
    { key: "ready", label: "Start" },
    { key: "intake", label: "Discovery" },
    { key: "evaluating", label: "Evaluation" },
    { key: "building", label: "Website" },
    { key: "live", label: businessName || "Live" },
  ];
  const currentIdx = phases.findIndex((p) => p.key === phase);
  const accentColor = phase === "live" ? "#10B981" : phase === "building" ? "#8B5CF6" : phase === "evaluating" ? "#F59E0B" : C.accent;

  const leftOffset = sidebarOpen ? 260 : 0;

  return (
    <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 0, borderBottom: `1px solid ${C.border}`, background: currentIdx > 0 ? `linear-gradient(90deg, transparent, ${accentColor}06, transparent)` : "transparent", padding: "0 20px", marginLeft: leftOffset, width: `calc(100% - ${leftOffset}px)`, transition: "margin-left 300ms cubic-bezier(0.2,0,0,1), width 300ms cubic-bezier(0.2,0,0,1)" }}>
      {phases.map((p, i) => {
        const isDone = i < currentIdx;
        const isCurrent = i === currentIdx;
        const color = isDone ? "#10B981" : isCurrent ? accentColor : C.textMuted;
        return (
          <React.Fragment key={p.key}>
            {i > 0 && <div style={{ width: 32, height: 1, background: isDone ? "#10B981" : C.border, margin: "0 2px", transition: "background 500ms" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: color, boxShadow: isCurrent ? `0 0 8px ${color}` : "none", transition: "all 500ms", animation: isCurrent && (phase === "evaluating" || phase === "building") ? "zp 2s ease infinite" : "none" }} />
              <span style={{ fontSize: 10, fontWeight: isCurrent ? 700 : 500, color, letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 300ms" }}>{p.label}</span>
            </div>
          </React.Fragment>
        );
      })}
      <style>{`@keyframes zp{0%,100%{opacity:1}50%{opacity:.35}}`}</style>
    </div>
  );
}

function fireConfetti() {
  const count = 120;
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(container);
  const colors = ["#4A90FF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4", "#fff"];
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    const c = colors[Math.floor(Math.random() * colors.length)];
    const x = Math.random() * 100;
    const delay = Math.random() * 0.6;
    const dur = 1.8 + Math.random() * 1.5;
    const size = 4 + Math.random() * 6;
    const drift = (Math.random() - 0.5) * 200;
    const spin = Math.random() * 720 - 360;
    const shape = Math.random() > 0.5 ? "50%" : `${Math.random() * 3}px`;
    p.style.cssText = `position:absolute;top:-10px;left:${x}%;width:${size}px;height:${size * (0.6 + Math.random() * 0.8)}px;background:${c};border-radius:${shape};opacity:0;animation:zconf ${dur}s ${delay}s ease-out forwards`;
    p.style.setProperty("--drift", `${drift}px`);
    p.style.setProperty("--spin", `${spin}deg`);
    container.appendChild(p);
  }
  if (!document.getElementById("zconf-style")) {
    const s = document.createElement("style");
    s.id = "zconf-style";
    s.textContent = `@keyframes zconf{0%{opacity:1;transform:translateY(0) translateX(0) rotate(0deg)}15%{opacity:1}100%{opacity:0;transform:translateY(100vh) translateX(var(--drift)) rotate(var(--spin))}}`;
    document.head.appendChild(s);
  }
  setTimeout(() => container.remove(), 4000);
}

function WelcomeScreen({ onAction }: { onAction: (t: string) => void }) {
  const cards = [
    { icon: "rocket", title: "Launch a business", sub: "From idea to live paid link", action: "I want to launch a business" },
    { icon: "target", title: "Evaluate a market", sub: "Data-driven opportunity scoring", action: "Help me evaluate a market" },
    { icon: "bolt", title: "Stress test my idea", sub: "Validate before you invest", action: "Stress test my business idea" },
  ];
  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 40, paddingTop: 48 }}>
      <h1 style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, textAlign: "center", color: C.text }}>What are you trying to launch?</h1>
      <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.6, color: C.textSec, textAlign: "center", maxWidth: 560 }}>
        A specialized intelligence layer for the modern entrepreneur, engineered to build, launch, and scale comprehensive online businesses with clinical precision.
      </p>
      <div style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%", maxWidth: 540 }}>
        {cards.map((c) => (
          <button key={c.title} type="button" onClick={() => onAction(c.action)}
            style={{ textAlign: "left", padding: "20px 16px", borderRadius: 14, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 200ms ease", color: C.text }}
            onMouseEnter={(e) => { const s = e.currentTarget.style; s.borderColor = C.borderHover; s.background = "rgba(255,255,255,0.05)"; s.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { const s = e.currentTarget.style; s.borderColor = C.border; s.background = "rgba(255,255,255,0.02)"; s.transform = "none"; }}>
            <Ic n={c.icon} className="h-5 w-5" style={{ color: C.accent }} />
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{c.title}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{c.sub}</div>
          </button>
        ))}
      </div>
      <style>{`@media(max-width:560px){[style*="grid-template-columns: 1fr 1fr 1fr"]{grid-template-columns:1fr!important;max-width:280px!important}}`}</style>
    </div>
  );
}

function ActionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.accent}40`, background: `${C.accent}15`, color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer", transition: "all 200ms" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = `${C.accent}25`; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = `${C.accent}15`; }}>
      {label} &rarr;
    </button>
  );
}

// Button helper with hover
function HBtn({ children, onClick, style, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} {...rest}
      style={{ background: "none", border: "none", cursor: "pointer", borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 150ms", ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = style?.background as string || "none"; }}>
      {children}
    </button>
  );
}

function shouldAnimate(m: Msg, chat: Chat | undefined) {
  if (!chat) return false;
  const last = chat.messages[chat.messages.length - 1];
  return m.id === last?.id && m.role === "assistant";
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [buildStage, setBuildStage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const [websiteData, setWebsiteData] = useState<any>(null);

  // Persist animated IDs across reloads so typewriter never replays
  const [animatedIds, setAnimatedIds] = useState<string[]>([]);
  useEffect(() => { const s = localStorage.getItem(ANIMATED_KEY); if (s) try { setAnimatedIds(JSON.parse(s)); } catch {} }, []);
  useEffect(() => {
    const saved = localStorage.getItem("zelrex_website_data");
    if (saved) try { setWebsiteData(JSON.parse(saved)); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem(ANIMATED_KEY, JSON.stringify(animatedIds)); }, [animatedIds]);

  const [chats, setChats] = useState<Chat[]>([{ id: uid("chat"), title: "New chat", messages: [], updatedAt: Date.now() }]);
  useEffect(() => { const s = safeJson<Chat[]>(localStorage.getItem(STORAGE_KEY), []); if (s.length) { setChats(s); setActiveChatId(s[0]?.id ?? ""); } }, []);

  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? "");
  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? chats[0], [chats, activeChatId]);

  const [searchQuery, setSearchQuery] = useState("");
  const filteredChats = useMemo(() => { const q = searchQuery.trim().toLowerCase(); if (!q) return chats; return chats.filter((c) => c.title?.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))); }, [chats, searchQuery]);

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [openChatMenuId, setOpenChatMenuId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [openMsgMenuId, setOpenMsgMenuId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>([]);
  const [inputFocused, setInputFocused] = useState(false);

  function buildPreviewHtml(site: any): string {
    if (!site?.copy?.home?.hero) return "<html><body><p>No website data</p></body></html>";

    const t = site.theme || {};
    const bg = t.bg || "#0a0a0a";
    const text = t.textPrimary || "#ffffff";
    const textSec = t.textSecondary || "rgba(255,255,255,0.6)";
    const accent = site.branding?.primaryColor || t.accent || "#4A90FF";
    const surface = t.surface || "#111111";
    const border = t.border || "rgba(255,255,255,0.08)";
    const name = site.branding?.name || "My Business";
    const copy = site.copy;

    const tiers = copy.pricing?.pricing?.tiers || [];
    const tiersHtml = tiers.map((tier: any) => `
      <div style="background:${surface};border:1px solid ${border};border-radius:16px;padding:32px;${tier.highlighted ? `border-color:${accent};` : ""}">
        <div style="font-weight:700;font-size:18px;color:${text}">${tier.name || ""}</div>
        <div style="font-weight:900;font-size:36px;color:${text};margin:12px 0 8px;letter-spacing:-0.03em">${tier.price || ""}</div>
        ${tier.note ? `<div style="color:${textSec};font-size:14px;line-height:1.5">${tier.note}</div>` : ""}
        <div style="margin-top:20px;border-top:1px solid ${border};padding-top:16px">
          ${(tier.features || []).map((f: string) => `
            <div style="display:flex;align-items:center;gap:10px;color:${textSec};font-size:14px;margin-bottom:10px">
              <span style="color:${accent}">✓</span> ${f}
            </div>
          `).join("")}
        </div>
        <a href="#contact" style="display:block;margin-top:20px;padding:12px 24px;background:${tier.highlighted ? accent : "transparent"};color:${tier.highlighted ? "#fff" : text};border:1px solid ${tier.highlighted ? accent : border};border-radius:999px;text-align:center;text-decoration:none;font-weight:600;font-size:14px">Get started</a>
      </div>
    `).join("");

    const vpItems = copy.home?.valueProps?.items || [];
    const vpHtml = vpItems.map((item: any) => `
      <div style="background:${surface};border:1px solid ${border};border-radius:12px;padding:24px">
        <div style="font-weight:700;font-size:16px;color:${text};margin-bottom:8px">${item.title || ""}</div>
        <div style="color:${textSec};font-size:14px;line-height:1.6">${item.description || ""}</div>
      </div>
    `).join("");

    const steps = copy.home?.howItWorks?.steps || [];
    const stepsHtml = steps.map((step: any, i: number) => `
      <div style="display:flex;gap:20px;align-items:flex-start">
        <div style="width:40px;height:40px;border-radius:50%;background:${accent}22;color:${accent};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;flex-shrink:0">${i + 1}</div>
        <div>
          <div style="font-weight:700;font-size:16px;color:${text};margin-bottom:6px">${step.title || ""}</div>
          <div style="color:${textSec};font-size:14px;line-height:1.6">${step.description || ""}</div>
        </div>
      </div>
    `).join("");

    const methods = copy.contact?.methods?.items || [];
    const methodsHtml = methods.map((m: any) => `
      <div style="display:flex;align-items:center;gap:16px;background:${surface};border:1px solid ${border};border-radius:12px;padding:20px">
        <div>
          <div style="font-weight:600;font-size:14px;color:${text}">${m.label || ""}</div>
          <div style="color:${accent};font-size:13px;margin-top:2px">${m.value || ""}</div>
        </div>
      </div>
    `).join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: ${bg}; color: ${text}; -webkit-font-smoothing: antialiased; }
    a { color: inherit; }
    .section { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
    .section-sm { padding: 60px 24px; max-width: 1100px; margin: 0 auto; }
    .eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; margin-bottom: 14px; }
    .h1 { font-size: clamp(36px, 5vw, 56px); font-weight: 900; line-height: 1.08; letter-spacing: -0.03em; color: ${text}; }
    .h2 { font-size: clamp(28px, 3.5vw, 40px); font-weight: 800; line-height: 1.12; letter-spacing: -0.025em; color: ${text}; }
    .lead { font-size: 17px; line-height: 1.6; color: ${textSec}; max-width: 600px; }
    .btn-primary { display: inline-flex; align-items: center; padding: 14px 32px; background: ${accent}; color: #fff; border-radius: 999px; font-weight: 700; font-size: 15px; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 30px ${accent}44; }
    .nav { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: ${bg}dd; border-bottom: 1px solid ${border}; }
    .nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .nav-links { display: flex; gap: 28px; align-items: center; }
    .nav-links a { font-size: 13px; font-weight: 500; color: ${textSec}; text-decoration: none; transition: color 0.15s; }
    .nav-links a:hover { color: ${text}; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .divider { height: 1px; background: ${border}; max-width: 1100px; margin: 0 auto; }
    @media (max-width: 768px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .nav-links { display: none; }
      .section { padding: 60px 20px; }
    }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav class="nav">
    <div class="nav-inner">
      <div style="font-weight:800;font-size:18px;letter-spacing:-0.02em">${name}</div>
      <div class="nav-links">
        <a href="#services">Services</a>
        <a href="#process">Process</a>
        <a href="#pricing">Pricing</a>
        <a href="#about">About</a>
        <a href="#contact">Contact</a>
        <a href="#contact" class="btn-primary" style="padding:8px 20px;font-size:13px">${copy.home?.primaryCta?.cta?.text || "Get in touch"}</a>
      </div>
    </div>
  </nav>

  <!-- HERO -->
  <section class="section" style="padding-top:100px;padding-bottom:100px">
    <div class="eyebrow">${copy.home?.valueProps?.eyebrow || name}</div>
    <h1 class="h1" style="max-width:700px;margin-bottom:20px">${copy.home?.hero?.headline || name}</h1>
    <p class="lead" style="margin-bottom:36px">${copy.home?.hero?.subheadline || ""}</p>
    <a href="#contact" class="btn-primary">${copy.home?.primaryCta?.cta?.text || "Get started"}</a>
  </section>

  <div class="divider"></div>

  <!-- VALUE PROPS -->
  <section class="section" id="services">
    <div class="eyebrow">${copy.home?.valueProps?.eyebrow || "Services"}</div>
    <h2 class="h2" style="margin-bottom:8px">${copy.home?.valueProps?.title || ""}</h2>
    <p class="lead" style="margin-bottom:36px">${copy.home?.valueProps?.subtitle || ""}</p>
    <div class="grid-${vpItems.length > 3 ? "3" : "2"}">
      ${vpHtml}
    </div>
  </section>

  <div class="divider"></div>

  <!-- HOW IT WORKS -->
  <section class="section" id="process">
    <div class="eyebrow">${copy.home?.howItWorks?.eyebrow || "Process"}</div>
    <h2 class="h2" style="margin-bottom:8px">${copy.home?.howItWorks?.title || ""}</h2>
    <p class="lead" style="margin-bottom:40px">${copy.home?.howItWorks?.subtitle || ""}</p>
    <div style="display:grid;gap:32px;max-width:600px">
      ${stepsHtml}
    </div>
  </section>

  <div class="divider"></div>

  <!-- PRICING -->
  <section class="section" id="pricing">
    <div class="eyebrow">${copy.pricing?.pricing?.eyebrow || "Pricing"}</div>
    <h2 class="h2" style="margin-bottom:8px">${copy.pricing?.pricing?.title || "Pricing"}</h2>
    <p class="lead" style="margin-bottom:36px">${copy.pricing?.pricing?.subtitle || ""}</p>
    <div class="grid-${tiers.length > 2 ? "3" : tiers.length === 2 ? "2" : "1"}" ${tiers.length === 1 ? "style=\"max-width:440px\"" : ""}>
      ${tiersHtml}
    </div>
  </section>

  <div class="divider"></div>

  <!-- ABOUT -->
  <section class="section" id="about">
    <div class="eyebrow">${copy.about?.story?.eyebrow || "About"}</div>
    <h2 class="h2" style="margin-bottom:16px">${copy.about?.story?.title || "About " + name}</h2>
    <p class="lead" style="max-width:700px">${copy.about?.story?.body || ""}</p>
  </section>

  <div class="divider"></div>

  <!-- CONTACT -->
  <section class="section" id="contact">
    <div class="eyebrow">${copy.contact?.methods?.eyebrow || "Contact"}</div>
    <h2 class="h2" style="margin-bottom:8px">${copy.contact?.hero?.headline || "Get in touch"}</h2>
    <p class="lead" style="margin-bottom:36px">${copy.contact?.hero?.subheadline || ""}</p>
    <div class="grid-2" style="max-width:500px">
      ${methodsHtml}
    </div>
  </section>

  <!-- FOOTER -->
  <footer style="border-top:1px solid ${border};padding:32px 24px;text-align:center">
    <div style="color:${textSec};font-size:13px">© ${new Date().getFullYear()} ${name}. All rights reserved.</div>
  </footer>

  <script>
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a');
    if (!link) return;
    var href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
  });
  </script>

</body>
</html>`;
  }

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const phase = useMemo(() => isSending && buildStage.includes("market") ? "evaluating" as BusinessPhase : isSending && (buildStage.includes("Build") || buildStage.includes("Generat")) ? "building" as BusinessPhase : detectPhase(activeChat?.messages ?? []), [activeChat?.messages, isSending, buildStage]);
  const businessName = useMemo(() => getBusinessName(activeChat?.messages ?? []), [activeChat?.messages]);
  const hasMessages = (activeChat?.messages?.length ?? 0) > 0;

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); }, [chats]);
  useEffect(() => { if (!activeChatId && chats[0]?.id) setActiveChatId(chats[0].id); if (activeChatId && !chats.some((c) => c.id === activeChatId) && chats[0]?.id) setActiveChatId(chats[0].id); }, [activeChatId, chats]);
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages.length, isSending]);
  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = "0px"; el.style.height = `${Math.min(180, el.scrollHeight)}px`; }, [input]);
  useEffect(() => { const h = () => { setOpenChatMenuId(null); setOpenMsgMenuId(null); setAttachMenuOpen(false); setSettingsOpen(false); }; window.addEventListener("mousedown", h); return () => window.removeEventListener("mousedown", h); }, []);
  useEffect(() => { if (previewOpen) setSidebarOpen(false); }, [previewOpen]);

  function createNewChat() { const c: Chat = { id: uid("chat"), title: "New chat", messages: [], updatedAt: Date.now(), pendingSurvey: false }; setChats((p) => [c, ...p]); setActiveChatId(c.id); setOpenChatMenuId(null); setRenamingChatId(null); setInput(""); setDraftAttachments((p) => { for (const a of p) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); return []; }); }
  function deleteChat(id: string) { setChats((p) => p.filter((c) => c.id !== id)); setOpenChatMenuId(null); if (id === activeChatId) { const r = chats.filter((c) => c.id !== id); setActiveChatId(r[0]?.id ?? ""); } }
  function startRename(id: string) { setRenamingChatId(id); setRenameValue(chats.find((x) => x.id === id)?.title ?? ""); setOpenChatMenuId(null); }
  function commitRename() { if (!renamingChatId) return; setChats((p) => p.map((c) => (c.id === renamingChatId ? { ...c, title: renameValue.trim() || "New chat" } : c))); setRenamingChatId(null); setRenameValue(""); }
  function sendViaCard(text: string) { setInput(text); setTimeout(() => sendMessage(text), 50); }

  async function handleSurveyComplete(data: SurveyData) {
    setSurveyData(data);
    setShowSurvey(false);
    setSurveyDismissed(false);
    if (activeChat?.id) {
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, pendingSurvey: false, updatedAt: Date.now() } : c));
    }
    setIsSending(true);
    setBuildStage("Building your website with your details...");
    setTimeout(() => setBuildStage("Applying your brand and style..."), 3000);
    setTimeout(() => setBuildStage("Writing bespoke copy..."), 6000);
    setTimeout(() => setBuildStage("Generating pages..."), 12000);

    try {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({
          messages: activeChat?.messages ?? [],
          surveyData: data,
          action: "buildWebsite",
        }),
      });
      const raw = await res.text();
      let result: { reply?: string; previewUrl?: string; websiteData?: any } = {};
      try { result = JSON.parse(raw); } catch {}
      console.log("FULL API RESPONSE:", result);
      if (result.websiteData) {
        setWebsiteData(result.websiteData);
        localStorage.setItem("zelrex_website_data", JSON.stringify(result.websiteData));
      }
      const reply = result.reply?.trim() || "Something went wrong. Please try again.";
      setChats((p) => p.map((c) => c.id === activeChat!.id ? {
        ...c,
        messages: [...c.messages, { id: uid("m"), role: "assistant" as const, content: reply, createdAt: Date.now(), previewUrl: result.previewUrl || undefined }],
        updatedAt: Date.now(),
      } : c));
      if (result.previewUrl) setTimeout(() => fireConfetti(), 300);
    } catch {
      setChats((p) => p.map((c) => c.id === activeChat!.id ? {
        ...c,
        messages: [...c.messages, { id: uid("m"), role: "assistant" as const, content: "Something went wrong building your website. Please try again.", createdAt: Date.now() }],
        updatedAt: Date.now(),
      } : c));
    } finally {
      setIsSending(false);
      setBuildStage("");
    }
  }

  async function sendMessage(override?: string) {
    const text = (override ?? input).trim();
    if ((!text && !draftAttachments.length) || !activeChat || isSending) return;
    setIsSending(true); setOpenMsgMenuId(null);
    const userMsg: Msg = { id: uid("m"), role: "user", content: text, createdAt: Date.now() };
    const autoTitle = activeChat.messages.length === 0;
    const isBuild = /\b(build|make|create|generate|launch)\b.*\b(website|site|page|link|business)\b/i.test(text);
    if (isBuild && !surveyData) {
      setChats((p) => p.map((c) => c.id === activeChat.id ? {
        ...c,
        title: autoTitle ? makeTitle(text) : c.title,
        messages: [...c.messages, userMsg],
        pendingSurvey: true,
        updatedAt: Date.now(),
      } : c));
      setInput("");
      setSurveyDismissed(false);
      setShowSurvey(true);
      setIsSending(false);
      return;
    }
    setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, title: autoTitle ? makeTitle(text) : c.title, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
    setInput("");
    const isEval = /\b(evaluate|analyze|assess|research|find|what business|which business|best business|market|stress test)\b/i.test(text);
    if (isBuild) { setBuildStage("Extracting business context\u2026"); setTimeout(() => setBuildStage("Selecting theme and layout\u2026"), 3e3); setTimeout(() => setBuildStage("Writing bespoke copy\u2026"), 6e3); setTimeout(() => setBuildStage("Building pages\u2026"), 12e3); setTimeout(() => setBuildStage("Generating preview\u2026"), 18e3); }
    else if (isEval) { setBuildStage("Running market evaluation\u2026"); setTimeout(() => setBuildStage("Searching market data\u2026"), 3e3); setTimeout(() => setBuildStage("Analyzing competition\u2026"), 8e3); setTimeout(() => setBuildStage("Projecting revenue\u2026"), 14e3); }
    try {
      const ctrl = new AbortController(); abortRef.current = ctrl;
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify({ messages: [...activeChat.messages, userMsg] }) });
      const raw = await res.text(); let data: { reply?: string; previewUrl?: string; websiteData?: any } = {}; try { data = JSON.parse(raw); } catch {}
      if (data.websiteData) {
        setWebsiteData(data.websiteData);
        localStorage.setItem("zelrex_website_data", JSON.stringify(data.websiteData));
      }
      const reply = data.reply?.trim() || "Something went wrong. Please try again.";
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, messages: [...c.messages, { id: uid("m"), role: "assistant" as const, content: reply, createdAt: Date.now(), previewUrl: data.previewUrl || undefined }], updatedAt: Date.now() } : c));
      if (data.previewUrl) { setTimeout(() => fireConfetti(), 300); }
    } catch { setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, messages: [...c.messages, { id: uid("m"), role: "assistant" as const, content: "Something went wrong. Please try again.", createdAt: Date.now() }], updatedAt: Date.now() } : c)); }
    finally { setIsSending(false); setBuildStage(""); }
  }

  function stopResponse() { abortRef.current?.abort(); abortRef.current = null; setIsSending(false); setBuildStage(""); }
  function startSpeech() { const S = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition; if (!S) return; const r = new S(); r.lang = "en-US"; r.start(); setListening(true); r.onresult = (e: any) => { setInput((p) => p + " " + e.results[0][0].transcript); setListening(false); }; r.onerror = () => setListening(false); }
  function retryLast() { if (!activeChat || activeChat.messages.length < 2) return; const lu = [...activeChat.messages].reverse().find((m) => m.role === "user"); if (!lu) return; setChats((p) => p.map((c) => (c.id === activeChat.id ? { ...c, messages: c.messages.slice(0, -1) } : c))); sendViaCard(lu.content); }
  function addFiles(files: FileList | File[]) { setDraftAttachments((p) => [...p, ...Array.from(files).map((f) => ({ id: uid("att"), file: f, kind: (f.type?.startsWith("image/") ? "image" : "file") as "image" | "file", previewUrl: f.type?.startsWith("image/") ? URL.createObjectURL(f) : undefined }))]); }
  function removeAtt(id: string) { setDraftAttachments((p) => { const t = p.find((a) => a.id === id); if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl); return p.filter((a) => a.id !== id); }); }
  function onPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) { const fs: File[] = []; for (const i of Array.from(e.clipboardData?.items ?? [])) { if (i.kind === "file") { const f = i.getAsFile(); if (f) fs.push(f); } } if (fs.length) { e.preventDefault(); addFiles(fs); } }
  useEffect(() => { return () => { for (const a of draftAttachments) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); }; }, []);

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;font-family:'Inter',system-ui,-apple-system,sans-serif}
        body{margin:0;background:${C.bg};color:${C.text}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:3px}
        ::selection{background:${C.accent}40}
        textarea::placeholder{color:${C.textMuted}}
      `}</style>

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${C.border}`, background: "rgba(6,9,15,0.82)", backdropFilter: "blur(24px)" }}>
        <div style={{ maxWidth: 1800, margin: "0 auto", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <HBtn onClick={() => setSidebarOpen((v) => !v)} style={{ width: 34, height: 34, color: C.textSec }}><Ic n={sidebarOpen ? "close" : "menu"} className="h-4 w-4" /></HBtn>
            <ZelrexWordmark size={16} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {websiteData && (
              <HBtn onClick={() => setPreviewOpen(!previewOpen)} style={{ padding: "5px 12px", border: `1px solid ${previewOpen ? C.accent + "40" : C.border}`, background: previewOpen ? C.accentSoft : "transparent", color: previewOpen ? C.accent : C.textSec, fontSize: 12, fontWeight: 500, gap: 5 }}>
                <Ic n="preview" className="h-3.5 w-3.5" /> Preview
              </HBtn>
            )}
            <HBtn onClick={() => alert("Sign in coming soon")} style={{ padding: "5px 12px", border: `1px solid ${C.border}`, color: C.textSec, fontSize: 12, fontWeight: 500, gap: 5 }}>
              <Ic n="signin" className="h-3.5 w-3.5" /> Sign in
            </HBtn>
            {/* Settings dots */}
            <div style={{ position: "relative" }}>
              <HBtn onClick={() => setSettingsOpen((v) => !v)} style={{ width: 40, height: 40, color: C.text }}><Ic n="dots" style={{ width: 20, height: 20 }} /></HBtn>
              {settingsOpen && (
                <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 44, zIndex: 200, width: 180, borderRadius: 12, border: `1px solid ${C.border}`, background: C.bgElevated, boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                  <button type="button" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "none", border: "none", color: C.textSec, fontSize: 13, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                    <Ic n="settings" className="h-4 w-4" /> Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StatusBar phase={phase} businessName={businessName} sidebarOpen={sidebarOpen} />

      {/* LAYOUT: sidebar + chat + preview */}
      <div style={{ display: "flex", height: "calc(100vh - 81px)", position: "relative" }}>

        {/* SIDEBAR */}
        <aside style={{ width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0, borderRight: sidebarOpen ? `1px solid ${C.border}` : "none", background: C.bg, transition: "all 300ms cubic-bezier(0.2,0,0,1)", overflow: "hidden", display: "flex", flexDirection: "column", position: "absolute", top: -81, bottom: 0, left: 0, paddingTop: 81, zIndex: 20 }}>
          <div style={{ padding: 10, opacity: sidebarOpen ? 1 : 0, transition: "opacity 200ms" }}>
            <button onClick={createNewChat} type="button" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all 150ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
              <Ic n="compose" className="h-4 w-4" /> New chat
            </button>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
              <Ic n="search" className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search chats..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 12 }} />
              {searchQuery && <HBtn onClick={() => setSearchQuery("")} style={{ width: 20, height: 20, color: C.textMuted }}><Ic n="close" className="h-3 w-3" /></HBtn>}
            </div>
          </div>
          <div style={{ height: 1, margin: "0 10px", background: C.border }} />
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
            <div style={{ padding: "4px 8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>Chats</div>
            {filteredChats.map((c) => {
              const isA = c.id === activeChatId; const isR = renamingChatId === c.id;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "6px 8px", borderRadius: 8, marginBottom: 1, cursor: "pointer", background: isA ? "rgba(255,255,255,0.06)" : "transparent", transition: "background 150ms", position: "relative" }}
                  onMouseEnter={(e) => { if (!isA) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                  onMouseLeave={(e) => { if (!isA) e.currentTarget.style.background = isA ? "rgba(255,255,255,0.06)" : "transparent"; }}>
                  <button onClick={() => setActiveChatId(c.id)} type="button" style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0, overflow: "hidden" }}>
                    {isR ? (
                      <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setRenamingChatId(null); setRenameValue(""); } }} onBlur={commitRename} autoFocus style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 4, padding: "2px 6px", color: C.text, fontSize: 12, outline: "none" }} />
                    ) : (
                      <div style={{ fontSize: 12, color: isA ? C.text : C.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>{c.title || "New chat"}</div>
                    )}
                  </button>
                  {!isR && (
                    <HBtn onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setOpenChatMenuId((v) => (v === c.id ? null : c.id)); }} style={{ width: 28, height: 28, color: C.text, opacity: isA || openChatMenuId === c.id ? 0.9 : 0, marginLeft: 2 }}>
                      <Ic n="dots" style={{ width: 16, height: 16 }} />
                    </HBtn>
                  )}
                  {openChatMenuId === c.id && (
                    <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "absolute", right: 4, top: 32, zIndex: 100, width: 140, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgElevated, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                      <button onClick={() => startRename(c.id)} type="button" style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}><Ic n="pencil" className="h-3 w-3" /> Rename</button>
                      <button onClick={() => deleteChat(c.id)} type="button" style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}><Ic n="trash" className="h-3 w-3" /> Delete</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 8 }}>
            <button type="button" style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", transition: "all 150ms" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              onClick={() => alert("Sign in coming soon")}>
              <Ic n="signin" className="h-4 w-4" /> Sign in
            </button>
          </div>
        </aside>

        {/* CHAT */}
        <div style={{ flex: previewOpen ? "0 0 360px" : 1, display: "flex", flexDirection: "column", minWidth: 0, transition: "flex 300ms ease", marginLeft: sidebarOpen ? 260 : 0, transitionProperty: "flex, margin-left", transitionDuration: "300ms", transitionTimingFunction: "cubic-bezier(0.2,0,0,1)" }}>
          <div style={{ flex: 1, overflowY: "auto", padding: previewOpen ? "16px 12px" : "16px 16px" }}>
            <div style={{ maxWidth: previewOpen ? "100%" : 820, margin: "0 auto" }}>
              {!hasMessages ? (
                <WelcomeScreen onAction={sendViaCard} />
              ) : (
                <div style={{ paddingBottom: 140 }}>
                  {activeChat?.messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={m.id} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16, gap: 10 }}>
                        {!isUser && <div style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2 }}><ZelrexZIcon size={26} /></div>}
                        <div style={{ maxWidth: previewOpen ? "100%" : 700 }}>
                          <div style={{
                            ...(isUser ? { display: "inline-block", padding: "8px 14px", borderRadius: 16, background: C.userBubble, border: `1px solid ${C.userBorder}` } : { padding: "4px 0 4px 14px", borderLeft: `2px solid ${C.accent}18` }),
                          }}>
                            {m.role === "assistant" ? (
                              <>
                                {shouldAnimate(m, activeChat) && !animatedIds.includes(m.id) ? (
                                  <Typewriter text={m.content} speed={6} onFinish={() => setAnimatedIds((p) => p.includes(m.id) ? p : [...p, m.id])} />
                                ) : ( <div>{formatMessage(m.content)}</div> )}
                                {m.previewUrl && <div style={{ marginTop: 14 }}><ActionPill label="Open website preview" onClick={() => setPreviewOpen(true)} /></div>}
                                <div style={{ display: "flex", alignItems: "center", gap: 2, marginTop: 6 }}>
                                  <HBtn onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setOpenMsgMenuId((v) => (v === m.id ? null : m.id)); }} style={{ width: 30, height: 30, color: C.text, opacity: 0.7 }}>
                                    <Ic n="dots" style={{ width: 16, height: 16 }} />
                                  </HBtn>
                                  {openMsgMenuId === m.id && (
                                    <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "relative" }}>
                                      <div style={{ position: "absolute", left: 0, top: 4, zIndex: 50, width: 140, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgElevated, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                                        <button type="button" onClick={() => { navigator.clipboard.writeText(m.content); setCopiedMsgId(m.id); setOpenMsgMenuId(null); setTimeout(() => setCopiedMsgId(null), 1200); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                                          <Ic n="copy" className="h-3 w-3" /> Copy
                                        </button>
                                        <button type="button" onClick={() => { setOpenMsgMenuId(null); retryLast(); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                                          ↻ Retry
                                        </button>
                                        <button type="button" onClick={() => { setOpenMsgMenuId(null); alert("Report saved."); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>
                                          <Ic n="flag" className="h-3 w-3" /> Report
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {copiedMsgId === m.id && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>Copied</div>}
                              </>
                            ) : ( <div style={{ fontSize: 15, lineHeight: 1.7 }}>{m.content}</div> )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {isSending && <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "flex-start" }}><div style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2, position: "relative" }}><ZelrexZIcon size={26} /><div className="z-momentum-line" /></div><div style={{ paddingTop: 4 }}><ZelrexThinking stage={buildStage} /></div></div>}
                  <div ref={listEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* INPUT */}
          <div style={{ padding: previewOpen ? "8px 12px 14px" : "8px 16px 18px", position: "relative" }}>
            {!surveyData && !showSurvey && activeChat?.pendingSurvey && (
              <div style={{ maxWidth: previewOpen ? "100%" : 820, margin: "0 auto 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 12, color: C.textSec }}>Survey paused. Continue to finish your website build.</div>
                <button type="button" onClick={() => { setSurveyDismissed(false); setShowSurvey(true); }} style={{ padding: "6px 12px", borderRadius: 999, border: `1px solid ${C.accent}55`, background: `${C.accent}18`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Continue survey</button>
              </div>
            )}
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 24, background: "linear-gradient(to bottom, rgba(6,9,15,0), rgba(6,9,15,0.9))", pointerEvents: "none" }} />
            <div style={{ position: "relative", zIndex: 1, maxWidth: previewOpen ? "100%" : 820, margin: "0 auto", borderRadius: draftAttachments.length ? 18 : 999, border: `1px solid ${inputFocused ? C.borderHover : C.border}`, background: C.bgInput, boxShadow: `0 4px 24px rgba(0,0,0,0.3)`, transition: "border-color 200ms" }}>
              {draftAttachments.length > 0 && (
                <div style={{ padding: "8px 8px 0", display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {draftAttachments.map((a) => (
                    <div key={a.id} style={{ width: 64, height: 64, borderRadius: 10, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative", background: "rgba(0,0,0,0.2)" }}>
                      {a.kind === "image" ? <img src={a.previewUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ padding: 6, fontSize: 9, color: C.textSec }}>{a.file.name}</div>}
                      <button type="button" onClick={() => removeAtt(a.id)} style={{ position: "absolute", right: 2, top: 2, width: 18, height: 18, borderRadius: 999, background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", alignItems: "center", padding: "6px 8px" }}>
                <div style={{ position: "relative" }}>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />
                  <HBtn onClick={() => setAttachMenuOpen((v) => !v)} style={{ width: 38, height: 38, color: C.textMuted }}><Ic n="plus" style={{ width: 20, height: 20 }} /></HBtn>
                  {attachMenuOpen && (
                    <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, bottom: 42, zIndex: 50, width: 140, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgElevated, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                      <button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>Add images</button>
                      <button type="button" onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }} style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", textAlign: "left" }} onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}>Add files</button>
                    </div>
                  )}
                </div>
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} onPaste={onPaste} placeholder="Message Zelrex..."
                  style={{ flex: 1, maxHeight: 220, minHeight: 46, resize: "none", background: "none", border: "none", outline: "none", padding: "12px 8px", fontSize: 14, lineHeight: 1.6, color: C.text }} />
                <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <HBtn onClick={startSpeech} style={{ width: 38, height: 38, color: listening ? C.accent : C.textMuted }}><Ic n="mic" style={{ width: 20, height: 20 }} /></HBtn>
                  <HBtn onClick={isSending ? stopResponse : () => sendMessage()}
                    style={{ width: 38, height: 38, background: (isSending || input.trim() || draftAttachments.length) ? C.accent : "rgba(255,255,255,0.06)", color: (isSending || input.trim() || draftAttachments.length) ? "#fff" : C.textMuted, boxShadow: (input.trim() || draftAttachments.length) ? `0 2px 10px ${C.accentGlow}` : "none" }}>
                    {isSending ? <Ic n="stop" style={{ width: 18, height: 18 }} /> : <Ic n="send" style={{ width: 20, height: 20 }} />}
                  </HBtn>
                </div>
              </div>
            </div>
            <div style={{ marginTop: 8, textAlign: "center", fontSize: 12, fontWeight: 500, color: C.textSec, position: "relative", zIndex: 1 }}>Zelrex can make mistakes. Check important info before making business decisions.</div>
          </div>
        </div>

        {/* PREVIEW PANEL (Bolt-style) */}
        {previewOpen && websiteData && (
          <div style={{ flex: 1, borderLeft: `1px solid ${C.border}`, background: C.bg, display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.textSec }}>
              <span>Website Preview — {websiteData.branding?.name || "Preview"}</span>
              <HBtn onClick={() => setPreviewOpen(false)} style={{ width: 28, height: 28, color: C.textMuted }}><Ic n="close" className="h-4 w-4" /></HBtn>
            </div>
            <iframe
              srcDoc={buildPreviewHtml(websiteData)}
              style={{ flex: 1, border: "none", background: "#fff" }}
              title="Preview"
            />
          </div>
        )}

        {showSurvey && (
          <WebsiteSurvey
            onComplete={handleSurveyComplete}
            onClose={() => { setShowSurvey(false); setSurveyDismissed(true); if (activeChat?.id) { setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, pendingSurvey: true } : c)); } }}
          />
        )}
      </div>
    </div>
  );
}
