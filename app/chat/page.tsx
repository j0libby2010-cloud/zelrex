"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk, RedirectToSignIn } from "@clerk/nextjs";
import { formatMessage } from "./formatMessage";
import { WebsiteSurvey, SurveyData } from "@/website/pages/components/Websitesurvey";
import { db, useDebouncedSave } from "@/lib/useZelrexData";


type Role = "user" | "assistant";
type Msg = { id: string; role: Role; content: string; createdAt: number; previewUrl?: string };
type Chat = { id: string; title: string; messages: Msg[]; updatedAt: number; pendingSurvey?: boolean; websiteData?: any; deployData?: any };
type DraftAttachment = { id: string; file: File; kind: "image" | "file"; previewUrl?: string };
type BusinessPhase = "ready" | "intake" | "evaluating" | "building" | "live";

// Chat IDs now come from Supabase UUIDs

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
  const w = text.trim().replace(/\s+/g, " ").replace(/[^\w\s'-]/g, "").split(" ").filter(Boolean).slice(0, 4);
  const t = w.map((s) => (s.length <= 2 ? s.toLowerCase() : s[0].toUpperCase() + s.slice(1))).join(" ");
  return t.length > 24 ? t.slice(0, 24).trim() + "\u2026" : t || "New business";
}

// Derive a concise chat title from the assistant's first reply
function autoTitleFromReply(userText: string, replyText: string): string {
  // Try to extract a business name from bold text in reply
  const boldMatch = replyText.match(/\*\*([^*]{3,30})\*\*/);
  if (boldMatch) {
    const name = boldMatch[1].replace(/[!.]+$/, "").trim();
    if (name.length >= 3 && name.length <= 28 && !/^(your|the|this|here|step|next|let)\b/i.test(name)) {
      return name.length > 24 ? name.slice(0, 24).trim() + "\u2026" : name;
    }
  }
  // Try to find a quoted name
  const quoteMatch = replyText.match(/[\u201c"']([^\u201d"']{3,28})[\u201d"']/);
  if (quoteMatch) {
    const name = quoteMatch[1].trim();
    if (name.length >= 3) return name.length > 24 ? name.slice(0, 24).trim() + "\u2026" : name;
  }
  // Fall back to making a title from the user's text
  return makeTitle(userText);
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
    settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.4" /></>,
    signin: <><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
    bolt: <><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></>,
    bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>,
    goal: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.4" /><circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.4" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" /></>,
    chevdown: <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    chevright: <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /><circle cx="8" cy="15" r="1" fill="currentColor" /><circle cx="12" cy="15" r="1" fill="currentColor" /></>,
    analytics: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" /><path d="M8 14l2.5-3 2.5 1.5L16 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="16" cy="9" r="1.5" fill="currentColor" /></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="currentColor" strokeWidth="1.4" /><path d="M2 13h20" stroke="currentColor" strokeWidth="1.4" /></>,
    globe: <><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.4" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" stroke="currentColor" strokeWidth="1.4" /></>,
    credit: <><rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M2 10h20" stroke="currentColor" strokeWidth="1.4" /><path d="M6 15h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></>,
    shield: <><path d="M12 2l8 4v5c0 5.55-3.84 10.74-8 12-4.16-1.26-8-6.45-8-12V6l8-4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></>,
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
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 0", minHeight: 44 }}>
      <div className="dyson-wrap">
        <div className="dyson-core"><ZelrexZIcon size={16} /></div>
        {/* Orbital rings tilted at different 3D angles to form a sphere */}
        <div className="dyson-ring dyson-r1" />
        <div className="dyson-ring dyson-r2" />
        <div className="dyson-ring dyson-r3" />
        <div className="dyson-ring dyson-r4" />
        <div className="dyson-ring dyson-r5" />
        <div className="dyson-glow" />
        <div className="dyson-pulse" />
      </div>
      <span className="z-think-label">{stage || "Thinking"}</span>
      <style>{`
        .dyson-wrap{position:relative;width:44px;height:44px;flex-shrink:0;perspective:200px}
        .dyson-core{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;z-index:4}
        .dyson-glow{position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.32) 0%,rgba(74,144,255,0.06) 60%,transparent 85%);animation:dyson-breathe 3s ease-in-out infinite;z-index:0}
        .dyson-pulse{position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(59,130,246,0.05) 0%,transparent 65%);animation:dyson-pa 4s ease-in-out infinite;z-index:0}
        @keyframes dyson-breathe{0%,100%{opacity:0.35;transform:scale(0.8)}50%{opacity:1;transform:scale(1.2)}}
        @keyframes dyson-pa{0%,100%{opacity:0;transform:scale(0.7)}50%{opacity:0.5;transform:scale(1.6)}}
        .dyson-ring{position:absolute;inset:2px;border-radius:50%;border:1.2px solid transparent;z-index:2}
        /* Equatorial ring — flat, fastest */
        .dyson-r1{border-top-color:#3B82F6;border-bottom-color:rgba(59,130,246,0.15);animation:dyson-spin 1.8s linear infinite;filter:drop-shadow(0 0 5px rgba(59,130,246,0.5))}
        /* Tilted ring 60° on X */
        .dyson-r2{border-left-color:rgba(96,165,250,0.8);border-right-color:rgba(96,165,250,0.15);transform:rotateX(60deg);animation:dyson-spin-r 2.6s linear infinite;filter:drop-shadow(0 0 4px rgba(96,165,250,0.4))}
        /* Tilted ring -60° on X */
        .dyson-r3{border-top-color:rgba(147,197,253,0.6);border-bottom-color:rgba(147,197,253,0.1);transform:rotateX(-60deg);animation:dyson-spin 3.4s linear infinite;filter:drop-shadow(0 0 4px rgba(147,197,253,0.3))}
        /* Polar ring — 90° on X (vertical), slight Y tilt */
        .dyson-r4{border-left-color:rgba(59,130,246,0.45);border-right-color:rgba(59,130,246,0.08);transform:rotateX(90deg) rotateY(20deg);animation:dyson-spin-r 4s linear infinite;filter:drop-shadow(0 0 6px rgba(59,130,246,0.25))}
        /* Diagonal ring — 45° on both axes */
        .dyson-r5{inset:0px;border-top-color:rgba(147,197,253,0.2);border-left-color:rgba(147,197,253,0.08);transform:rotateX(45deg) rotateZ(45deg);animation:dyson-spin 5.5s linear infinite;filter:drop-shadow(0 0 8px rgba(147,197,253,0.12))}
        @keyframes dyson-spin{to{transform:rotateX(var(--rx,0deg)) rotateZ(var(--rz,0deg)) rotate(360deg)}}
        @keyframes dyson-spin-r{to{transform:rotateX(var(--rx,0deg)) rotateZ(var(--rz,0deg)) rotate(-360deg)}}
        .dyson-r1{--rx:0deg;--rz:0deg}
        .dyson-r2{--rx:60deg;--rz:0deg}
        .dyson-r3{--rx:-60deg;--rz:0deg}
        .dyson-r4{--rx:90deg;--rz:20deg}
        .dyson-r5{--rx:45deg;--rz:45deg}
        .z-think-label{font-size:13px;font-weight:600;letter-spacing:0.02em;background:linear-gradient(135deg,#93C5FD,#3B82F6,#60A5FA);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:z-label-fade 2.4s cubic-bezier(0.4,0,0.2,1) infinite}
        @keyframes z-label-fade{0%,100%{opacity:0.5}40%{opacity:1}}
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

function StatusBar({ phase, businessName, sidebarOpen, isMobile, userGoal, onAddGoal }: { phase: BusinessPhase; businessName: string | null; sidebarOpen: boolean; isMobile: boolean; userGoal?: { text: string; target: string; deadline: string } | null; onAddGoal?: (e: React.MouseEvent) => void }) {
  const phases: { key: string; label: string }[] = [
    { key: "ready", label: "Start" },
    { key: "intake", label: "Discovery" },
    { key: "evaluating", label: "Evaluation" },
    { key: "building", label: "Website" },
    { key: "live", label: businessName || "Live" },
  ];
  const phaseKeys = ["ready", "intake", "evaluating", "building", "live"];
  const currentIdx = phaseKeys.indexOf(phase);
  const accentColor = phase === "live" ? "#10B981" : phase === "building" ? "#8B5CF6" : phase === "evaluating" ? "#F59E0B" : C.accent;
  const leftOffset = (!isMobile && sidebarOpen) ? 260 : 0;

  return (
    <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 0, borderBottom: `1px solid ${C.border}`, background: currentIdx > 0 ? `linear-gradient(90deg, transparent, ${accentColor}06, transparent)` : "transparent", padding: "0 20px", marginLeft: leftOffset, width: `calc(100% - ${leftOffset}px)`, transition: "margin-left 500ms cubic-bezier(0.32,0.72,0,1), width 500ms cubic-bezier(0.32,0.72,0,1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
      {phases.map((p, i) => {
        const isDone = i < currentIdx;
        const isCurrent = phaseKeys[currentIdx] === p.key;
        const color = isDone ? "#10B981" : isCurrent ? accentColor : C.textMuted;
        return (
          <React.Fragment key={p.key}>
            {i > 0 && <div style={{ width: isMobile ? 16 : 32, height: 1, background: isDone ? "#10B981" : C.border, margin: "0 2px", transition: "background 500ms" }} />}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: color, boxShadow: isCurrent ? `0 0 8px ${color}` : "none", transition: "all 500ms", animation: isCurrent && (phase === "evaluating" || phase === "building") ? "zp 2s ease infinite" : "none" }} />
              <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: isCurrent ? 700 : 500, color, letterSpacing: "0.04em", textTransform: "uppercase", transition: "all 500ms cubic-bezier(0.32,0.72,0,1)" }}>{p.label}</span>
            </div>
          </React.Fragment>
        );
      })}
      {/* Separator + Goal or Add Goal */}
      <div style={{ width: isMobile ? 16 : 32, height: 1, background: C.border, margin: "0 2px" }} />
      {userGoal ? (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          <span style={{ fontSize: isMobile ? 9 : 10, fontWeight: 600, color: C.accent, letterSpacing: "0.04em", textTransform: "uppercase", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userGoal.text}</span>
        </div>
      ) : (
        <button type="button" onClick={onAddGoal} className="z-glass-accent" style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 12, border: `1px solid ${C.border}`, background: "none", color: C.textMuted, fontSize: isMobile ? 9 : 10, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em", textTransform: "uppercase" }}>
          <span style={{ fontSize: 11, lineHeight: 1 }}>+</span> Goal
        </button>
      )}
      </div>
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
    { icon: "rocket", title: "Build my website", sub: "Premium site, live in minutes", action: "Build me a website for my freelance business" },
    { icon: "target", title: "Evaluate my market", sub: "Find your most profitable niche", action: "Help me evaluate my market" },
    { icon: "bolt", title: "Stress test my offer", sub: "Fix weak spots before launch", action: "Stress test my freelance offer" },
  ];
  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", justifyContent: "center", paddingBottom: 40, paddingTop: 48, padding: "48px 20px 40px" }}>
      <h1 className="welcome-h1" style={{ fontSize: 44, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.1, textAlign: "center", color: C.text }}>Go independent. Get paid.</h1>
      <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.6, color: C.textSec, textAlign: "center", maxWidth: 520 }}>
        Stop losing 20% to platforms. Zelrex builds your premium freelance site, connects Stripe, and helps you land higher-paying clients directly.
      </p>
      <div className="welcome-grid" style={{ marginTop: 36, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, width: "100%", maxWidth: 540 }}>
        {cards.map((c) => (
          <button key={c.title} type="button" onClick={() => onAction(c.action)} className="z-glass"
            style={{ textAlign: "left", padding: "20px 16px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", cursor: "pointer", color: C.text }}>
            <Ic n={c.icon} className="h-5 w-5" style={{ color: C.accent }} />
            <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{c.title}</div>
            <div style={{ marginTop: 4, fontSize: 12, color: C.textMuted, lineHeight: 1.4 }}>{c.sub}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionPill({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="z-glass-accent"
      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, border: `1px solid ${C.accent}40`, background: `${C.accent}15`, color: C.accent, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
      {label} &rarr;
    </button>
  );
}

// Button helper — Apple liquid glass
function HBtn({ children, onClick, style, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { style?: React.CSSProperties }) {
  return (
    <button type="button" onClick={onClick} className={cx("z-glass", className)} {...rest}
      style={{ background: "none", border: "none", cursor: "pointer", borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", ...style }}>
      {children}
    </button>
  );
}

function shouldAnimate(m: Msg, chat: Chat | undefined) {
  if (!chat) return false;
  const last = chat.messages[chat.messages.length - 1];
  return m.id === last?.id && m.role === "assistant";
}

// ─── PREVIEW FRAME (uses blob URL for full isolation) ─────────────
function PreviewFrame({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Clean up old blob URL
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    // Create new blob URL from HTML
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    if (iframeRef.current) iframeRef.current.src = url;
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, [html]);

  return <iframe ref={iframeRef} style={{ flex: 1, border: "none", background: "#fff" }} title="Preview" />;
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

export default function ChatPage({ initialChatId }: { initialChatId?: string } = {}) {
  // ─── Auth ──────────────────────────────────────────────────────────
  const { user: clerkUser, isLoaded: authLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const [dbUserId, setDbUserId] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  const debouncedSave = useDebouncedSave(800);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => { const check = () => setIsMobile(window.innerWidth < 768); check(); window.addEventListener("resize", check); return () => window.removeEventListener("resize", check); }, []);
  const [buildStage, setBuildStage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(0); // 0 = auto (flex: 1)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"account"|"subscription"|"features"|"notifications">("account");
  const [expandedBizId, setExpandedBizId] = useState<string | null>(null);
  const [showSurvey, setShowSurvey] = useState(false);
  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [surveyDismissed, setSurveyDismissed] = useState(false);
  const [websiteData, setWebsiteData] = useState<any>(null);
  const [deployData, setDeployData] = useState<{ projectId: string; url: string; projectName: string; customDomain?: string; domainVerified?: boolean } | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  
  // Goals & Notifications
  const [userGoal, setUserGoal] = useState<{ text: string; target: string; deadline: string } | null>(null);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState({ text: "", target: "", deadline: "" });
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; text: string; time: number; read: boolean }>>([]);

  // ─── Overlay origin-zoom animation state ───────────────────────────
  const [settingsClosing, setSettingsClosing] = useState(false);
  const [goalClosing, setGoalClosing] = useState(false);
  const [notifClosing, setNotifClosing] = useState(false);
  const settingsOriginRef = useRef<{ x: number; y: number } | null>(null);
  const goalOriginRef = useRef<{ x: number; y: number } | null>(null);
  const notifOriginRef = useRef<{ x: number; y: number } | null>(null);

  // ─── Overlay origin-zoom helpers ───────────────────────────────────
  const openSettings = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    settingsOriginRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    setSettingsOpen(true);
  };
  const closeSettings = () => {
    if (settingsClosing) return;
    setSettingsClosing(true);
    setTimeout(() => { setSettingsOpen(false); setSettingsClosing(false); }, 420);
  };
  const openGoalModal = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    goalOriginRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    if (userGoal) setGoalDraft({ text: userGoal.text, target: userGoal.target, deadline: userGoal.deadline });
    else setGoalDraft({ text: "", target: "", deadline: "" });
    setGoalModalOpen(true);
  };
  const closeGoalModal = () => {
    if (goalClosing) return;
    setGoalClosing(true);
    setTimeout(() => { setGoalModalOpen(false); setGoalClosing(false); }, 420);
  };
  const openNotif = (e: React.MouseEvent) => {
    if (notifOpen) { closeNotif(); return; }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    notifOriginRef.current = { x: r.left + r.width / 2, y: r.bottom };
    setNotifOpen(true);
  };
  const closeNotif = () => {
    if (notifClosing) return;
    setNotifClosing(true);
    setTimeout(() => { setNotifOpen(false); setNotifClosing(false); }, 300);
  };

  const [chats, setChats] = useState<Chat[]>([{ id: uid("chat"), title: "New business", messages: [], updatedAt: Date.now() }]);
  const [activeChatId, setActiveChatId] = useState(() => chats[0]?.id ?? "");
  const activeChat = useMemo(() => chats.find((c) => c.id === activeChatId) ?? chats[0], [chats, activeChatId]);

  // Sync websiteData/deployData from active chat when switching chats
  useEffect(() => {
    if (activeChat?.websiteData) { setWebsiteData(activeChat.websiteData); } else { setWebsiteData(null); setPreviewOpen(false); }
    if (activeChat?.deployData) { setDeployData(activeChat.deployData); } else { setDeployData(null); }
  }, [activeChatId]);

  // Helper: save websiteData to both state and active chat
  function saveWebsiteData(data: any) {
    setWebsiteData(data);
    if (activeChat?.id) setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, websiteData: data } : c));
  }
  function saveDeployData(data: any) {
    setDeployData(data);
    if (activeChat?.id) setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, deployData: data } : c));
  }

  // Persist animated IDs across reloads so typewriter never replays (local-only, cosmetic)
  const [animatedIds, setAnimatedIds] = useState<string[]>([]);
  useEffect(() => { const s = localStorage.getItem("zelrex_animated_ids"); if (s) try { setAnimatedIds(JSON.parse(s)); } catch {} }, []);
  useEffect(() => { localStorage.setItem("zelrex_animated_ids", JSON.stringify(animatedIds)); }, [animatedIds]);

  // ─── Load user data from Supabase ────────────────────────────────
  useEffect(() => {
    if (!isSignedIn || !clerkUser?.id) return;
    db.loadAll().then((data) => {
      if (!data) { setDataLoaded(true); return; }
      setDbUserId(data.user.id);
      // Load chats
      if (data.chats?.length > 0) {
        const mapped = data.chats.map((c: any) => ({
          id: c.id,
          title: c.title || "New business",
          messages: c.messages || [],
          updatedAt: new Date(c.updated_at).getTime(),
          pendingSurvey: c.pending_survey,
        }));
        setChats(mapped);
        setActiveChatId(mapped[0]?.id ?? "");
      }
      // Load goal
      if (data.goal) {
        setUserGoal({ text: data.goal.text, target: data.goal.target || "", deadline: data.goal.deadline || "" });
      }
      // Load notifications
      if (data.notifications?.length > 0) {
        setNotifications(data.notifications.map((n: any) => ({
          id: n.id, text: n.text, time: new Date(n.created_at).getTime(), read: n.read,
        })));
      }
      setDataLoaded(true);
    });
  }, [isSignedIn, clerkUser?.id]);

  const [searchQuery, setSearchQuery] = useState("");
  const filteredChats = useMemo(() => { const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt); const q = searchQuery.trim().toLowerCase(); if (!q) return sorted; return sorted.filter((c) => c.title?.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))); }, [chats, searchQuery]);

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
    if (!site?.copy?.home?.hero) {
      const hasAnyCopy = site?.copy && Object.keys(site.copy).length > 0;
      return `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{margin:0;box-sizing:border-box}body{font-family:Inter,-apple-system,sans-serif;background:#05070B;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}.c{max-width:400px}.t{font-size:20px;font-weight:700;margin-bottom:12px}.s{font-size:14px;color:rgba(255,255,255,0.5);line-height:1.6}</style></head><body><div class="c"><div class="t">${hasAnyCopy ? "Website is loading…" : "No website data yet"}</div><div class="s">${hasAnyCopy ? "The website copy was generated but the structure needs a refresh. Try clicking Preview again." : "Complete the survey to build your website."}</div></div></body></html>`;
    }

    const t = site.theme || {};
    const sv = site.survey || {};

    // ─── LIGHT/DARK MODE from survey preference ─────────
    const isLight = sv.stylePreference === "light-clean" || sv.stylePreference === "minimal-elegant";
    const bg = isLight ? (t.bg && !t.bg.startsWith("#0") && !t.bg.startsWith("#1") ? t.bg : "#FAFBFC") : (t.bg || "#0a0a0a");
    const text = isLight ? "#0F172A" : (t.textPrimary || "#ffffff");
    const textSec = isLight ? "#64748B" : (t.textSecondary || "rgba(255,255,255,0.6)");
    const accent = site.branding?.primaryColor || t.accent || "#4A90FF";
    const surface = isLight ? "#FFFFFF" : (t.surface || "#111111");
    const border = isLight ? "#E2E8F0" : (t.border || "rgba(255,255,255,0.08)");
    const name = site.branding?.name || "My Business";
    const c = site.copy;

    // ─── TEMPLATE SELECTION ──────────────────────────────
    const fontPref = sv.fontPreference || "";
    const tplMap: Record<string, string> = { modern: "minimal", classic: "editorial", editorial: "editorial", tech: "bold" };
    const tpl = site.template || tplMap[fontPref] || ["minimal", "bold", "editorial"][Math.abs(name.charCodeAt(0) + name.length) % 3];
    const isBold = tpl === "bold";
    const isEditorial = tpl === "editorial";

    // Template tokens
    const heroAlign = isBold ? "center" : "left";
    const headFont = isEditorial ? "'Playfair Display', Georgia, serif" : "'Inter', -apple-system, sans-serif";
    const btnRadius = isBold ? "12px" : isEditorial ? "4px" : "999px";

    // ─── STRUCTURALLY DIFFERENT HELPERS PER TEMPLATE ─────

    // Cards
    const cards = (items: any[]) => {
      if (isEditorial) {
        return items.map((item: any) => `
          <div style="border-left:3px solid ${accent};padding:20px 0 20px 28px;margin-bottom:28px">
            <div style="font-weight:700;font-size:18px;color:${text};margin-bottom:8px;font-family:${headFont}">${item.title || ""}</div>
            <div style="color:${textSec};font-size:15px;line-height:1.8">${item.description || ""}</div>
          </div>`).join("");
      }
      if (isBold) {
        return items.map((item: any) => `
          <div style="background:${surface};border:1px solid ${border};border-top:3px solid ${accent};border-radius:20px;padding:36px 28px;transition:transform 0.2s">
            <div style="font-weight:800;font-size:19px;color:${text};margin-bottom:12px">${item.title || ""}</div>
            <div style="color:${textSec};font-size:15px;line-height:1.7">${item.description || ""}</div>
          </div>`).join("");
      }
      return items.map((item: any) => `
        <div style="background:${surface};border:1px solid ${border};border-radius:16px;padding:28px">
          <div style="font-weight:700;font-size:16px;color:${text};margin-bottom:8px">${item.title || ""}</div>
          <div style="color:${textSec};font-size:14px;line-height:1.7">${item.description || ""}</div>
        </div>`).join("");
    };

    // Steps
    const stepsList = (steps: any[]) => {
      if (isEditorial) {
        return `<div class="grid-${Math.min(steps.length, 3)}" style="gap:40px">
          ${steps.map((s: any, i: number) => `
            <div style="text-align:center">
              <div style="font-family:${headFont};font-size:56px;font-weight:900;color:${accent}15;margin-bottom:8px;line-height:1">${String(i + 1).padStart(2, "0")}</div>
              <div style="font-weight:700;font-size:17px;color:${text};margin-bottom:10px;font-family:${headFont}">${s.title || ""}</div>
              <div style="color:${textSec};font-size:14px;line-height:1.7">${s.description || ""}</div>
            </div>`).join("")}
        </div>`;
      }
      if (isBold) {
        return steps.map((s: any, i: number) => `
          <div style="display:flex;gap:24px;align-items:flex-start;margin-bottom:40px">
            <div style="width:56px;height:56px;border-radius:16px;background:${accent};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:22px;flex-shrink:0">${i + 1}</div>
            <div style="padding-top:6px">
              <div style="font-weight:800;font-size:19px;color:${text};margin-bottom:8px">${s.title || ""}</div>
              <div style="color:${textSec};font-size:15px;line-height:1.7">${s.description || ""}</div>
            </div>
          </div>`).join("");
      }
      return steps.map((s: any, i: number) => `
        <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:28px">
          <div style="width:40px;height:40px;border-radius:50%;background:${accent}15;color:${accent};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:15px;flex-shrink:0">${i + 1}</div>
          <div>
            <div style="font-weight:700;font-size:16px;color:${text};margin-bottom:6px">${s.title || ""}</div>
            <div style="color:${textSec};font-size:14px;line-height:1.7">${s.description || ""}</div>
          </div>
        </div>`).join("");
    };

    // CTA Block — structurally different per template
    const ctaBlock = (data: any) => {
      if (!data) return "";
      if (isBold) return `
        <section class="section" style="text-align:center">
          <div style="background:linear-gradient(135deg, ${accent}12 0%, ${accent}04 100%);border:1px solid ${accent}20;border-radius:28px;padding:64px 40px;max-width:900px;margin:0 auto">
            <h2 class="h2" style="margin-bottom:16px">${data.title || ""}</h2>
            ${data.subtitle ? `<p class="lead" style="margin:0 auto 28px;text-align:center">${data.subtitle}</p>` : ""}
            <span class="btn-primary" data-nav="contact" style="cursor:pointer;font-size:16px;padding:18px 40px">${data.cta?.text || "Get in touch"}</span>
          </div>
        </section>`;
      if (isEditorial) return `
        <section class="section" style="border-top:2px solid ${accent};padding-top:48px;margin-top:40px">
          <h2 class="h2" style="margin-bottom:12px">${data.title || ""}</h2>
          ${data.subtitle ? `<p class="lead" style="margin-bottom:28px">${data.subtitle}</p>` : ""}
          <span class="btn-primary" data-nav="contact" style="cursor:pointer">${data.cta?.text || "Get in touch"}</span>
        </section>`;
      return `
        <section class="section">
          <h2 class="h2" style="margin-bottom:12px">${data.title || ""}</h2>
          ${data.subtitle ? `<p class="lead" style="margin-bottom:28px">${data.subtitle}</p>` : ""}
          <span class="btn-primary" data-nav="contact" style="cursor:pointer">${data.cta?.text || "Get in touch"}</span>
        </section>`;
    };

    // ─── SVG Social Icons (18×18, fill=currentColor) ──────
    const SI: Record<string, string> = {
      twitterx: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      linkedin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
      instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>`,
      youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      tiktok: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>`,
      facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
      discord: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/></svg>`,
      dribbble: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308a10.174 10.174 0 004.392-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.04 6.4a10.15 10.15 0 006.29 2.166c1.42 0 2.77-.29 4.006-.816zm-11.62-2.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702A10.144 10.144 0 0012 1.842c-.83 0-1.634.1-2.4.21zm10.335 3.483c-.218.29-1.91 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z"/></svg>`,
      behance: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.5-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-1.16 1.35-.48.348-1.05.6-1.67.767-.62.16-1.26.25-1.92.25H0V4.51h6.938v-.007zM6.545 10.16c.56 0 1.01-.155 1.36-.465.348-.31.52-.733.52-1.27 0-.307-.06-.573-.174-.8a1.378 1.378 0 00-.47-.53 2.01 2.01 0 00-.72-.3 3.77 3.77 0 00-.88-.1H3.308v3.47h3.237v-.005zm.2 5.39c.346 0 .666-.04.96-.12.296-.08.556-.2.78-.36.22-.162.398-.38.52-.65.124-.27.186-.6.186-.99 0-.78-.247-1.348-.74-1.7-.492-.35-1.14-.53-1.94-.53H3.31v4.35h3.435zM21.568 11.78c.04.418.06.827.06 1.23h-8.18c.04.79.28 1.42.71 1.88.43.46 1.01.69 1.74.69.53 0 .97-.15 1.34-.45.37-.3.62-.63.76-1.01h2.6c-.42 1.3-1.09 2.25-2.01 2.85-.92.6-2.02.9-3.31.9-.87 0-1.67-.15-2.39-.44a5.22 5.22 0 01-1.85-1.23c-.51-.53-.9-1.15-1.18-1.87-.28-.72-.42-1.51-.42-2.37 0-.83.14-1.6.42-2.33.28-.73.67-1.35 1.18-1.88a5.52 5.52 0 011.85-1.27c.72-.31 1.52-.46 2.39-.46.95 0 1.78.18 2.49.55.71.37 1.3.86 1.76 1.48.46.62.8 1.33 1.01 2.14.08.28.14.57.17.87v-.01zm-2.73-1.02c-.07-.66-.31-1.19-.73-1.59-.42-.4-.96-.6-1.63-.6-.43 0-.79.07-1.09.22-.3.14-.55.33-.74.57-.2.24-.34.5-.44.79-.1.29-.16.56-.19.82h4.82zM15.116 4.14h5.42v1.44h-5.42V4.14z"/></svg>`,
      github: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>`,
    };
    // Normalize keys: "Twitter/X"→"twitterx", "TikTok"→"tiktok", "Facebook"→"facebook"
    function iconKey(raw: string) { return raw.toLowerCase().replace(/[\s\/]/g, ""); }

    // Build social icon links
    const socials = site.branding?.socialLinks || {};
    const socialEntries = Object.entries(socials).filter(([, v]) => v);
    const socialIconsHtml = socialEntries.map(([k, v]) => {
      const key = iconKey(k as string);
      const icon = SI[key];
      const label = (k as string).charAt(0).toUpperCase() + (k as string).slice(1);
      // Always render icon tile — fallback to first letter if no SVG
      return `<a href="${v}" target="_blank" rel="noopener noreferrer" class="ft-icon" title="${label}">${icon || `<span style="font-size:13px;font-weight:700">${label.charAt(0)}</span>`}</a>`;
    }).join("");

    // Build premium footer
    const fEmail = sv.email || "";
    const fPhone = sv.phone || "";
    const fLoc = sv.location || "";
    const fBook = sv.calendlyUrl || "";
    const fTag = site.branding?.tagline || sv.tagline || "";
    const fYear = new Date().getFullYear();
    const fService = sv.mainService || c.offer?.hero?.headline || "";

    // Phone href-safe (strip non-digits)
    const fPhoneHref = fPhone ? fPhone.replace(/[^0-9+]/g, "") : "";

    const footerHtml = `
    <footer class="ft">
      <div class="ft-inner">
        <div class="ft-top">
          <div class="ft-brand">
            <div class="ft-logo" ${isEditorial ? `style="font-family:${headFont}"` : ""}>${name}</div>
            ${fTag ? `<p class="ft-tagline">${fTag}</p>` : ""}
            ${fService && !fTag ? `<p class="ft-tagline">${fService}</p>` : ""}
            ${socialIconsHtml ? `<div class="ft-icons">${socialIconsHtml}</div>` : ""}
          </div>
          <div class="ft-columns">
            <div class="ft-col">
              <div class="ft-col-head">Pages</div>
              <a data-nav="home" class="ft-link">Home</a>
              <a data-nav="services" class="ft-link">Services</a>
              <a data-nav="pricing" class="ft-link">Pricing</a>
              <a data-nav="about" class="ft-link">About</a>
              <a data-nav="contact" class="ft-link">Contact</a>
            </div>
            <div class="ft-col">
              <div class="ft-col-head">Contact</div>
              ${fEmail ? `<a href="mailto:${fEmail}" class="ft-link">${fEmail}</a>` : ""}
              ${fPhone ? `<a href="tel:${fPhoneHref}" class="ft-link">${fPhone}</a>` : ""}
              ${fBook ? `<a href="${fBook}" target="_blank" rel="noopener noreferrer" class="ft-link ft-link-accent">${isEditorial ? "Schedule a call →" : "Book a call"}</a>` : ""}
              ${fLoc ? `<span class="ft-link ft-muted">${fLoc}</span>` : ""}
            </div>
          </div>
        </div>
        <div class="ft-div"></div>
        <div class="ft-bottom">
          <span class="ft-copy">&copy; ${fYear} ${name}. All rights reserved.</span>
        </div>
      </div>
    </footer>`;

    // Social proof — structurally different per template
    const proofItems = c.home?.socialProof?.items || [];
    const socialProofSection = proofItems.length === 0 ? "" : (() => {
      if (isBold) {
        return `<div class="divider"></div>
        <section class="section" style="text-align:center;background:${surface}">
          <div class="eyebrow">${c.home?.socialProof?.eyebrow || "Results"}</div>
          <h2 class="h2" style="margin-bottom:48px;margin-left:auto;margin-right:auto">${c.home?.socialProof?.title || ""}</h2>
          <div class="grid-3">${proofItems.map((p: any) => `
            <div style="padding:32px">
              <div style="font-size:48px;font-weight:900;color:${accent};letter-spacing:-0.03em;margin-bottom:8px">${p.value || ""}</div>
              <div style="font-weight:700;font-size:16px;color:${text};margin-bottom:6px">${p.label || ""}</div>
              <div style="color:${textSec};font-size:14px">${p.detail || ""}</div>
            </div>`).join("")}</div>
        </section>`;
      }
      if (isEditorial) {
        return `<div class="divider"></div>
        <section class="section">
          <div class="eyebrow">${c.home?.socialProof?.eyebrow || "Results"}</div>
          <h2 class="h2" style="margin-bottom:36px">${c.home?.socialProof?.title || ""}</h2>
          <div style="display:flex;gap:48px;flex-wrap:wrap">${proofItems.map((p: any) => `
            <div>
              <div style="font-size:36px;font-weight:900;color:${text};font-family:${headFont};margin-bottom:4px">${p.value || ""}</div>
              <div style="font-weight:600;font-size:14px;color:${accent};text-transform:uppercase;letter-spacing:0.06em">${p.label || ""}</div>
              ${p.detail ? `<div style="color:${textSec};font-size:13px;margin-top:4px">${p.detail}</div>` : ""}
            </div>`).join("")}</div>
        </section>`;
      }
      return `<div class="divider"></div>
      <section class="section">
        <div class="eyebrow">${c.home?.socialProof?.eyebrow || "Results"}</div>
        <h2 class="h2" style="margin-bottom:8px">${c.home?.socialProof?.title || ""}</h2>
        ${c.home?.socialProof?.subtitle ? `<p class="lead" style="margin-bottom:32px">${c.home.socialProof.subtitle}</p>` : ""}
        <div class="grid-3">${proofItems.map((p: any) => `
          <div style="background:${surface};border:1px solid ${border};border-radius:16px;padding:24px;text-align:center">
            <div style="font-size:28px;font-weight:900;color:${accent};margin-bottom:8px">${p.value || ""}</div>
            <div style="font-weight:600;font-size:14px;color:${text};margin-bottom:4px">${p.label || ""}</div>
            <div style="color:${textSec};font-size:13px">${p.detail || ""}</div>
          </div>`).join("")}</div>
      </section>`;
    })();

    // ── HOME PAGE — structurally different heroes ──
    const homeVp = c.home?.valueProps?.items || [];
    const homeSteps = c.home?.howItWorks?.steps || [];
    const ctaText = c.home?.primaryCta?.cta?.text || "Get in touch";
    const homePage = (() => {
      if (isBold) return `
        <section class="section hero-section" style="padding-top:140px;padding-bottom:100px;text-align:center;background:linear-gradient(180deg, ${accent}08 0%, transparent 50%)">
          <div class="eyebrow" style="font-size:13px;letter-spacing:0.12em">${c.home?.valueProps?.eyebrow || name}</div>
          <h1 class="h1" style="max-width:900px;margin:0 auto 24px;font-size:clamp(44px,6vw,72px)">${c.home?.hero?.headline || name}</h1>
          <p class="lead" style="margin:0 auto 40px;max-width:640px;font-size:19px">${c.home?.hero?.subheadline || ""}</p>
          <span class="btn-primary" data-nav="contact" style="cursor:pointer;font-size:16px;padding:18px 44px">${ctaText}</span>
        </section>
        <section class="section" style="background:${surface};padding:80px 24px">
          <div style="text-align:center;margin-bottom:48px">
            <div class="eyebrow">${c.home?.valueProps?.eyebrow || "What we do"}</div>
            <h2 class="h2" style="margin:0 auto">${c.home?.valueProps?.title || ""}</h2>
            ${c.home?.valueProps?.subtitle ? `<p class="lead" style="margin:12px auto 0">${c.home.valueProps.subtitle}</p>` : ""}
          </div>
          <div class="grid-${homeVp.length > 3 ? "3" : "2"}" style="max-width:1000px;margin:0 auto">${cards(homeVp)}</div>
        </section>
        <section class="section" style="padding:100px 24px">
          <div style="text-align:center;margin-bottom:48px">
            <div class="eyebrow">${c.home?.howItWorks?.eyebrow || "How it works"}</div>
            <h2 class="h2">${c.home?.howItWorks?.title || ""}</h2>
          </div>
          <div style="max-width:640px;margin:0 auto">${stepsList(homeSteps)}</div>
        </section>
        ${socialProofSection}
        ${ctaBlock(c.home?.primaryCta)}`;
      if (isEditorial) return `
        <section class="section hero-section" style="padding-top:120px;padding-bottom:80px">
          <div style="max-width:760px">
            <h1 class="h1" style="font-size:clamp(40px,5.5vw,68px);margin-bottom:24px;line-height:1.05">${c.home?.hero?.headline || name}</h1>
            <p class="lead" style="margin-bottom:40px;font-size:18px;line-height:1.8">${c.home?.hero?.subheadline || ""}</p>
            <span class="btn-primary" data-nav="contact" style="cursor:pointer;text-transform:uppercase;letter-spacing:0.06em;font-size:13px;padding:16px 36px">${ctaText}</span>
          </div>
        </section>
        <div class="divider"></div>
        <section class="section" style="padding:80px 24px">
          <div class="eyebrow">${c.home?.valueProps?.eyebrow || "What we do"}</div>
          <h2 class="h2" style="margin-bottom:12px">${c.home?.valueProps?.title || ""}</h2>
          ${c.home?.valueProps?.subtitle ? `<p class="lead" style="margin-bottom:40px">${c.home.valueProps.subtitle}</p>` : ""}
          <div style="max-width:700px">${cards(homeVp)}</div>
        </section>
        <section class="section" style="border-top:1px solid ${border};border-bottom:1px solid ${border};padding:80px 24px">
          <div class="eyebrow">${c.home?.howItWorks?.eyebrow || "Process"}</div>
          <h2 class="h2" style="margin-bottom:40px">${c.home?.howItWorks?.title || ""}</h2>
          ${stepsList(homeSteps)}
        </section>
        ${socialProofSection}
        ${ctaBlock(c.home?.primaryCta)}`;
      // Minimal (default)
      return `
        <section class="section hero-section" style="padding-top:100px;padding-bottom:80px">
          <div class="eyebrow">${c.home?.valueProps?.eyebrow || name}</div>
          <h1 class="h1" style="max-width:720px;margin-bottom:20px">${c.home?.hero?.headline || name}</h1>
          <p class="lead" style="margin-bottom:36px">${c.home?.hero?.subheadline || ""}</p>
          <span class="btn-primary" data-nav="contact" style="cursor:pointer">${ctaText}</span>
        </section>
        <div class="divider"></div>
        <section class="section">
          <div class="eyebrow">${c.home?.valueProps?.eyebrow || "What we do"}</div>
          <h2 class="h2" style="margin-bottom:8px">${c.home?.valueProps?.title || ""}</h2>
          <p class="lead" style="margin-bottom:36px">${c.home?.valueProps?.subtitle || ""}</p>
          <div class="grid-${homeVp.length > 3 ? "3" : "2"}">${cards(homeVp)}</div>
        </section>
        <div class="divider"></div>
        <section class="section">
          <div class="eyebrow">${c.home?.howItWorks?.eyebrow || "How it works"}</div>
          <h2 class="h2" style="margin-bottom:8px">${c.home?.howItWorks?.title || ""}</h2>
          <p class="lead" style="margin-bottom:36px">${c.home?.howItWorks?.subtitle || ""}</p>
          <div style="max-width:640px">${stepsList(homeSteps)}</div>
        </section>
        ${socialProofSection}
        ${ctaBlock(c.home?.primaryCta)}`;
    })();

    // ── SERVICES PAGE ──
    const offerItems = c.offer?.whatYouGet?.items || homeVp;
    const whoItems = c.offer?.whoItsFor?.items || [];
    const guaranteeHtml = sv.guarantee ? (() => {
      if (isBold) return `
        <section class="section" style="text-align:center">
          <div style="display:inline-flex;align-items:center;gap:16px;padding:28px 36px;border-radius:20px;background:${accent}08;border:1px solid ${accent}20">
            <span style="font-size:28px">🛡️</span>
            <div style="text-align:left">
              <div style="font-weight:800;font-size:17px;color:${text};margin-bottom:4px">Our Guarantee</div>
              <div style="color:${textSec};font-size:15px">${sv.guarantee}</div>
            </div>
          </div>
          ${sv.turnaround ? `<div style="margin-top:20px;color:${textSec};font-size:15px">Typical turnaround: <strong style="color:${text}">${sv.turnaround}</strong></div>` : ""}
        </section>`;
      return `
        <section class="section">
          <div style="display:flex;align-items:center;gap:16px;padding:24px 28px;border-radius:12px;background:${accent}06;border:1px solid ${accent}18;max-width:600px">
            <span style="font-size:24px">🛡️</span>
            <div>
              <div style="font-weight:700;font-size:15px;color:${text};margin-bottom:2px">Guarantee</div>
              <div style="color:${textSec};font-size:14px">${sv.guarantee}</div>
            </div>
          </div>
          ${sv.turnaround ? `<div style="margin-top:16px;color:${textSec};font-size:14px">Typical turnaround: <strong style="color:${text}">${sv.turnaround}</strong></div>` : ""}
        </section>`;
    })() : "";

    const servicesPage = `
      <section class="section hero-section" style="padding-top:${isBold ? "120px" : "100px"};padding-bottom:80px;text-align:${heroAlign};${isBold ? `background:linear-gradient(180deg, ${accent}06 0%, transparent 40%)` : ""}">
        <div class="eyebrow">Services</div>
        <h1 class="h1" style="max-width:${isBold ? "800px" : "720px"};margin-bottom:20px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.offer?.hero?.headline || "What we offer"}</h1>
        <p class="lead" style="margin-bottom:36px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.offer?.hero?.subheadline || ""}</p>
      </section>
      <div class="divider"></div>
      <section class="section" ${isBold ? `style="background:${surface};padding:80px 24px"` : ""}>
        <div class="eyebrow">${c.offer?.whatYouGet?.eyebrow || "Deliverables"}</div>
        <h2 class="h2" style="margin-bottom:8px">${c.offer?.whatYouGet?.title || "What's included"}</h2>
        <p class="lead" style="margin-bottom:36px">${c.offer?.whatYouGet?.subtitle || ""}</p>
        <div class="${isEditorial ? "" : "grid-2"}" ${isEditorial ? 'style="max-width:700px"' : ""}>${cards(offerItems)}</div>
      </section>
      ${whoItems.length ? `<div class="divider"></div>
      <section class="section">
        <div class="eyebrow">${c.offer?.whoItsFor?.eyebrow || "Ideal client"}</div>
        <h2 class="h2" style="margin-bottom:8px">${c.offer?.whoItsFor?.title || "Is this for you?"}</h2>
        <p class="lead" style="margin-bottom:36px">${c.offer?.whoItsFor?.subtitle || ""}</p>
        <div class="${isEditorial ? "" : "grid-2"}" ${isEditorial ? 'style="max-width:700px"' : ""}>${cards(whoItems)}</div>
      </section>` : ""}
      ${guaranteeHtml}
      ${ctaBlock(c.offer?.cta)}`;

    // ── PRICING PAGE — structurally different per template ──
    const tiers = c.pricing?.pricing?.tiers || [];
    const stripeUrls: Record<string, string> = site.stripeCheckoutUrls || {};

    // Helper: resolve CTA for a tier — Stripe checkout if available, else contact nav
    function tierCta(tier: any, extraStyle: string = ""): string {
      const key = (tier.name || "").toLowerCase().replace(/[^a-z0-9]/g, "_");
      // Try exact key match, then try all keys for a partial match
      let url = stripeUrls[key];
      if (!url) {
        for (const [k, v] of Object.entries(stripeUrls)) {
          if (k.toLowerCase().includes(key) || key.includes(k.toLowerCase())) { url = v as string; break; }
        }
      }
      // If only one Stripe URL exists and only one tier, use it
      if (!url && tiers.length === 1 && Object.keys(stripeUrls).length === 1) {
        url = Object.values(stripeUrls)[0] as string;
      }
      const ctaText = url ? `Get ${tier.name || "Started"}` : (c.pricing?.cta?.cta?.text || "Get started");
      if (url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="btn-primary" style="cursor:pointer;display:block;text-align:center;text-decoration:none;${extraStyle}">${ctaText}</a>`;
      }
      return `<span class="btn-primary" data-nav="contact" style="cursor:pointer;display:block;text-align:center;${extraStyle}">${ctaText}</span>`;
    }

    const tiersHtml = (() => {
      if (isEditorial) {
        return tiers.map((tier: any) => `
          <div style="border:1px solid ${tier.highlighted ? accent : border};padding:40px 32px;${tier.highlighted ? `border-width:2px;` : ""}">
            <div style="font-weight:700;font-size:20px;color:${text};font-family:${headFont};margin-bottom:8px">${tier.name || ""}</div>
            <div style="font-weight:900;font-size:44px;color:${text};margin:12px 0;letter-spacing:-0.03em;font-family:${headFont}">${tier.price || ""}</div>
            ${tier.note ? `<div style="color:${textSec};font-size:14px;margin-bottom:16px;font-style:italic">${tier.note}</div>` : ""}
            <div style="border-top:1px solid ${border};padding-top:20px;margin-top:20px">
              ${(tier.features || []).map((f: string) => `
                <div style="color:${textSec};font-size:14px;margin-bottom:10px;padding-left:16px;position:relative">
                  <span style="position:absolute;left:0;color:${accent}">—</span> ${f}
                </div>`).join("")}
            </div>
            ${tierCta(tier, `margin-top:28px;${tier.highlighted ? "" : `background:transparent;border:2px solid ${border};color:${text};`}text-transform:uppercase;letter-spacing:0.04em;font-size:13px`)}
          </div>`).join("");
      }
      if (isBold) {
        return tiers.map((tier: any) => `
          <div style="background:${tier.highlighted ? `linear-gradient(135deg, ${accent}15, ${accent}05)` : surface};border:${tier.highlighted ? `2px solid ${accent}` : `1px solid ${border}`};border-radius:24px;padding:40px 32px;${tier.highlighted ? `box-shadow:0 20px 60px ${accent}15;transform:scale(1.03);` : ""}position:relative">
            ${tier.highlighted ? `<div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:${accent};color:#fff;font-size:12px;font-weight:800;padding:4px 16px;border-radius:999px;letter-spacing:0.06em">POPULAR</div>` : ""}
            <div style="font-weight:800;font-size:20px;color:${text};text-align:center">${tier.name || ""}</div>
            <div style="font-weight:900;font-size:52px;color:${text};margin:20px 0 12px;letter-spacing:-0.04em;text-align:center">${tier.price || ""}</div>
            ${tier.note ? `<div style="color:${textSec};font-size:14px;text-align:center;margin-bottom:12px">${tier.note}</div>` : ""}
            <div style="border-top:1px solid ${border};padding-top:24px;margin-top:24px">
              ${(tier.features || []).map((f: string) => `
                <div style="display:flex;align-items:center;gap:12px;color:${textSec};font-size:15px;margin-bottom:14px">
                  <span style="color:${accent};font-size:18px;font-weight:bold">✓</span> ${f}
                </div>`).join("")}
            </div>
            ${tierCta(tier, `margin-top:28px;font-size:16px;padding:16px;${tier.highlighted ? "" : `background:transparent;border:2px solid ${border};color:${text};`}`)}
          </div>`).join("");
      }
      return tiers.map((tier: any) => `
        <div style="background:${surface};border:1px solid ${tier.highlighted ? accent : border};border-radius:16px;padding:32px;${tier.highlighted ? `box-shadow:0 0 40px ${accent}12;` : ""}">
          <div style="font-weight:700;font-size:18px;color:${text}">${tier.name || ""}</div>
          <div style="font-weight:900;font-size:40px;color:${text};margin:16px 0 8px;letter-spacing:-0.03em">${tier.price || ""}</div>
          ${tier.note ? `<div style="color:${textSec};font-size:14px;margin-bottom:8px">${tier.note}</div>` : ""}
          <div style="margin-top:20px;border-top:1px solid ${border};padding-top:20px">
            ${(tier.features || []).map((f: string) => `
              <div style="display:flex;align-items:center;gap:10px;color:${textSec};font-size:14px;margin-bottom:12px">
                <span style="color:${accent}">✓</span> ${f}
              </div>`).join("")}
          </div>
          ${tierCta(tier, `margin-top:24px;${tier.highlighted ? "" : `background:transparent;border:1px solid ${border};color:${text};`}`)}
        </div>`).join("");
    })();

    const pricingPage = `
      <section class="section hero-section" style="padding-top:${isBold ? "120px" : "100px"};padding-bottom:80px;text-align:${heroAlign};${isBold ? `background:linear-gradient(180deg, ${accent}06 0%, transparent 40%)` : ""}">
        <div class="eyebrow">${c.pricing?.pricing?.eyebrow || "Pricing"}</div>
        <h1 class="h1" style="max-width:720px;margin-bottom:20px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.pricing?.hero?.headline || "Pricing"}</h1>
        <p class="lead" style="margin-bottom:36px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.pricing?.hero?.subheadline || ""}</p>
      </section>
      <div class="divider"></div>
      <section class="section">
        <div class="grid-${tiers.length > 2 ? "3" : tiers.length === 2 ? "2" : "1"}" ${tiers.length === 1 ? 'style="max-width:440px"' : ""} style="align-items:${isBold ? "center" : "start"}">${tiersHtml}</div>
      </section>
      ${ctaBlock(c.pricing?.cta)}`;

    // ── ABOUT PAGE ──
    const values = c.about?.values?.items || [];
    const aboutPage = (() => {
      if (isEditorial) return `
        <section class="section hero-section" style="padding-top:120px;padding-bottom:80px">
          <h1 class="h1" style="max-width:800px;font-size:clamp(40px,5.5vw,64px);margin-bottom:24px">${c.about?.hero?.headline || "About " + name}</h1>
          <p class="lead" style="font-size:18px;line-height:1.8">${c.about?.hero?.subheadline || ""}</p>
        </section>
        <div class="divider"></div>
        <section class="section" style="border-top:1px solid ${border};border-bottom:1px solid ${border};padding:80px 24px">
          <div class="eyebrow">${c.about?.story?.eyebrow || "The story"}</div>
          <h2 class="h2" style="margin-bottom:20px">${c.about?.story?.title || "Our story"}</h2>
          <div style="color:${textSec};font-size:17px;line-height:2;max-width:680px;font-family:Georgia,serif">${c.about?.story?.body || sv.aboutStory || ""}</div>
        </section>
        ${values.length ? `
        <section class="section">
          <div class="eyebrow">${c.about?.values?.eyebrow || "Principles"}</div>
          <h2 class="h2" style="margin-bottom:32px">${c.about?.values?.title || "How we work"}</h2>
          <div style="max-width:700px">${cards(values)}</div>
        </section>` : ""}
        ${ctaBlock(c.about?.cta)}`;
      if (isBold) return `
        <section class="section hero-section" style="padding-top:140px;padding-bottom:100px;text-align:center;background:linear-gradient(180deg, ${accent}08 0%, transparent 50%)">
          <div class="eyebrow">${c.about?.story?.eyebrow || "About"}</div>
          <h1 class="h1" style="max-width:800px;margin:0 auto 24px">${c.about?.hero?.headline || "About " + name}</h1>
          <p class="lead" style="margin:0 auto">${c.about?.hero?.subheadline || ""}</p>
        </section>
        <section class="section" style="background:${surface};padding:80px 24px">
          <div style="max-width:720px;margin:0 auto;text-align:center">
            <h2 class="h2" style="margin-bottom:20px">${c.about?.story?.title || "Our story"}</h2>
            <div style="color:${textSec};font-size:17px;line-height:1.9">${c.about?.story?.body || sv.aboutStory || ""}</div>
          </div>
        </section>
        ${values.length ? `
        <section class="section" style="padding:80px 24px">
          <div style="text-align:center;margin-bottom:48px">
            <div class="eyebrow">${c.about?.values?.eyebrow || "Values"}</div>
            <h2 class="h2">${c.about?.values?.title || "How we work"}</h2>
          </div>
          <div class="grid-${values.length > 2 ? "3" : "2"}" style="max-width:1000px;margin:0 auto">${cards(values)}</div>
        </section>` : ""}
        ${ctaBlock(c.about?.cta)}`;
      return `
        <section class="section hero-section" style="padding-top:100px;padding-bottom:80px">
          <div class="eyebrow">${c.about?.story?.eyebrow || "About"}</div>
          <h1 class="h1" style="max-width:720px;margin-bottom:20px">${c.about?.hero?.headline || "About " + name}</h1>
          <p class="lead" style="margin-bottom:36px">${c.about?.hero?.subheadline || ""}</p>
        </section>
        <div class="divider"></div>
        <section class="section">
          <h2 class="h2" style="margin-bottom:16px">${c.about?.story?.title || "Our story"}</h2>
          <div style="color:${textSec};font-size:16px;line-height:1.8;max-width:720px">${c.about?.story?.body || sv.aboutStory || ""}</div>
        </section>
        ${values.length ? `<div class="divider"></div>
        <section class="section">
          <div class="eyebrow">${c.about?.values?.eyebrow || "Values"}</div>
          <h2 class="h2" style="margin-bottom:8px">${c.about?.values?.title || "How we work"}</h2>
          <div class="grid-2" style="margin-top:28px">${cards(values)}</div>
        </section>` : ""}
        ${ctaBlock(c.about?.cta)}`;
    })();

    // ── CONTACT PAGE ──
    const methods = c.contact?.methods?.items || [];
    const nextSteps = c.contact?.nextSteps?.items || [];
    const contactDetails: Array<{label:string;value:string;href?:string}> = [];
    if (sv.email) contactDetails.push({ label: "Email", value: sv.email, href: `mailto:${sv.email}` });
    if (sv.phone) contactDetails.push({ label: "Phone", value: sv.phone, href: `tel:${sv.phone}` });
    if (sv.location) contactDetails.push({ label: "Location", value: sv.location });
    if (sv.hours) contactDetails.push({ label: "Hours", value: sv.hours });
    const contactItems = contactDetails.length > 0 ? contactDetails : methods;
    const bookingUrl = sv.calendlyUrl || "";

    const contactPage = (() => {
      const contactCards = contactItems.map((m: any) => {
        if (isBold) return `
          <div style="background:${surface};border:1px solid ${border};border-radius:20px;padding:28px;text-align:center">
            <div style="font-weight:700;font-size:14px;color:${textSec};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">${m.label || ""}</div>
            ${m.href ? `<a href="${m.href}" style="color:${accent};font-size:17px;font-weight:700;text-decoration:none">${m.value || ""}</a>` :
              `<div style="color:${accent};font-size:17px;font-weight:700">${m.value || ""}</div>`}
          </div>`;
        if (isEditorial) return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:1px solid ${border}">
            <span style="font-weight:600;font-size:14px;color:${textSec};text-transform:uppercase;letter-spacing:0.04em">${m.label || ""}</span>
            ${m.href ? `<a href="${m.href}" style="color:${accent};font-size:15px;font-weight:600;text-decoration:none">${m.value || ""}</a>` :
              `<span style="color:${text};font-size:15px;font-weight:600">${m.value || ""}</span>`}
          </div>`;
        return `
          <div style="background:${surface};border:1px solid ${border};border-radius:16px;padding:24px">
            <div style="font-weight:600;font-size:14px;color:${textSec};margin-bottom:4px">${m.label || ""}</div>
            ${m.href ? `<a href="${m.href}" style="color:${accent};font-size:15px;font-weight:500;text-decoration:none">${m.value || ""}</a>` :
              `<div style="color:${accent};font-size:15px;font-weight:500">${m.value || ""}</div>`}
          </div>`;
      }).join("");

      return `
        <section class="section hero-section" style="padding-top:${isBold ? "120px" : "100px"};padding-bottom:80px;text-align:${heroAlign};${isBold ? `background:linear-gradient(180deg, ${accent}06 0%, transparent 40%)` : ""}">
          <div class="eyebrow">${c.contact?.methods?.eyebrow || "Contact"}</div>
          <h1 class="h1" style="max-width:720px;margin-bottom:20px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.contact?.hero?.headline || "Get in touch"}</h1>
          <p class="lead" style="margin-bottom:36px;${isBold ? "margin-left:auto;margin-right:auto" : ""}">${c.contact?.hero?.subheadline || ""}</p>
          ${bookingUrl ? `<a href="${bookingUrl}" target="_blank" rel="noopener" class="btn-primary" style="text-decoration:none">${c.contact?.cta?.cta?.text || "Book a call"}</a>` : ""}
        </section>
        <div class="divider"></div>
        <section class="section">
          <h2 class="h2" style="margin-bottom:24px">${c.contact?.methods?.title || "Reach out"}</h2>
          <div ${isEditorial ? 'style="max-width:560px"' : `class="grid-2" style="max-width:540px"`}>${contactCards}</div>
        </section>
        ${nextSteps.length ? `<div class="divider"></div>
        <section class="section">
          <div class="eyebrow">${c.contact?.nextSteps?.eyebrow || "Next steps"}</div>
          <h2 class="h2" style="margin-bottom:8px">${c.contact?.nextSteps?.title || "What happens next"}</h2>
          <div ${isEditorial ? 'style="max-width:700px;margin-top:28px"' : 'class="grid-2" style="margin-top:28px"'}>${cards(nextSteps)}</div>
        </section>` : ""}
        ${ctaBlock(c.contact?.cta)}`;
    })();

    // ─── CSS — template-specific ────────────────────────────────
    const templateCSS = isBold ? `
      body { background: ${bg}; }
      .section { max-width: 1140px; }
      .nav-inner { max-width: 1140px; }
      .h1 { font-size: clamp(44px, 6vw, 72px); font-weight: 900; line-height: 1.04; }
      .h2 { font-size: clamp(32px, 4vw, 48px); font-weight: 800; }
      .lead { font-size: 18px; }
      .btn-primary { padding: 16px 36px; border-radius: 12px; font-size: 16px; }
    ` : isEditorial ? `
      body { background: ${bg}; font-family: 'Inter', Georgia, serif; }
      .h1 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(40px, 5.5vw, 68px); font-weight: 900; line-height: 1.05; letter-spacing: -0.02em; }
      .h2 { font-family: 'Playfair Display', Georgia, serif; font-size: clamp(28px, 3.5vw, 44px); font-weight: 800; }
      .lead { font-size: 17px; line-height: 1.8; }
      .btn-primary { padding: 14px 32px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-size: 13px; }
      .eyebrow { letter-spacing: 0.12em; }
    ` : `
      body { background: ${bg}; }
      .h1 { font-size: clamp(36px, 5vw, 56px); font-weight: 900; line-height: 1.08; }
      .h2 { font-size: clamp(28px, 3.5vw, 40px); font-weight: 800; }
      .btn-primary { padding: 14px 32px; border-radius: 999px; }
    `;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  ${isEditorial ? '<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">' : ""}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: ${bg}; color: ${text}; -webkit-font-smoothing: antialiased; }
    .page { display: none; }
    .page.active { display: block; }
    .section { padding: 80px 24px; max-width: 1100px; margin: 0 auto; }
    .eyebrow { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${accent}; margin-bottom: 14px; }
    .h1 { font-weight: 900; letter-spacing: -0.03em; color: ${text}; }
    .h2 { font-weight: 800; letter-spacing: -0.025em; color: ${text}; line-height: 1.12; }
    .lead { font-size: 17px; line-height: 1.6; color: ${textSec}; max-width: 600px; }
    .btn-primary { display: inline-flex; align-items: center; background: ${accent}; color: #fff; font-weight: 700; font-size: 15px; text-decoration: none; transition: transform 0.15s, box-shadow 0.15s; cursor: pointer; border: none; }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 30px ${accent}44; }
    .nav { position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); background: ${isLight ? bg + "ee" : bg + "dd"}; border-bottom: 1px solid ${border}; }
    .nav-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; height: 60px; display: flex; align-items: center; justify-content: space-between; }
    .nav-links { display: flex; gap: 28px; align-items: center; }
    .nav-links a { font-size: 13px; font-weight: 500; color: ${textSec}; text-decoration: none; transition: color 0.15s; cursor: pointer; }
    .nav-links a:hover { color: ${text}; }
    .nav-links a.active { color: ${accent}; }
    .grid-1 { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .divider { height: 1px; background: ${border}; max-width: 1100px; margin: 0 auto; }

    /* ── FOOTER ─────────────────────────────────── */
    .ft { border-top: 1px solid ${border}; background: ${isLight ? "#F1F5F9" : surface}; }
    .ft-inner { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .ft-top { display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 48px; padding: 60px 0 44px; }
    .ft-brand { display: flex; flex-direction: column; gap: 14px; }
    .ft-logo { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; color: ${text}; }
    .ft-tagline { font-size: 14px; color: ${textSec}; line-height: 1.65; max-width: 300px; margin: 0; }
    .ft-icons { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 4px; }
    .ft-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; background: ${isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)"}; color: ${textSec}; text-decoration: none; transition: all 0.2s ease; flex-shrink: 0; }
    .ft-icon:hover { color: ${accent}; background: ${isLight ? accent + "12" : accent + "20"}; transform: translateY(-2px); }
    .ft-icon svg { display: block; }
    .ft-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .ft-col { display: flex; flex-direction: column; gap: 10px; }
    .ft-col-head { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: ${isLight ? "#334155" : text}; margin-bottom: 6px; }
    .ft-link { font-size: 14px; color: ${textSec}; text-decoration: none; cursor: pointer; transition: color 0.15s; line-height: 1.5; }
    .ft-link:hover { color: ${accent}; }
    .ft-link-accent { color: ${accent}; font-weight: 600; }
    .ft-link-accent:hover { opacity: 0.8; }
    .ft-muted { cursor: default; }
    .ft-muted:hover { color: ${textSec}; }
    .ft-div { height: 1px; background: ${border}; }
    .ft-bottom { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 24px; }
    .ft-copy { font-size: 13px; color: ${textSec}; }
    ${templateCSS}
    @media (max-width: 768px) {
      .grid-2, .grid-3 { grid-template-columns: 1fr; }
      .nav-links { gap: 16px; }
      .nav-links .btn-primary { display: none; }
      .section { padding: 60px 20px; }
      .ft-top { grid-template-columns: 1fr; gap: 32px; }
      .ft-columns { grid-template-columns: 1fr 1fr; }
      .ft-bottom { flex-direction: column; gap: 12px; text-align: center; }
    }
    @media (max-width: 480px) {
      .nav-links { gap: 10px; }
      .nav-links a { font-size: 11px; }
      .ft-columns { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <nav class="nav">
    <div class="nav-inner">
      <a data-nav="home" style="font-weight:800;font-size:18px;letter-spacing:-0.02em;cursor:pointer;text-decoration:none;color:${text};font-family:${headFont}">${name}</a>
      <div class="nav-links">
        <a data-nav="home" class="active">Home</a>
        <a data-nav="services">Services</a>
        <a data-nav="pricing">Pricing</a>
        <a data-nav="about">About</a>
        <a data-nav="contact">Contact</a>
        <span class="btn-primary" data-nav="contact" style="padding:8px 20px;font-size:13px">${ctaText}</span>
      </div>
    </div>
  </nav>

  <div id="page-home" class="page active">${homePage}</div>
  <div id="page-services" class="page">${servicesPage}</div>
  <div id="page-pricing" class="page">${pricingPage}</div>
  <div id="page-about" class="page">${aboutPage}</div>
  <div id="page-contact" class="page">${contactPage}</div>

  ${footerHtml}

  <script>
    function navigate(page) {
      document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
      var target = document.getElementById('page-' + page);
      if (target) target.classList.add('active');
      document.querySelectorAll('.nav-links a[data-nav]').forEach(function(a) {
        a.classList.toggle('active', a.getAttribute('data-nav') === page);
      });
      window.scrollTo(0, 0);
    }
    document.addEventListener('click', function(e) {
      var el = e.target.closest('[data-nav]');
      if (el) { navigate(el.getAttribute('data-nav')); e.preventDefault(); return; }
      var link = e.target.closest('a');
      if (link && !link.getAttribute('href')) { e.preventDefault(); }
    }, true);
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

  // ─── Persist chats to Supabase (debounced) ────────────────────────
  useEffect(() => {
    if (!dataLoaded || !dbUserId) return;
    chats.forEach((chat) => {
      debouncedSave(`chat-${chat.id}`, () =>
        db.updateChat(chat.id, { title: chat.title, messages: chat.messages, pendingSurvey: chat.pendingSurvey })
      );
    });
  }, [chats, dataLoaded, dbUserId]);
  // Only fix activeChatId if it points to a deleted chat
  useEffect(() => { if (activeChatId && !chats.some((c) => c.id === activeChatId)) { const latest = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0]; if (latest?.id) { setActiveChatId(latest.id); router.replace(`/chat/${latest.id}`, { scroll: false }); } } }, [chats]);
  // Select chat from URL param on mount
  useEffect(() => { if (initialChatId && chats.some(c => c.id === initialChatId)) { setActiveChatId(initialChatId); } }, [initialChatId]);
  // Redirect bare /chat to most recent chat (only once on initial load)
  const didInitRedirect = useRef(false);
  useEffect(() => { if (didInitRedirect.current) return; if (!initialChatId && chats.length > 0 && dataLoaded) { didInitRedirect.current = true; const latest = [...chats].sort((a, b) => b.updatedAt - a.updatedAt)[0]; if (latest?.id) { setActiveChatId(latest.id); router.replace(`/chat/${latest.id}`, { scroll: false }); } } }, [initialChatId, chats.length, dataLoaded]);
  useEffect(() => { listEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [activeChat?.messages.length, isSending]);
  useEffect(() => { const el = textareaRef.current; if (!el) return; el.style.height = "42px"; if (input) { el.style.height = `${Math.max(42, Math.min(180, el.scrollHeight))}px`; } }, [input]);
  useEffect(() => { const el = textareaRef.current; if (el) { el.style.height = "42px"; } }, []);
  useEffect(() => { const h = () => { setOpenChatMenuId(null); setOpenMsgMenuId(null); setAttachMenuOpen(false); setNotifOpen(false); setNotifClosing(false); }; window.addEventListener("mousedown", h); return () => window.removeEventListener("mousedown", h); }, []);
  useEffect(() => { if (previewOpen) setSidebarOpen(false); }, [previewOpen]);

  // Derived: only treat preview as "showing" when data exists
  const showPreview = previewOpen && !!websiteData;

  // ─── Helper: push an assistant message into the active chat ────────
  function pushAssistantMsg(content: string) {
    const msg: Msg = { id: uid("msg"), role: "assistant", content, createdAt: Date.now() };
    setChats((p) => p.map((ch) => ch.id === activeChatId ? { ...ch, messages: [...ch.messages, msg], updatedAt: Date.now() } : ch));
  }

  // ─── DEPLOY: push live to Vercel ──────────────────────────────────
  async function handleDeploy() {
    if (!websiteData || isDeploying) return;
    setIsDeploying(true);
    pushAssistantMsg("Deploying your website...");

    try {
      const html = buildPreviewHtml(websiteData);
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: deployData?.projectId ? "redeploy" : "deploy",
          html,
          businessName: websiteData.branding?.name || "my-business",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        pushAssistantMsg(`Deployment failed: ${data.error || "Unknown error"}. Check your Vercel API token in environment variables.`);
        setIsDeploying(false);
        return;
      }

      const dd = { projectId: data.projectId, url: data.url, projectName: data.projectName || "" };
      saveDeployData(dd);

      pushAssistantMsg(
        `**Your site is live!** 🚀\n\n` +
        `**URL:** [${data.url}](${data.url})\n\n` +
        `To connect your own domain, type something like:\n` +
        `\`connect domain yourbusiness.com\``
      );
    } catch (e: any) {
      pushAssistantMsg(`Deployment error: ${e.message}`);
    }
    setIsDeploying(false);
  }

  // ─── ADD DOMAIN ───────────────────────────────────────────────────
  async function handleAddDomain(domain: string) {
    if (!deployData?.projectId) {
      pushAssistantMsg("Deploy your site first before adding a custom domain.");
      return;
    }

    pushAssistantMsg(`Connecting **${domain}** to your site...`);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add-domain", projectId: deployData.projectId, domain }),
      });

      const data = await res.json();

      if (data.verified) {
        const dd = { ...deployData, customDomain: domain, domainVerified: true };
        saveDeployData(dd);
        pushAssistantMsg(`**${domain}** is connected and live! Your site is ready at **https://${domain}**`);
        return;
      }

      // DNS setup needed
      const dd = { ...deployData, customDomain: domain, domainVerified: false };
      saveDeployData(dd);

      const dnsInstructions = (data.dnsRecords || []).map((r: any) =>
        `- **Type:** ${r.type} | **Name:** ${r.name} | **Value:** ${r.value}`
      ).join("\n");

      pushAssistantMsg(
        `**Domain added.** Now configure your DNS:\n\n` +
        `Go to your domain registrar (Squarespace, GoDaddy, Namecheap, Cloudflare, etc.) and add these DNS records:\n\n` +
        `${dnsInstructions}\n\n` +
        `DNS changes can take up to 48 hours to propagate. Once you've set them up, type:\n` +
        `\`verify domain\``
      );
    } catch (e: any) {
      pushAssistantMsg(`Domain setup error: ${e.message}`);
    }
  }

  // ─── VERIFY DOMAIN ────────────────────────────────────────────────
  async function handleVerifyDomain() {
    if (!deployData?.projectId || !deployData?.customDomain) {
      pushAssistantMsg("No domain to verify. Add a domain first with `connect domain yourdomain.com`");
      return;
    }

    pushAssistantMsg(`Checking DNS for **${deployData.customDomain}**...`);

    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify-domain", projectId: deployData.projectId, domain: deployData.customDomain }),
      });

      const data = await res.json();

      if (data.verified) {
        const dd = { ...deployData, domainVerified: true };
        saveDeployData(dd);
        pushAssistantMsg(`**${deployData.customDomain}** is verified and live! Your site is ready at **https://${deployData.customDomain}**`);
      } else {
        pushAssistantMsg(
          `**${deployData.customDomain}** is not verified yet.\n\n` +
          `${data.message}\n\n` +
          `Make sure your DNS records are set correctly and try again in a few minutes with \`verify domain\`.`
        );
      }
    } catch (e: any) {
      pushAssistantMsg(`Verification error: ${e.message}`);
    }
  }

  async function createNewChat() {
    const dbChat = await db.createChat("New business");
    const chatId = dbChat?.id || uid("chat");
    const c: Chat = { id: chatId, title: "New business", messages: [], updatedAt: Date.now(), pendingSurvey: false };
    setChats((p) => [c, ...p]); setActiveChatId(c.id); setOpenChatMenuId(null); setRenamingChatId(null); setExpandedBizId(null); setInput(""); setPreviewOpen(false); setShowSurvey(false); setSurveyData(null); setDraftAttachments((p) => { for (const a of p) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl); return []; }); if (isMobile) setSidebarOpen(false);
    router.push(`/chat/${chatId}`, { scroll: false });
  }
  async function deleteChat(id: string) { db.deleteChat(id); setChats((p) => p.filter((c) => c.id !== id)); setOpenChatMenuId(null); if (id === activeChatId) { const r = chats.filter((c) => c.id !== id); if (r[0]?.id) { setActiveChatId(r[0].id); router.replace(`/chat/${r[0].id}`, { scroll: false }); } else { setActiveChatId(""); router.replace("/chat", { scroll: false }); } } }
  function startRename(id: string) { setRenamingChatId(id); setRenameValue(chats.find((x) => x.id === id)?.title ?? ""); setOpenChatMenuId(null); }
  function commitRename() { if (!renamingChatId) return; setChats((p) => p.map((c) => (c.id === renamingChatId ? { ...c, title: renameValue.trim() || "New business" } : c))); setRenamingChatId(null); setRenameValue(""); }
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
          userId: clerkUser?.id,
          userEmail: clerkUser?.primaryEmailAddress?.emailAddress,
        }),
      });
      const raw = await res.text();
      let result: { reply?: string; previewUrl?: string; websiteData?: any; stripeCheckoutUrls?: any; stripeOnboardingUrl?: string; pendingSurveyData?: any } = {};
      try { result = JSON.parse(raw); } catch {}
      console.log("FULL API RESPONSE:", result);
      if (result.websiteData) {
        // Merge raw survey data into websiteData so templates always have it
        const enriched = {
          ...result.websiteData,
          survey: data,
          branding: {
            ...result.websiteData.branding,
            name: result.websiteData.branding?.name || data.businessName,
            primaryColor: result.websiteData.branding?.primaryColor || data.primaryColor,
            socialLinks: Object.fromEntries((data.socialLinks || []).filter((s) => s.url).map((s) => [s.platform.toLowerCase().replace("/", ""), s.url])),
          },
          // Carry through Stripe checkout URLs if the API returned them
          stripeCheckoutUrls: result.stripeCheckoutUrls || result.websiteData.stripeCheckoutUrls || undefined,
          stripeConnected: result.websiteData.stripeConnected || false,
        };
        saveWebsiteData(enriched);
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

    // ─── DEPLOY COMMANDS (intercepted before API call) ──────────────
    const lc = text.toLowerCase();

    if (/^(deploy|go live|publish|launch site|push live)$/i.test(lc)) {
      const userMsg: Msg = { id: uid("m"), role: "user", content: text, createdAt: Date.now() };
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
      setInput("");
      if (!websiteData) { pushAssistantMsg("Build your website first before deploying. Type **make me a website** to get started."); return; }
      handleDeploy();
      return;
    }

    const domainMatch = lc.match(/(?:connect|add|set|use)\s+(?:domain|custom domain)\s+(.+)/);
    if (domainMatch) {
      const domain = domainMatch[1].replace(/^https?:\/\//, "").replace(/\/.*$/, "").trim();
      const userMsg: Msg = { id: uid("m"), role: "user", content: text, createdAt: Date.now() };
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
      setInput("");
      handleAddDomain(domain);
      return;
    }

    if (/^verify\s+domain$/i.test(lc)) {
      const userMsg: Msg = { id: uid("m"), role: "user", content: text, createdAt: Date.now() };
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() } : c));
      setInput("");
      handleVerifyDomain();
      return;
    }
    // ─── END DEPLOY COMMANDS ────────────────────────────────────────

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
      // If this is a website rebuild, include existing survey data so the API has full context
      const requestBody: any = { messages: [...activeChat.messages, userMsg], userId: clerkUser?.id, userEmail: clerkUser?.primaryEmailAddress?.emailAddress };
      if (isBuild && surveyData) { requestBody.surveyData = surveyData; requestBody.action = "buildWebsite"; }
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal, body: JSON.stringify(requestBody) });
      const raw = await res.text(); let data: { reply?: string; previewUrl?: string; websiteData?: any; stripeCheckoutUrls?: any } = {}; try { data = JSON.parse(raw); } catch {}
      if (data.websiteData) {
        // Enrich with survey data if available
        const enriched = surveyData ? {
          ...data.websiteData,
          survey: surveyData,
          branding: { ...data.websiteData.branding, socialLinks: Object.fromEntries((surveyData.socialLinks || []).filter((s: any) => s.url).map((s: any) => [s.platform.toLowerCase().replace("/", ""), s.url])) },
          stripeCheckoutUrls: (data as any).stripeCheckoutUrls || data.websiteData.stripeCheckoutUrls || undefined,
          stripeConnected: !!((data as any).stripeCheckoutUrls || data.websiteData.stripeCheckoutUrls),
        } : data.websiteData;
        saveWebsiteData(enriched);
      }
      const reply = data.reply?.trim() || "Something went wrong. Please try again.";
      // Auto-title: if this is the first assistant reply, derive a title from the reply
      const shouldAutoTitle = activeChat.messages.length <= 1 || activeChat.title === "New business";
      const newTitle = shouldAutoTitle ? autoTitleFromReply(text, reply) : undefined;
      setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, ...(newTitle ? { title: newTitle } : {}), messages: [...c.messages, { id: uid("m"), role: "assistant" as const, content: reply, createdAt: Date.now(), previewUrl: data.previewUrl || undefined }], updatedAt: Date.now() } : c));
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

  // Wait for Clerk to initialize
  if (!authLoaded) return <div style={{ minHeight: "100vh", background: C.bg }} />;
  // Redirect to sign-in if not authenticated
  if (!isSignedIn) return <RedirectToSignIn />;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;font-family:'Inter',system-ui,-apple-system,sans-serif}
        body{margin:0;background:${C.bg};color:${C.text};overflow-x:hidden}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:3px}
        ::selection{background:${C.accent}40}
        textarea::placeholder{color:${C.textMuted}}
        /* ── Apple Liquid Glass ─────────────────────────────── */
        .z-glass,.glass-btn{position:relative;overflow:hidden;transition:all 500ms cubic-bezier(0.32,0.72,0,1)}
        .z-glass::before,.glass-btn::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.08) 12%,rgba(255,255,255,0.02) 40%,transparent 55%,rgba(255,255,255,0.03) 75%,rgba(255,255,255,0.12) 100%);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.4),inset 0 -0.5px 0 rgba(255,255,255,0.06),inset 0.5px 0 0 rgba(255,255,255,0.06),inset -0.5px 0 0 rgba(255,255,255,0.06);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none;z-index:0}
        .z-glass:hover::before,.glass-btn:hover::before{opacity:1}
        .z-glass::after,.glass-btn::after{content:'';position:absolute;top:-40%;left:6%;width:88%;height:75%;border-radius:50%;background:radial-gradient(ellipse at 36% 32%,rgba(255,255,255,0.14) 0%,rgba(255,255,255,0.04) 30%,transparent 65%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none;z-index:0}
        .z-glass:hover::after,.glass-btn:hover::after{opacity:1}
        .z-glass:hover,.glass-btn:hover{background:rgba(255,255,255,0.08)!important;backdrop-filter:brightness(1.2) saturate(1.5);-webkit-backdrop-filter:brightness(1.2) saturate(1.5);box-shadow:0 0 0 0.5px rgba(255,255,255,0.16),0 1px 3px rgba(0,0,0,0.10),0 4px 20px rgba(0,0,0,0.06),0 8px 40px rgba(0,0,0,0.04);transform:translateY(-0.5px)}
        .z-glass:active,.glass-btn:active{transform:scale(0.97) translateY(0);transition-duration:120ms}
        .z-glass>*,.glass-btn>*{position:relative;z-index:1}
        /* Accent variant */
        .z-glass-accent{position:relative;overflow:hidden;transition:all 500ms cubic-bezier(0.32,0.72,0,1)}
        .z-glass-accent::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(74,144,255,0.24) 0%,rgba(74,144,255,0.08) 20%,transparent 50%,rgba(74,144,255,0.04) 78%,rgba(74,144,255,0.16) 100%);box-shadow:inset 0 0.5px 0 rgba(74,144,255,0.4),inset 0 -0.5px 0 rgba(74,144,255,0.08);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-accent::after{content:'';position:absolute;top:-40%;left:6%;width:88%;height:75%;border-radius:50%;background:radial-gradient(ellipse at 36% 32%,rgba(74,144,255,0.16) 0%,rgba(74,144,255,0.04) 30%,transparent 65%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-accent:hover::before,.z-glass-accent:hover::after{opacity:1}
        .z-glass-accent:hover{background:rgba(74,144,255,0.12)!important;backdrop-filter:brightness(1.15) saturate(1.5);-webkit-backdrop-filter:brightness(1.15) saturate(1.5);box-shadow:0 0 0 0.5px rgba(74,144,255,0.22),0 1px 3px rgba(74,144,255,0.08),0 4px 20px rgba(0,0,0,0.06),0 0 28px rgba(74,144,255,0.05);transform:translateY(-0.5px)}
        .z-glass-accent:active{transform:scale(0.97) translateY(0);transition-duration:120ms}
        /* Danger variant */
        .z-glass-danger{position:relative;overflow:hidden;transition:all 500ms cubic-bezier(0.32,0.72,0,1)}
        .z-glass-danger::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(239,68,68,0.22) 0%,rgba(239,68,68,0.06) 20%,transparent 50%,rgba(239,68,68,0.03) 78%,rgba(239,68,68,0.14) 100%);box-shadow:inset 0 0.5px 0 rgba(239,68,68,0.3),inset 0 -0.5px 0 rgba(239,68,68,0.06);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-danger::after{content:'';position:absolute;top:-40%;left:6%;width:88%;height:75%;border-radius:50%;background:radial-gradient(ellipse at 36% 32%,rgba(239,68,68,0.12) 0%,rgba(239,68,68,0.03) 30%,transparent 65%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-danger:hover::before,.z-glass-danger:hover::after{opacity:1}
        .z-glass-danger:hover{background:rgba(239,68,68,0.14)!important;backdrop-filter:brightness(1.1) saturate(1.4);-webkit-backdrop-filter:brightness(1.1) saturate(1.4);box-shadow:0 0 0 0.5px rgba(239,68,68,0.22),0 1px 3px rgba(239,68,68,0.08),0 4px 20px rgba(0,0,0,0.06),0 0 20px rgba(239,68,68,0.04);transform:translateY(-0.5px)}
        .z-glass-danger:active{transform:scale(0.97) translateY(0);transition-duration:120ms}
        /* Solid accent button liquid glass (Upgrade to Pro, Save goal) */
        .z-glass-solid{position:relative;overflow:hidden;transition:all 500ms cubic-bezier(0.32,0.72,0,1)}
        .z-glass-solid::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.28) 0%,rgba(255,255,255,0.10) 18%,transparent 50%,rgba(255,255,255,0.04) 78%,rgba(255,255,255,0.18) 100%);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.45),inset 0 -0.5px 0 rgba(255,255,255,0.08);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-solid::after{content:'';position:absolute;top:-40%;left:5%;width:90%;height:80%;border-radius:50%;background:radial-gradient(ellipse at 35% 30%,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.05) 32%,transparent 62%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .z-glass-solid:hover::before,.z-glass-solid:hover::after{opacity:1}
        .z-glass-solid:hover{transform:translateY(-1px);box-shadow:0 8px 36px rgba(74,144,255,0.38),inset 0 1px 0 rgba(255,255,255,0.18)}
        .z-glass-solid:active{transform:scale(0.97) translateY(0);transition-duration:120ms}
        .chat-row{position:relative;overflow:visible}
        .chat-row::before{content:'';position:absolute;inset:0;border-radius:8px;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.04) 25%,rgba(255,255,255,0.015) 50%,rgba(255,255,255,0.03) 75%,rgba(255,255,255,0.06) 100%);backdrop-filter:brightness(1.1) saturate(1.3);-webkit-backdrop-filter:brightness(1.1) saturate(1.3);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.2),0 0 0 0.5px rgba(255,255,255,0.06);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .chat-row:hover::before{opacity:1}
        .chat-row:hover .chat-dots{opacity:0.7!important}
        .chat-row:hover .chat-title{color:${C.text}!important}
        .msg-actions{display:flex;align-items:center;gap:2px;margin-top:6px;opacity:0.55;transition:opacity 400ms cubic-bezier(0.32,0.72,0,1)}
        .msg-row:hover .msg-actions{opacity:1}
        .user-row .msg-actions{opacity:0}
        .user-row:hover .msg-actions{opacity:1}
        .user-row .msg-act{color:rgba(255,255,255,0.55)}
        .msg-act{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;width:30px;height:28px;border-radius:12px;border:1px solid transparent;background:none;color:${C.textMuted};cursor:pointer;transition:all 500ms cubic-bezier(0.32,0.72,0,1);padding:0}
        .msg-act::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 18%,rgba(255,255,255,0.015) 45%,transparent 60%,rgba(255,255,255,0.025) 78%,rgba(255,255,255,0.09) 100%);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.35),inset 0 -0.5px 0 rgba(255,255,255,0.06);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .msg-act::after{content:'';position:absolute;top:-35%;left:8%;width:84%;height:70%;border-radius:50%;background:radial-gradient(ellipse at 38% 35%,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.035) 32%,transparent 68%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .msg-act:hover{background:rgba(255,255,255,0.065);border-color:rgba(255,255,255,0.1);backdrop-filter:brightness(1.15) saturate(1.4);-webkit-backdrop-filter:brightness(1.15) saturate(1.4);box-shadow:0 0 0 0.5px rgba(255,255,255,0.13),0 1px 2px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.06);color:${C.text};transform:translateY(-0.5px)}
        .msg-act:hover::before,.msg-act:hover::after{opacity:1}
        .msg-act:active{transform:scale(0.92) translateY(0);transition-duration:120ms}
        .msg-act svg{width:15px;height:15px}
        .user-time{font-size:11px;color:rgba(255,255,255,0.7);font-weight:500;letter-spacing:0.01em}
        .collapsed-avatar:hover .collapsed-reveal,.collapsed-reveal:hover{opacity:1!important;transform:translateX(0)!important;pointer-events:auto!important}
        .drag-handle{width:8px;cursor:col-resize;background:transparent;transition:all 500ms cubic-bezier(0.32,0.72,0,1);flex-shrink:0;position:relative;z-index:10;border-left:1px solid ${C.border}}
        .drag-handle:hover{background:rgba(74,144,255,0.06);backdrop-filter:brightness(1.1) saturate(1.2);-webkit-backdrop-filter:brightness(1.1) saturate(1.2)}
        .drag-handle:active{background:rgba(74,144,255,0.1)}
        .drag-handle::after{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:3px;height:48px;border-radius:3px;background:rgba(255,255,255,0.08);transition:all 500ms cubic-bezier(0.32,0.72,0,1)}
        .drag-handle:hover::after{background:${C.accent};box-shadow:0 0 8px ${C.accent}40;height:64px}
        /* Premium hamburger button */
        .burger-btn{width:36px;height:36px;position:relative;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;border-radius:10px;cursor:pointer;transition:all 500ms cubic-bezier(0.32,0.72,0,1);flex-shrink:0;overflow:hidden}
        .burger-btn::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 18%,rgba(255,255,255,0.015) 45%,transparent 60%,rgba(255,255,255,0.025) 78%,rgba(255,255,255,0.09) 100%);box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.35),inset 0 -0.5px 0 rgba(255,255,255,0.06);transition:opacity 500ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .burger-btn::after{content:'';position:absolute;top:-35%;left:8%;width:84%;height:70%;border-radius:50%;background:radial-gradient(ellipse at 38% 35%,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.035) 32%,transparent 68%);opacity:0;transition:opacity 600ms cubic-bezier(0.32,0.72,0,1);pointer-events:none}
        .burger-btn:hover{background:rgba(255,255,255,0.065);border-color:rgba(255,255,255,0.14);backdrop-filter:brightness(1.15) saturate(1.4);-webkit-backdrop-filter:brightness(1.15) saturate(1.4);box-shadow:0 0 0 0.5px rgba(255,255,255,0.13),0 1px 2px rgba(0,0,0,0.08),0 4px 16px rgba(0,0,0,0.06),0 0 24px rgba(74,144,255,0.03)}
        .burger-btn:hover::before,.burger-btn:hover::after{opacity:1}
        .burger-btn:active{transform:scale(0.92) translateY(0);transition-duration:120ms}
        .burger-line{position:absolute;height:1.5px;border-radius:1px;background:${C.textSec};transition:transform 0.5s cubic-bezier(0.32,0.72,0,1),opacity 0.4s ease,width 0.5s cubic-bezier(0.32,0.72,0,1),background 0.4s ease}
        .burger-btn:hover .burger-line{background:${C.text}}
        .burger-top{width:16px;transform:translateY(-5px)}
        .burger-mid{width:12px}
        .burger-bot{width:16px;transform:translateY(5px)}
        .burger-top.open{width:18px;transform:rotate(45deg)}
        .burger-mid.open{width:0;opacity:0}
        .burger-bot.open{width:18px;transform:rotate(-45deg)}
        /* ── Origin-zoom overlay animations ─────────────────── */
        @keyframes overlayZoomIn{from{opacity:0;transform:scale(0.35)}to{opacity:1;transform:scale(1)}}
        @keyframes overlayZoomOut{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.35)}}
        @keyframes backdropFadeIn{from{opacity:0}to{opacity:1}}
        @keyframes backdropFadeOut{from{opacity:1}to{opacity:0}}
        @keyframes dropdownZoomIn{from{opacity:0;transform:scale(0.6) translateY(-8px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes dropdownZoomOut{from{opacity:1;transform:scale(1) translateY(0)}to{opacity:0;transform:scale(0.6) translateY(-8px)}}
        @media(max-width:768px){
          .hide-mobile{display:none!important}
          .welcome-h1{font-size:28px!important}
          .welcome-grid{grid-template-columns:1fr!important;max-width:300px!important}
          .msg-actions{opacity:1}
          .user-actions{opacity:1}
        }
      `}</style>

      {/* HEADER */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, borderBottom: `1px solid ${C.border}`, background: "rgba(6,9,15,0.82)", backdropFilter: "blur(24px)" }}>
        <div style={{ maxWidth: 1800, margin: "0 auto", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={() => setSidebarOpen((v) => !v)} className="burger-btn" aria-label="Toggle sidebar">
              <span className={`burger-line burger-top ${sidebarOpen ? "open" : ""}`} />
              <span className={`burger-line burger-mid ${sidebarOpen ? "open" : ""}`} />
              <span className={`burger-line burger-bot ${sidebarOpen ? "open" : ""}`} />
            </button>
            <ZelrexWordmark size={16} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 8 }}>
            {websiteData && (
              <HBtn onClick={() => setPreviewOpen(!previewOpen)} style={{ padding: isMobile ? "5px 8px" : "5px 12px", borderRadius: 12, border: `1px solid ${previewOpen ? C.accent + "40" : C.border}`, background: previewOpen ? C.accentSoft : "transparent", color: previewOpen ? C.accent : C.textSec, fontSize: 12, fontWeight: 500, gap: 5 }}>
                <Ic n="preview" className="h-3.5 w-3.5" />{!isMobile && " Preview"}
              </HBtn>
            )}
            {websiteData && (
              <HBtn onClick={handleDeploy} style={{ padding: isMobile ? "5px 8px" : "5px 12px", borderRadius: 12, border: `1px solid ${deployData?.url ? "#10B98140" : C.border}`, background: deployData?.url ? "rgba(16,185,129,0.08)" : "transparent", color: deployData?.url ? "#10B981" : C.textSec, fontSize: 12, fontWeight: 500, gap: 5, opacity: isDeploying ? 0.5 : 1 }}>
                <Ic n="send" className="h-3.5 w-3.5" />{!isMobile && (isDeploying ? " Deploying..." : deployData?.url ? " Redeploy" : " Deploy")}
              </HBtn>
            )}
            {!isMobile && !isSignedIn && (
              <HBtn onClick={() => { window.location.href = "/sign-in"; }} style={{ padding: "5px 12px", borderRadius: 12, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 12, fontWeight: 500, gap: 5 }}>
                <Ic n="signin" className="h-3.5 w-3.5" /> Sign in
              </HBtn>
            )}

            {/* Notifications bell */}
            <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
              <HBtn onClick={openNotif} style={{ width: 38, height: 38, color: C.text, position: "relative" }}>
                <Ic n="bell" style={{ width: 18, height: 18 }} />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 999, background: "#EF4444", border: "2px solid #06090F" }} />
                )}
              </HBtn>
              {(notifOpen || notifClosing) && (
                <div style={{ position: "absolute", right: 0, top: 44, zIndex: 200, width: 300, borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(12,16,24,0.92)", backdropFilter: "blur(40px) saturate(1.6)", WebkitBackdropFilter: "blur(40px) saturate(1.6)", boxShadow: "0 20px 60px rgba(0,0,0,0.6), inset 0 0.5px 0 rgba(255,255,255,0.08)", overflow: "hidden", transformOrigin: "top right", animation: `${notifClosing ? "dropdownZoomOut" : "dropdownZoomIn"} 300ms cubic-bezier(0.32,0.72,0,1) forwards` }}>
                  <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>Notifications</span>
                    {notifications.length > 0 && <button onClick={() => { setNotifications(ns => ns.map(n => ({ ...n, read: true }))); db.markNotificationsRead(); }} style={{ background: "none", border: "none", color: C.accent, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>Mark all read</button>}
                  </div>
                  <div style={{ maxHeight: 280, overflowY: "auto" }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: "32px 16px", textAlign: "center" }}>
                        <Ic n="bell" style={{ width: 28, height: 28, color: C.textMuted, opacity: 0.4, margin: "0 auto 10px", display: "block" }} />
                        <div style={{ fontSize: 13, color: C.textMuted }}>No notifications yet</div>
                        <div style={{ fontSize: 11, color: C.textMuted, opacity: 0.6, marginTop: 4 }}>Zelrex will send updates about your business and goals here.</div>
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, background: n.read ? "transparent" : `${C.accent}08`, cursor: "pointer" }} onClick={() => setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, read: true } : x))}>
                          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{n.text}</div>
                          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 4 }}>{new Date(n.time).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <StatusBar phase={phase} businessName={businessName} sidebarOpen={sidebarOpen} isMobile={isMobile} userGoal={userGoal} onAddGoal={openGoalModal} />

      {/* LAYOUT: sidebar + chat + preview */}
      <div style={{ display: "flex", height: `calc(100vh - 81px)`, position: "relative" }}>

        {/* SIDEBAR BACKDROP (mobile only) */}
        {sidebarOpen && isMobile && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 19 }} />
        )}

        {/* SIDEBAR */}
        <aside style={{ width: sidebarOpen ? 260 : 0, minWidth: sidebarOpen ? 260 : 0, borderRight: sidebarOpen ? `1px solid ${C.border}` : "none", background: C.bg, transition: "all 500ms cubic-bezier(0.32,0.72,0,1)", overflow: "hidden", display: "flex", flexDirection: "column", position: isMobile ? "fixed" : "absolute", top: isMobile ? 0 : -81, bottom: 0, left: 0, paddingTop: isMobile ? 60 : 81, zIndex: 20 }}>
          <div style={{ padding: 10, opacity: sidebarOpen ? 1 : 0, transition: "opacity 400ms cubic-bezier(0.32,0.72,0,1)" }}>
            {/* New Business button */}
            <button onClick={createNewChat} type="button" className="z-glass" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px 0", borderRadius: 12, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <Ic n="briefcase" className="h-4 w-4" /> New Business
            </button>

            {/* Tool buttons */}
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 2 }}>
              <button type="button" className="z-glass" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: "none", background: "none", color: C.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                <Ic n="calendar" style={{ width: 15, height: 15, color: "#10B981" }} /> Weekly Summaries
              </button>
              <button type="button" className="z-glass" style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: "none", background: "none", color: C.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                <Ic n="analytics" style={{ width: 15, height: 15, color: "#8B5CF6" }} /> Business Analytics
              </button>
              <button type="button" className="z-glass" onClick={openGoalModal} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 12, border: "none", background: "none", color: userGoal ? C.accent : C.textSec, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                <Ic n="goal" style={{ width: 15, height: 15, color: userGoal ? C.accent : "#F59E0B" }} /> {userGoal ? "My Goal" : "Set Goal"}
              </button>
            </div>

            {/* Search */}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)" }}>
              <Ic n="search" className="h-3.5 w-3.5" style={{ color: C.textMuted }} />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search businesses..." style={{ flex: 1, background: "none", border: "none", outline: "none", color: C.text, fontSize: 12 }} />
              {searchQuery && <HBtn onClick={() => setSearchQuery("")} style={{ width: 20, height: 20, color: C.textMuted }}><Ic n="close" className="h-3 w-3" /></HBtn>}
            </div>
          </div>
          <div style={{ height: 1, margin: "0 10px", background: C.border }} />
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
            <div style={{ padding: "4px 8px 6px", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: C.textMuted }}>Your Businesses</div>
            {filteredChats.map((c) => {
              const isA = c.id === activeChatId; const isR = renamingChatId === c.id; const isExp = expandedBizId === c.id;
              const bizPhase = detectPhase(c.messages); const bizName = getBusinessName(c.messages);
              const createdDate = c.id.includes("_") ? new Date(parseInt(c.id.split("_").pop() || "0", 16)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
              return (
                <div key={c.id} style={{ marginBottom: 2, borderRadius: 10, overflow: "hidden", border: isA ? `1px solid rgba(255,255,255,0.06)` : "1px solid transparent", background: isA ? "rgba(255,255,255,0.04)" : "transparent", transition: "all 500ms cubic-bezier(0.32,0.72,0,1)" }}>
                  {/* Business row */}
                  <div className="chat-row" style={{ display: "flex", alignItems: "center", padding: "7px 8px", cursor: "pointer", transition: "background 500ms cubic-bezier(0.32,0.72,0,1)" }}
                    onMouseEnter={(e) => { if (!isA) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                    <button onClick={() => { setActiveChatId(c.id); router.push(`/chat/${c.id}`, { scroll: false }); if (isMobile) setSidebarOpen(false); }} type="button" style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", color: C.text, padding: 0, overflow: "hidden" }}>
                      {isR ? (
                        <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setRenamingChatId(null); setRenameValue(""); } }} onBlur={commitRename} autoFocus style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: `1px solid ${C.border}`, borderRadius: 6, padding: "3px 8px", color: C.text, fontSize: 12, outline: "none" }} />
                      ) : (
                        <div className="chat-title" style={{ fontSize: 12, color: isA ? C.text : C.textSec, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170, fontWeight: isA ? 600 : 400, transition: "color 500ms cubic-bezier(0.32,0.72,0,1)" }}>{c.title || "New business"}</div>
                      )}
                    </button>
                    {!isR && (
                      <HBtn onMouseDown={(e: React.MouseEvent) => e.stopPropagation()} onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpandedBizId(isExp ? null : c.id); }} className="chat-dots" style={{ width: 26, height: 26, color: C.textMuted, opacity: isA || isExp ? 0.8 : 0, marginLeft: 2, transition: "all 500ms cubic-bezier(0.32,0.72,0,1)" }}>
                        <Ic n="chevdown" style={{ width: 14, height: 14, transition: "transform 200ms", transform: isExp ? "rotate(180deg)" : "rotate(0deg)" }} />
                      </HBtn>
                    )}
                  </div>
                  {/* Expanded details */}
                  {isExp && (
                    <div style={{ padding: "2px 10px 10px", animation: "bizExpand 200ms ease" }}>
                      <style>{`@keyframes bizExpand{from{opacity:0;max-height:0;transform:translateY(-4px)}to{opacity:1;max-height:200px;transform:translateY(0)}}`}</style>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                        <div style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.04)` }}>
                          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Created</div>
                          <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{createdDate}</div>
                        </div>
                        <div style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.04)` }}>
                          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type</div>
                          <div style={{ fontSize: 11, color: C.textSec, marginTop: 2 }}>{bizName ? "Freelance" : "—"}</div>
                        </div>
                        <div style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.04)` }}>
                          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Website</div>
                          <div style={{ fontSize: 11, color: bizPhase === "building" || bizPhase === "live" ? "#10B981" : C.textSec, marginTop: 2 }}>{bizPhase === "live" ? "Live" : bizPhase === "building" ? "Building" : "Not started"}</div>
                        </div>
                        <div style={{ padding: "6px 8px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid rgba(255,255,255,0.04)` }}>
                          <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>Progress</div>
                          <div style={{ fontSize: 11, color: bizPhase === "live" ? "#10B981" : bizPhase === "evaluating" ? "#F59E0B" : C.textSec, marginTop: 2, textTransform: "capitalize" }}>{bizPhase}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => startRename(c.id)} type="button" className="z-glass" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px", borderRadius: 12, border: "none", background: "rgba(255,255,255,0.03)", color: C.textSec, fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                          <Ic n="pencil" style={{ width: 11, height: 11 }} /> Rename
                        </button>
                        <button onClick={() => { deleteChat(c.id); setExpandedBizId(null); }} type="button" className="z-glass-danger" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "6px", borderRadius: 12, border: "none", background: "rgba(239,68,68,0.06)", color: "#EF4444", fontSize: 11, fontWeight: 500, cursor: "pointer" }}>
                          <Ic n="trash" style={{ width: 11, height: 11 }} /> Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: 8 }}>
            {isSignedIn && clerkUser ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, cursor: "default", transition: "all 500ms cubic-bezier(0.32,0.72,0,1)", position: "relative" }}>
                <img src={clerkUser.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 999, border: `1.5px solid ${C.border}`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, opacity: sidebarOpen ? 1 : 0, transition: "opacity 400ms cubic-bezier(0.32,0.72,0,1)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{clerkUser.fullName || clerkUser.firstName || "User"}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: C.accent, letterSpacing: "0.03em", marginTop: 1 }}>Free plan</div>
                </div>
                <button type="button" onClick={openSettings} title="Settings" className="z-glass" style={{ width: 32, height: 32, borderRadius: 12, border: "none", background: "none", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: sidebarOpen ? 1 : 0 }}>
                  <Ic n="settings" style={{ width: 20, height: 20 }} />
                </button>
              </div>
            ) : (
              <button type="button" className="z-glass" style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 12, background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer" }}
                onClick={() => { window.location.href = "/sign-in"; }}>
                <Ic n="signin" className="h-4 w-4" /> Sign in
              </button>
            )}
          </div>
        </aside>

        {/* Collapsed profile avatar (visible when sidebar is closed) */}
        {!sidebarOpen && !isMobile && isSignedIn && clerkUser && (
          <div className="collapsed-avatar-wrap" style={{ position: "fixed", bottom: 20, left: 10, zIndex: 21 }}>
            <div className="collapsed-avatar" style={{ position: "relative", cursor: "pointer" }}>
              <img src={clerkUser.imageUrl} alt="" style={{ width: 32, height: 32, borderRadius: 999, border: `1.5px solid ${C.border}`, display: "block" }} />
              <div className="collapsed-reveal" style={{ position: "absolute", left: 38, top: -4, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 10, background: "rgba(10,15,26,0.92)", border: `1px solid ${C.border}`, backdropFilter: "blur(32px) saturate(1.6)", WebkitBackdropFilter: "blur(32px) saturate(1.6)", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap", opacity: 0, transform: "translateX(-6px)", transition: "all 500ms cubic-bezier(0.32,0.72,0,1)", pointerEvents: "none" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{clerkUser.fullName || clerkUser.firstName || "User"}</div>
                  <div style={{ fontSize: 10, fontWeight: 500, color: C.accent, marginTop: 1 }}>Free plan</div>
                </div>
                <button type="button" onClick={openSettings} title="Settings" className="z-glass" style={{ width: 30, height: 30, borderRadius: 12, border: "none", background: "none", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic n="settings" style={{ width: 18, height: 18 }} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CHAT */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 280, transition: dragRef.current ? "none" : "all 500ms cubic-bezier(0.32,0.72,0,1)", marginLeft: (!isMobile && sidebarOpen) ? 260 : 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: showPreview ? "16px 12px" : "16px 16px" }}>
            <div style={{ maxWidth: showPreview ? "100%" : 820, margin: "0 auto" }}>
              {!hasMessages ? (
                <WelcomeScreen onAction={sendViaCard} />
              ) : (
                <div style={{ paddingBottom: 140 }}>
                  {activeChat?.messages.map((m) => {
                    const isUser = m.role === "user";
                    return (
                      <div key={m.id} className={isUser ? "user-row" : "msg-row"} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16, gap: 10 }}>
                        {!isUser && <div style={{ width: 26, height: 26, flexShrink: 0, marginTop: 2 }}><ZelrexZIcon size={26} /></div>}
                        <div style={{ maxWidth: showPreview ? "100%" : 700 }}>
                          <div style={{
                            ...(isUser ? { display: "inline-block", padding: "8px 14px", borderRadius: 16, background: C.userBubble, border: `1px solid ${C.userBorder}` } : { padding: "4px 0 4px 14px", borderLeft: `2px solid ${C.accent}18` }),
                          }}>
                            {m.role === "assistant" ? (
                              <>
                                {shouldAnimate(m, activeChat) && !animatedIds.includes(m.id) ? (
                                  <Typewriter text={m.content} speed={6} onFinish={() => setAnimatedIds((p) => p.includes(m.id) ? p : [...p, m.id])} />
                                ) : ( <div>{formatMessage(m.content)}</div> )}
                                {m.previewUrl && websiteData && <div style={{ marginTop: 14 }}><ActionPill label="Open website preview" onClick={() => setPreviewOpen(true)} /></div>}
                                <div className="msg-actions">
                                  <button className="msg-act" title="Copy" onClick={() => { navigator.clipboard.writeText(m.content); setCopiedMsgId(m.id); setTimeout(() => setCopiedMsgId(null), 1200); }}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                  </button>
                                  <button className="msg-act" title="Good response" onClick={() => {}}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88L14 10h5.83a2 2 0 011.92 2.56l-2.33 8A2 2 0 0117.5 22H4a2 2 0 01-2-2v-8a2 2 0 012-2h2.76a2 2 0 001.79-1.11L12 2a3.13 3.13 0 013 3.88z"/></svg>
                                  </button>
                                  <button className="msg-act" title="Bad response" onClick={() => {}}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2"/><path d="M9 18.12L10 14H4.17a2 2 0 01-1.92-2.56l2.33-8A2 2 0 016.5 2H20a2 2 0 012 2v8a2 2 0 01-2 2h-2.76a2 2 0 00-1.79 1.11L12 22a3.13 3.13 0 01-3-3.88z"/></svg>
                                  </button>
                                  <button className="msg-act" title="Retry" onClick={() => retryLast()}>
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                                  </button>
                                </div>
                                {copiedMsgId === m.id && <div style={{ fontSize: 11, color: C.accent, marginTop: 2 }}>Copied</div>}
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: 15, lineHeight: 1.7 }}>{m.content}</div>
                              </>
                            )}
                          </div>
                          {/* User message: copy button + timestamp on hover */}
                          {isUser && (
                            <div className="msg-actions" style={{ justifyContent: "flex-end" }}>
                              <span className="user-time" style={{ marginRight: 4 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                              <button className="msg-act" title="Copy" onClick={() => { navigator.clipboard.writeText(m.content); setCopiedMsgId(m.id); setTimeout(() => setCopiedMsgId(null), 1200); }}>
                                <Ic n="copy" />
                              </button>
                              {copiedMsgId === m.id && <span style={{ fontSize: 10, color: C.accent, fontWeight: 500, marginLeft: 4 }}>Copied</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {isSending && <div style={{ display: "flex", gap: 6, marginBottom: 16, alignItems: "center" }}><ZelrexThinking stage={buildStage} /></div>}
                  <div ref={listEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* INPUT */}
          <div style={{ padding: isMobile ? "6px 8px 10px" : (showPreview ? "8px 12px 14px" : "8px 16px 18px"), position: "relative" }}>
            {!surveyData && !showSurvey && activeChat?.pendingSurvey && (
              <div style={{ maxWidth: showPreview ? "100%" : 820, margin: "0 auto 10px", borderRadius: 12, border: `1px solid ${C.border}`, background: C.bg, padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, position: "relative", zIndex: 2 }}>
                <div style={{ fontSize: 12, color: C.textSec }}>Survey paused. Continue to finish your website build.</div>
                <button type="button" onClick={() => { setSurveyDismissed(false); setShowSurvey(true); }} className="z-glass-accent" style={{ padding: "6px 12px", borderRadius: 12, border: `1px solid ${C.accent}55`, background: `${C.accent}18`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Continue survey</button>
              </div>
            )}
            <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 24, background: "linear-gradient(to bottom, rgba(6,9,15,0), rgba(6,9,15,0.9))", pointerEvents: "none" }} />
            <div className={inputFocused ? "input-box input-focus-glow" : "input-box"} style={{ position: "relative", zIndex: 1, maxWidth: showPreview ? "100%" : 820, margin: "0 auto", borderRadius: draftAttachments.length ? 18 : 999, border: `1px solid ${inputFocused ? C.borderHover : C.border}`, background: C.bgInput, boxShadow: `0 4px 24px rgba(0,0,0,0.3)`, transition: "border-color 500ms cubic-bezier(0.32,0.72,0,1), box-shadow 500ms cubic-bezier(0.32,0.72,0,1)" }}>
              <style>{`
                .input-focus-glow {
                  animation: inputRingIn 600ms cubic-bezier(0.32,0.72,0,1) forwards, inputRingOut 600ms cubic-bezier(0.32,0.72,0,1) 500ms forwards;
                }
                @keyframes inputRingIn {
                  0% { border-color: rgba(255,255,255,0.07); box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 0px rgba(74,144,255,0), 0 0 0px rgba(74,144,255,0); }
                  60% { border-color: #5BA0FF; box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 3px rgba(74,144,255,0.35), 0 0 32px rgba(74,144,255,0.15); }
                  100% { border-color: #4A90FF; box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 2.5px rgba(74,144,255,0.25), 0 0 20px rgba(74,144,255,0.10); }
                }
                @keyframes inputRingOut {
                  0% { border-color: #4A90FF; box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 2.5px rgba(74,144,255,0.25), 0 0 20px rgba(74,144,255,0.10); }
                  100% { border-color: rgba(255,255,255,0.14); box-shadow: 0 4px 24px rgba(0,0,0,0.3), 0 0 0 0px rgba(74,144,255,0), 0 0 0px rgba(74,144,255,0); }
                }
              `}</style>
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
              <div style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
                <div style={{ position: "relative" }}>
                  <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />
                  <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.currentTarget.value = ""; }} />
                  <HBtn onClick={() => setAttachMenuOpen((v) => !v)} style={{ width: 38, height: 38, color: C.textMuted }}><Ic n="plus" style={{ width: 20, height: 20 }} /></HBtn>
                  {attachMenuOpen && (
                    <div onMouseDown={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, bottom: 42, zIndex: 50, width: 140, borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgElevated, boxShadow: "0 12px 36px rgba(0,0,0,0.5)", overflow: "hidden" }}>
                      <button type="button" onClick={() => { setAttachMenuOpen(false); imageInputRef.current?.click(); }} className="z-glass" style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", textAlign: "left" }}>Add images</button>
                      <button type="button" onClick={() => { setAttachMenuOpen(false); fileInputRef.current?.click(); }} className="z-glass" style={{ width: "100%", padding: "8px 12px", background: "none", border: "none", color: C.textSec, fontSize: 12, cursor: "pointer", textAlign: "left" }}>Add files</button>
                    </div>
                  )}
                </div>
                <textarea ref={textareaRef} value={input} onChange={(e) => setInput(e.target.value)} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} onPaste={onPaste} placeholder="Ask anything"
                  style={{ flex: 1, maxHeight: 200, minHeight: 42, height: 42, resize: "none", background: "none", border: "none", outline: "none", padding: "10px 8px", fontSize: 14, lineHeight: 1.5, color: C.text, boxSizing: "border-box" }} />
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

        {/* DRAG HANDLE + PREVIEW PANEL */}
        {previewOpen && websiteData && !isMobile && (
          <div className="drag-handle" onMouseDown={(e) => {
            e.preventDefault();
            const container = e.currentTarget.parentElement;
            if (!container) return;
            const startX = e.clientX;
            const previewEl = e.currentTarget.nextElementSibling as HTMLElement;
            const startW = previewEl?.offsetWidth || container.offsetWidth * 0.6;
            dragRef.current = { startX, startW };
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
            const onMove = (ev: MouseEvent) => {
              if (!dragRef.current) return;
              const diff = dragRef.current.startX - ev.clientX;
              const containerW = container.offsetWidth;
              const newW = Math.max(320, Math.min(containerW - 320, dragRef.current.startW + diff));
              setPreviewWidth(newW);
            };
            const onUp = () => {
              dragRef.current = null;
              document.body.style.cursor = "";
              document.body.style.userSelect = "";
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }} />
        )}
        {previewOpen && websiteData && (
          <div style={{ width: isMobile ? undefined : (previewWidth || "60%"), flexShrink: 0, background: C.bg, display: "flex", flexDirection: "column", minWidth: 0, transition: dragRef.current ? "none" : "width 300ms ease", ...(isMobile ? { position: "fixed", inset: 0, zIndex: 50 } : {}) }}>
            <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 600, color: C.textSec }}>
              <span>Website Preview — {websiteData.branding?.name || "Preview"}</span>
              <HBtn onClick={() => { setPreviewOpen(false); setPreviewWidth(0); }} style={{ width: 28, height: 28, color: C.textMuted }}><Ic n="close" className="h-4 w-4" /></HBtn>
            </div>
            <PreviewFrame html={buildPreviewHtml(websiteData)} />
          </div>
        )}

        {showSurvey && (
          <WebsiteSurvey
            onComplete={handleSurveyComplete}
            onClose={() => { setShowSurvey(false); setSurveyDismissed(true); if (activeChat?.id) { setChats((p) => p.map((c) => c.id === activeChat.id ? { ...c, pendingSurvey: true } : c)); } }}
            onAskZelrex={(question: string) => {
              setShowSurvey(false);
              setInput(question);
            }}
          />
        )}

        {/* GOAL MODAL */}
        {/* ─── FULL-SCREEN SETTINGS ─────────────────────────── */}
        {(settingsOpen || settingsClosing) && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9500, display: "flex", background: "rgba(3,5,8,0.95)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", transformOrigin: settingsOriginRef.current ? `${settingsOriginRef.current.x}px ${settingsOriginRef.current.y}px` : "center center", animation: `${settingsClosing ? "overlayZoomOut" : "overlayZoomIn"} 420ms cubic-bezier(0.32,0.72,0,1) forwards`, pointerEvents: settingsClosing ? "none" : undefined }}>
            <style>{`
              .stg-tab { position: relative; overflow: hidden; display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-radius: 10px; border: none; background: none; color: ${C.textSec}; font-size: 13px; font-weight: 500; cursor: pointer; width: 100%; text-align: left; transition: all 500ms cubic-bezier(0.32,0.72,0,1); }
              .stg-tab::before { content:''; position:absolute; inset:0; border-radius:inherit; opacity:0; background:linear-gradient(168deg,rgba(255,255,255,0.18) 0%,rgba(255,255,255,0.06) 18%,rgba(255,255,255,0.015) 45%,transparent 60%,rgba(255,255,255,0.025) 78%,rgba(255,255,255,0.09) 100%); box-shadow:inset 0 0.5px 0 rgba(255,255,255,0.3),inset 0 -0.5px 0 rgba(255,255,255,0.05); transition:opacity 500ms cubic-bezier(0.32,0.72,0,1); pointer-events:none; }
              .stg-tab::after { content:''; position:absolute; top:-35%; left:8%; width:84%; height:70%; border-radius:50%; background:radial-gradient(ellipse at 38% 35%,rgba(255,255,255,0.10) 0%,rgba(255,255,255,0.035) 32%,transparent 68%); opacity:0; transition:opacity 600ms cubic-bezier(0.32,0.72,0,1); pointer-events:none; }
              .stg-tab:hover { background: rgba(255,255,255,0.065); backdrop-filter: brightness(1.15) saturate(1.4); -webkit-backdrop-filter: brightness(1.15) saturate(1.4); box-shadow: 0 0 0 0.5px rgba(255,255,255,0.13), 0 1px 2px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06); }
              .stg-tab:hover::before, .stg-tab:hover::after { opacity: 1; }
              .stg-tab:active { transform: scale(0.98); transition-duration: 120ms; }
              .stg-tab-active { background: rgba(74,144,255,0.08) !important; color: ${C.accent} !important; font-weight: 600; box-shadow: inset 0 0.5px 0 rgba(74,144,255,0.12) !important; }
              .stg-input { width: 100%; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.025); color: ${C.text}; font-size: 14px; font-family: inherit; outline: none; transition: all 250ms; }
              .stg-input:focus { border-color: rgba(74,144,255,0.4); box-shadow: 0 0 0 3px rgba(74,144,255,0.08), 0 0 16px rgba(74,144,255,0.05); }
              .stg-toggle { position: relative; width: 40px; height: 22px; border-radius: 11px; border: none; cursor: pointer; transition: all 500ms cubic-bezier(0.32,0.72,0,1); flex-shrink: 0; }
              .stg-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 18px; height: 18px; border-radius: 9px; background: white; transition: all 500ms cubic-bezier(0.32,0.72,0,1); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
              .stg-toggle.stg-on { background: ${C.accent}; }
              .stg-toggle.stg-on::after { transform: translateX(18px); }
              .stg-toggle.stg-off { background: rgba(255,255,255,0.1); }
              .stg-toggle:active { transform: scale(0.92); transition-duration: 120ms; }
              .stg-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
              .stg-row:last-child { border-bottom: none; }
              .stg-section { margin-bottom: 32px; }
              .stg-section-title { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.25); letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 16px; }
              .stg-card { padding: 18px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02); }
            `}</style>

            {/* Left sidebar */}
            <div style={{ width: 260, borderRight: `1px solid rgba(255,255,255,0.05)`, display: "flex", flexDirection: "column", padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
                <ZelrexZIcon size={20} />
                <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Settings</span>
              </div>
              <nav style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                <button className={`stg-tab ${settingsTab === "account" ? "stg-tab-active" : ""}`} onClick={() => setSettingsTab("account")}>
                  <Ic n="user" style={{ width: 16, height: 16 }} /> Account
                </button>
                <button className={`stg-tab ${settingsTab === "subscription" ? "stg-tab-active" : ""}`} onClick={() => setSettingsTab("subscription")}>
                  <Ic n="credit" style={{ width: 16, height: 16 }} /> Subscription
                </button>
                <button className={`stg-tab ${settingsTab === "features" ? "stg-tab-active" : ""}`} onClick={() => setSettingsTab("features")}>
                  <Ic n="bolt" style={{ width: 16, height: 16 }} /> Zelrex Features
                </button>
                <button className={`stg-tab ${settingsTab === "notifications" ? "stg-tab-active" : ""}`} onClick={() => setSettingsTab("notifications")}>
                  <Ic n="bell" style={{ width: 16, height: 16 }} /> Notifications
                </button>
              </nav>
              {/* Settings footer */}
              <div style={{ paddingTop: 16, borderTop: `1px solid rgba(255,255,255,0.04)` }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.15)" }}>Zelrex v1.0 · Claude Opus 4.6</span>
              </div>
            </div>

            {/* Right content */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Top bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 28px", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                  {settingsTab === "account" && "Account"}
                  {settingsTab === "subscription" && "Subscription & Billing"}
                  {settingsTab === "features" && "Zelrex Features"}
                  {settingsTab === "notifications" && "Notifications"}
                </div>
                <button onClick={closeSettings} className="z-glass" style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.03)", color: C.textMuted, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Ic n="close" style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 40px", maxWidth: 640 }}>

                {/* ─── ACCOUNT TAB ─── */}
                {settingsTab === "account" && (<>
                  <div className="stg-section">
                    <div className="stg-section-title">Profile</div>
                    <div className="stg-card" style={{ display: "flex", alignItems: "center", gap: 18 }}>
                      <img src={clerkUser?.imageUrl} alt="" style={{ width: 64, height: 64, borderRadius: 16, border: `2px solid rgba(255,255,255,0.06)` }} />
                      <div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{clerkUser?.fullName || clerkUser?.firstName || "User"}</div>
                        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3 }}>{clerkUser?.primaryEmailAddress?.emailAddress || ""}</div>
                        <div style={{ marginTop: 6, display: "inline-block", padding: "3px 10px", borderRadius: 999, background: `${C.accent}12`, fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.04em" }}>FREE PLAN</div>
                      </div>
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Connected Accounts</div>
                    <div className="stg-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="globe" style={{ width: 16, height: 16, color: C.textSec }} /></div>
                        <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Stripe</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Accept payments on your website</div></div>
                      </div>
                      <button className="z-glass" style={{ padding: "7px 16px", borderRadius: 9, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.025)", color: C.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Connect</button>
                    </div>
                    <div className="stg-row">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 12, background: "rgba(255,255,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ic n="chart" style={{ width: 16, height: 16, color: C.textSec }} /></div>
                        <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Google Analytics</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Track your website visitors</div></div>
                      </div>
                      <button className="z-glass" style={{ padding: "7px 16px", borderRadius: 9, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.025)", color: C.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Connect</button>
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Keyboard Shortcuts</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[["New business","Ctrl+N"],["Send message","Enter"],["New line","Shift+Enter"],["Toggle sidebar","Ctrl+B"],["Focus input","Ctrl+K"],["Close modal","Esc"]].map(([a,k]) => (
                        <div key={a} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", fontSize: 12 }}>
                          <span style={{ color: C.textSec }}>{a}</span>
                          <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.05)", fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: "monospace" }}>{k}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title" style={{ color: "#EF4444" }}>Danger Zone</div>
                    <div className="stg-row"><div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Sign out</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Sign out of your Zelrex account</div></div>
                      <button onClick={() => { closeSettings(); signOut(); }} className="z-glass" style={{ padding: "7px 16px", borderRadius: 9, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.025)", color: C.textSec, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sign out</button>
                    </div>
                    <div className="stg-row" style={{ borderBottom: "none" }}><div><div style={{ fontSize: 13, fontWeight: 500, color: "#EF4444" }}>Delete account</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Permanently delete your account and all data</div></div>
                      <button className="z-glass-danger" style={{ padding: "7px 16px", borderRadius: 9, border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)", color: "#EF4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                </>)}

                {/* ─── SUBSCRIPTION TAB ─── */}
                {settingsTab === "subscription" && (<>
                  <div className="stg-section">
                    <div className="stg-section-title">Current Plan</div>
                    <div className="stg-card" style={{ position: "relative", overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Free</div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Basic access to Zelrex</div></div>
                        <div style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", fontSize: 12, fontWeight: 600, color: C.textSec }}>Current</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 16 }}>
                        {["3 businesses", "Basic AI responses", "1 website deploy", "Community support"].map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}><span style={{ color: C.textMuted }}>✓</span> {f}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Upgrade</div>
                    <div className="stg-card" style={{ border: `1px solid ${C.accent}25`, position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${C.accent}, transparent)` }} />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                        <div><div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>Pro <span style={{ fontSize: 14, fontWeight: 500, color: C.textSec }}>$26/mo</span></div><div style={{ fontSize: 13, color: C.textMuted, marginTop: 2 }}>Everything you need to scale</div></div>
                        <div style={{ padding: "5px 12px", borderRadius: 999, background: `${C.accent}15`, fontSize: 12, fontWeight: 700, color: C.accent }}>RECOMMENDED</div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 18 }}>
                        {["Unlimited businesses", "Priority AI (Opus 4.6)", "Unlimited deploys", "Custom domains", "Weekly business reports", "Priority support", "Business analytics", "Stripe integration"].map(f => (
                          <div key={f} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textSec }}><span style={{ color: "#10B981" }}>✓</span> {f}</div>
                        ))}
                      </div>
                      <button className="z-glass-solid" style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: C.accent, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", boxShadow: `0 6px 24px ${C.accent}30, inset 0 1px 0 rgba(255,255,255,0.1)` }}>
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Billing History</div>
                    <div style={{ textAlign: "center", padding: "32px 0" }}>
                      <Ic n="credit" style={{ width: 28, height: 28, color: C.textMuted, opacity: 0.4, margin: "0 auto 10px", display: "block" }} />
                      <div style={{ fontSize: 13, color: C.textMuted }}>No billing history yet</div>
                      <div style={{ fontSize: 11, color: C.textMuted, opacity: 0.5, marginTop: 4 }}>Invoices will appear here after your first payment</div>
                    </div>
                  </div>
                </>)}

                {/* ─── FEATURES TAB ─── */}
                {settingsTab === "features" && (<>
                  <div className="stg-section">
                    <div className="stg-section-title">AI Configuration</div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Response Style</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>How Zelrex communicates with you</div></div>
                      <select style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.025)", color: C.text, fontSize: 12, fontWeight: 500, cursor: "pointer", outline: "none" }}>
                        <option value="direct">Direct & concise</option><option value="detailed">Detailed</option><option value="coaching">Coaching</option>
                      </select>
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Revenue-First Mode</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Prioritize revenue in all suggestions</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Idea Rejection Engine</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Actively reject weak business ideas</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Proactive Suggestions</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Zelrex suggests improvements between chats</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Website Builder</div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Auto-Deploy</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Automatically deploy websites after build</div></div>
                      <button className="stg-toggle stg-off" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Preview Quality</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Resolution for website previews</div></div>
                      <select style={{ padding: "7px 12px", borderRadius: 9, border: `1px solid rgba(255,255,255,0.06)`, background: "rgba(255,255,255,0.025)", color: C.text, fontSize: 12, fontWeight: 500, cursor: "pointer", outline: "none" }}>
                        <option value="high">High (default)</option><option value="low">Low (faster)</option>
                      </select>
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">Business Copilot</div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Weekly Business Digest</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Email summary of business progress</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Market Monitoring</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Track market changes relevant to your business</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Sound Effects</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Play sounds for notifications and actions</div></div>
                      <button className="stg-toggle stg-off" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                  </div>
                </>)}

                {/* ─── NOTIFICATIONS TAB ─── */}
                {settingsTab === "notifications" && (<>
                  <div className="stg-section">
                    <div className="stg-section-title">Email Notifications</div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Weekly Business Report</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Summary of your business metrics every Monday</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Goal Milestones</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Get notified when you hit revenue targets</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Market Alerts</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Opportunities and threats in your market</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Product Updates</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>New Zelrex features and improvements</div></div>
                      <button className="stg-toggle stg-off" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                  </div>
                  <div className="stg-section">
                    <div className="stg-section-title">In-App Notifications</div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Business Suggestions</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Zelrex proactive business recommendations</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                    <div className="stg-row">
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>Deploy Status</div><div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Website deployment success or failure</div></div>
                      <button className="stg-toggle stg-on" onClick={(e) => { e.currentTarget.classList.toggle("stg-on"); e.currentTarget.classList.toggle("stg-off"); }} />
                    </div>
                  </div>
                </>)}

              </div>
            </div>
          </div>
        )}

        {(goalModalOpen || goalClosing) && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center", transformOrigin: goalOriginRef.current ? `${goalOriginRef.current.x}px ${goalOriginRef.current.y}px` : "center center", animation: `${goalClosing ? "overlayZoomOut" : "overlayZoomIn"} 420ms cubic-bezier(0.32,0.72,0,1) forwards`, pointerEvents: goalClosing ? "none" : undefined }}>
            <div onClick={closeGoalModal} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
            <div style={{ position: "relative", width: 420, maxWidth: "90vw", borderRadius: 20, border: `1px solid ${C.border}`, background: "rgba(12,16,24,0.88)", backdropFilter: "blur(40px) saturate(1.8)", WebkitBackdropFilter: "blur(40px) saturate(1.8)", boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 0.5px 0 rgba(255,255,255,0.08)", padding: 0, overflow: "hidden" }}>
              {/* Glass header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${C.accent}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Ic n="goal" style={{ width: 16, height: 16, color: C.accent }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{userGoal ? "Edit your goal" : "Set your goal"}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>Zelrex keeps this in mind with every recommendation</div>
                  </div>
                </div>
              </div>
              {/* Body */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>What's your main goal?</label>
                  <input value={goalDraft.text} onChange={(e) => setGoalDraft(d => ({ ...d, text: e.target.value }))} placeholder="e.g., Build a sustainable freelance business, Replace my 9-5 income" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Revenue target (optional)</label>
                  <input value={goalDraft.target} onChange={(e) => setGoalDraft(d => ({ ...d, target: e.target.value }))} placeholder="e.g., $5,000/month, $100K/year" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 6 }}>Target date (optional)</label>
                  <input value={goalDraft.deadline} onChange={(e) => setGoalDraft(d => ({ ...d, deadline: e.target.value }))} placeholder="e.g., June 2026, 6 months" style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", color: C.text, fontSize: 14, outline: "none" }} />
                </div>
              </div>
              {/* Footer */}
              <div style={{ padding: "0 24px 20px", display: "flex", gap: 10 }}>
                {userGoal && (
                  <button onClick={async () => { setUserGoal(null); setGoalDraft({ text: "", target: "", deadline: "" }); await db.deleteGoal(); closeGoalModal(); }} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Remove goal</button>
                )}
                <button onClick={closeGoalModal} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                <button onClick={async () => { if (goalDraft.text.trim()) { const g = { text: goalDraft.text.trim(), target: goalDraft.target.trim(), deadline: goalDraft.deadline.trim() }; setUserGoal(g); await db.saveGoal(g); setNotifications(ns => [{ id: uid("n"), text: `Goal set: "${g.text}" — Zelrex will track your progress and send updates.`, time: Date.now(), read: false }, ...ns]); } closeGoalModal(); }} style={{ flex: 1.5, padding: "10px", borderRadius: 10, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 16px ${C.accent}40` }}>Save goal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
