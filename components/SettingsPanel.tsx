"use client";
import React, { useState, useEffect, useRef } from "react";

/* Zelrex design tokens, same values as the C object in ChatPageClient.tsx. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* ── Types ──────────────────────────────────────────────────────────────────────────────────── */

/** The slice of the settings object this panel reads and writes. Every key here has real behavior behind it. */
export type PanelSettings = {
  responseStyle: "direct" | "detailed" | "coaching";
  language: string;
  freelanceNiche: string;
  experienceLevel: "beginner" | "intermediate" | "expert";
  timezone: string;
  autoDeploy: boolean;
  permAutoExtractClients: boolean;
  permAutoSuggestInvoices: boolean;
  inAppSuggestions: boolean;
  permProactiveFollowups: boolean;
  marketMonitoring: boolean;
  notifPositiveEncouragement: boolean;
  inAppDeployStatus: boolean;
  notifOverdueInvoices: boolean;
  notifGoalProgress: boolean;
  notifTrafficDrops: boolean;
  notifRevenueChanges: boolean;
};

/** The parts of Clerk's UserResource this panel uses. */
export type PanelUser = {
  imageUrl?: string;
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
  externalAccounts?: Array<{ provider: string }>;
  passwordEnabled?: boolean;
  update: (params: { firstName?: string | null; lastName?: string | null }) => Promise<unknown>;
  updatePassword: (params: { currentPassword?: string; newPassword: string }) => Promise<unknown>;
  delete: () => Promise<unknown>;
};

export type SettingsTab = "account" | "assistant" | "notifications" | "help";
type StripeStatus = "connected" | "none" | "no-site";

/* ── Static option lists ────────────────────────────────────────────────────────────────────── */

const NICHES: Array<[string, string]> = [
  ["", "Not set"], ["video-editing", "Video editing"], ["graphic-design", "Graphic design"], ["web-design", "Web design"],
  ["copywriting", "Copywriting"], ["social-media", "Social media"], ["virtual-assistant", "Virtual assistant"], ["coaching", "Coaching"],
  ["consulting", "Consulting"], ["photography", "Photography"], ["development", "Development"], ["other", "Other"],
];

const LANGUAGES: Array<[string, string]> = [
  ["en", "English"], ["es", "Español"], ["fr", "Français"], ["de", "Deutsch"], ["pt", "Português"],
  ["ja", "日本語"], ["zh", "中文"], ["ko", "한국어"], ["ar", "العربية"], ["hi", "हिन्दी"],
];

/* Labels carry no UTC offsets on purpose: offsets change with daylight saving, the zone IDs don't. */
const TIMEZONES: Array<[string, string]> = [
  ["Pacific/Honolulu", "Honolulu"], ["America/Anchorage", "Anchorage"], ["America/Los_Angeles", "Pacific Time (Los Angeles)"],
  ["America/Denver", "Mountain Time (Denver)"], ["America/Chicago", "Central Time (Chicago)"], ["America/New_York", "Eastern Time (New York)"],
  ["America/Toronto", "Toronto"], ["America/Halifax", "Halifax"], ["America/St_Johns", "St. John's"], ["America/Sao_Paulo", "São Paulo"],
  ["America/Argentina/Buenos_Aires", "Buenos Aires"], ["Atlantic/Reykjavik", "Reykjavík"], ["Europe/London", "London"], ["Europe/Paris", "Paris"],
  ["Europe/Berlin", "Berlin"], ["Europe/Helsinki", "Helsinki"], ["Europe/Moscow", "Moscow"], ["Africa/Lagos", "Lagos"], ["Africa/Cairo", "Cairo"],
  ["Africa/Nairobi", "Nairobi"], ["Asia/Dubai", "Dubai"], ["Asia/Karachi", "Karachi"], ["Asia/Kolkata", "India (Kolkata)"], ["Asia/Dhaka", "Dhaka"],
  ["Asia/Bangkok", "Bangkok"], ["Asia/Shanghai", "China (Shanghai)"], ["Asia/Singapore", "Singapore"], ["Asia/Tokyo", "Tokyo"], ["Asia/Seoul", "Seoul"],
  ["Australia/Sydney", "Sydney"], ["Pacific/Auckland", "Auckland"],
];

const TABS: Array<{ id: SettingsTab; label: string; title: string; sub: string }> = [
  { id: "account", label: "Account", title: "Account", sub: "Your profile, sign-in and data." },
  { id: "assistant", label: "Assistant", title: "Assistant", sub: "How Zelrex talks to you and what it does on its own. Saved on this device." },
  { id: "notifications", label: "Notifications", title: "Notifications", sub: "What shows up in the bell. Saved on this device." },
  { id: "help", label: "Help & legal", title: "Help & legal", sub: "Get help, replay the tour, read the terms." },
];

/* ── Icons ──────────────────────────────────────────────────────────────────────────────────── */

const svg = (d: React.ReactNode, size: number) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>{d}</svg>
);
const GearIcon = ({ size = 18 }: { size?: number }) => svg(<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>, size);
const XIcon = ({ size = 17 }: { size?: number }) => svg(<path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />, size);
const ArrowUpRight = ({ size = 14 }: { size?: number }) => svg(<path d="M7 17L17 7M9 7h8v8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />, size);
const Spinner = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ animation: "sp-spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" /><path d="M12 3a9 9 0 019 9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
);

/* ── Styles ─────────────────────────────────────────────────────────────────────────────────── */

const STYLES = `
  .sp-root,.sp-root *{box-sizing:border-box}
  @keyframes sp-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes sp-spin{to{transform:rotate(360deg)}}
  .sp-header{height:52px;padding:0 14px 0 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ${C.border};flex-shrink:0}
  .sp-body{flex:1;min-height:0;display:flex}
  .sp-nav{width:208px;flex-shrink:0;padding:16px 12px;border-right:1px solid ${C.border};display:flex;flex-direction:column;gap:2px}
  .sp-tab{height:36px;padding:0 12px;border-radius:999px;border:none;background:none;color:${C.textSec};font-size:13.5px;font-weight:500;font-family:inherit;text-align:left;cursor:pointer;white-space:nowrap;transition:background-color 150ms ${EASE},color 150ms ${EASE}}
  .sp-tab:hover{background:rgba(255,255,255,0.04);color:${C.text}}
  .sp-tab[aria-current="page"]{background:rgba(74,144,255,0.10);color:${C.accent}}
  .sp-scroll{flex:1;min-width:0;overflow-y:auto}
  .sp-content{width:600px;max-width:100%;margin:0 auto;padding:36px 24px 96px;animation:sp-fadeUp 250ms ${EASE} both}
  .sp-group{margin-bottom:28px}
  .sp-label{font-size:12px;font-weight:500;color:${C.textSec};margin:0 0 8px 2px}
  .sp-card{border:1px solid ${C.border};border-radius:12px;background:${C.bgElevated}}
  .sp-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border-bottom:1px solid ${C.border}}
  .sp-row:last-child{border-bottom:none}
  .sp-row-text{min-width:0}
  .sp-row-title{font-size:14px;font-weight:500;color:${C.text};letter-spacing:-0.005em}
  .sp-row-desc{font-size:12.5px;line-height:1.5;color:${C.textMuted};margin-top:2px}
  .sp-input{width:100%;height:36px;padding:0 12px;border-radius:10px;border:1px solid ${C.border};background:${C.bgInput};color:${C.text};font-size:13.5px;font-family:inherit;outline:none;transition:border-color 150ms ${EASE}}
  .sp-input:focus{border-color:${C.accent}}
  .sp-input::placeholder{color:${C.textMuted}}
  .sp-input:disabled{opacity:0.5}
  .sp-select{height:36px;min-width:150px;max-width:230px;padding:0 34px 0 12px;border-radius:10px;border:1px solid ${C.border};background-color:${C.bgInput};color:${C.text};font-size:13.5px;font-family:inherit;cursor:pointer;outline:none;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23808690' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;transition:border-color 150ms ${EASE}}
  .sp-select:hover{border-color:${C.borderHover}}
  .sp-select:focus{border-color:${C.accent}}
  .sp-select option{background:${C.bgElevated};color:#fff}
  .sp-switch{position:relative;width:36px;height:20px;border-radius:999px;border:none;padding:0;flex-shrink:0;cursor:pointer;background:rgba(255,255,255,0.14);transition:background-color 150ms ${EASE}}
  .sp-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:999px;background:#fff;transition:transform 150ms ${EASE}}
  .sp-switch[aria-checked="true"]{background:${C.accent}}
  .sp-switch[aria-checked="true"]::after{transform:translateX(16px)}
  .sp-switch:disabled{opacity:0.4;cursor:not-allowed}
  .sp-switch:focus-visible,.sp-tab:focus-visible,.sp-btn:focus-visible,.sp-btn-accent:focus-visible,.sp-btn-danger:focus-visible,.sp-icon-btn:focus-visible{outline:2px solid ${C.accent};outline-offset:2px}
  .sp-btn{height:34px;padding:0 16px;border-radius:999px;border:1px solid ${C.border};background:transparent;color:${C.textSec};font-size:13px;font-weight:500;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap;text-decoration:none;flex-shrink:0;transition:background-color 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE}}
  .sp-btn:not(:disabled):hover{background:rgba(255,255,255,0.04);border-color:${C.borderHover};color:${C.text}}
  .sp-btn:not(:disabled):active{background:rgba(255,255,255,0.06);transition-duration:80ms}
  .sp-btn:disabled{opacity:0.5;cursor:not-allowed}
  .sp-btn-accent{height:34px;padding:0 18px;border-radius:999px;border:none;background:${C.accent};color:#fff;font-size:13px;font-weight:600;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:filter 150ms ${EASE},transform 100ms ${EASE}}
  .sp-btn-accent:not(:disabled):hover{filter:brightness(1.1)}
  .sp-btn-accent:not(:disabled):active{filter:brightness(0.95);transform:scale(0.98);transition-duration:80ms}
  .sp-btn-accent:disabled{opacity:0.5;cursor:not-allowed}
  .sp-btn-danger{height:34px;padding:0 16px;border-radius:999px;border:1px solid rgba(239,68,68,0.28);background:transparent;color:${C.red};font-size:13px;font-weight:500;font-family:inherit;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;white-space:nowrap;flex-shrink:0;transition:background-color 150ms ${EASE},border-color 150ms ${EASE}}
  .sp-btn-danger:not(:disabled):hover{background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.45)}
  .sp-btn-danger:disabled{opacity:0.5;cursor:not-allowed}
  .sp-icon-btn{width:32px;height:32px;border:none;background:none;color:${C.textSec};display:flex;align-items:center;justify-content:center;border-radius:999px;cursor:pointer;transition:background-color 150ms ${EASE},color 150ms ${EASE}}
  .sp-icon-btn:hover{background:rgba(255,255,255,0.06);color:${C.text}}
  .sp-note{font-size:12.5px;line-height:1.5}
  .sp-legal p{margin:0 0 12px;font-size:13px;line-height:1.7;color:${C.textSec}}
  .sp-legal p:last-child{margin-bottom:0}
  @media(max-width:700px){
    .sp-body{flex-direction:column}
    .sp-nav{width:auto;flex-direction:row;overflow-x:auto;padding:10px 12px;border-right:none;border-bottom:1px solid ${C.border};scrollbar-width:none}
    .sp-nav::-webkit-scrollbar{display:none}
    .sp-content{padding:24px 16px 80px}
    .sp-row:has(.sp-select,.sp-input){flex-wrap:wrap;gap:10px}
    .sp-row-text{flex:1}
    .sp-select{max-width:100%}
    .sp-row-control:has(.sp-select,.sp-input){width:100%}
    .sp-row-control .sp-select,.sp-row-control .sp-input{width:100%;max-width:none}
  }
`;

/* ── Small building blocks ──────────────────────────────────────────────────────────────────── */

function Group({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <section className="sp-group">
      {label && <h2 className="sp-label">{label}</h2>}
      <div className="sp-card">{children}</div>
    </section>
  );
}

function Row({ title, desc, children, danger }: { title: string; desc?: React.ReactNode; children?: React.ReactNode; danger?: boolean }) {
  return (
    <div className="sp-row">
      <div className="sp-row-text">
        <div className="sp-row-title" style={danger ? { color: C.red } : undefined}>{title}</div>
        {desc && <div className="sp-row-desc">{desc}</div>}
      </div>
      {children !== undefined && <div className="sp-row-control" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{children}</div>}
    </div>
  );
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className="sp-switch" onClick={() => onChange(!checked)} />;
}

function ToggleRow({ title, desc, checked, onChange, disabled }: { title: string; desc: React.ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <Row title={title} desc={desc}>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </Row>
  );
}

function Select({ value, onChange, options, label }: { value: string; onChange: (v: string) => void; options: Array<[string, string]>; label: string }) {
  /* A stored value that isn't in the list (e.g. a detected time zone we don't list) still has to display. */
  const list = options.some(([v]) => v === value) ? options : [[value, value.replace(/_/g, " ")] as [string, string], ...options];
  return (
    <select className="sp-select" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

const Status = ({ ok, children }: { ok?: boolean; children: React.ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 500, color: ok ? C.green : C.textMuted }}>
    <span style={{ width: 7, height: 7, borderRadius: 999, background: ok ? C.green : C.textMuted }} />
    {children}
  </span>
);

const errMsg = (e: any, fallback: string) => e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || e?.message || fallback;

/* ── Panel ──────────────────────────────────────────────────────────────────────────────────── */

export function SettingsPanel({ settings, onChange, user, stripeStatus, onConnectStripe, onSignOut, onAccountDeleted, onReplayTutorial, onClose, initialTab = "account" }: {
  settings: PanelSettings;
  onChange: <K extends keyof PanelSettings>(key: K, value: PanelSettings[K]) => void;
  user: PanelUser | null | undefined;
  stripeStatus: StripeStatus;
  onConnectStripe: () => void;
  onSignOut: () => void;
  onAccountDeleted: () => void;
  onReplayTutorial: () => void;
  onClose: () => void;
  initialTab?: SettingsTab;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo?.({ top: 0 }); }, [tab]);

  /* ── Name ── */
  const currentName = (user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "").trim();
  const [name, setName] = useState(currentName);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const nameDirty = name.trim() !== currentName && name.trim().length > 0;

  const saveName = async () => {
    if (!user || !nameDirty || nameBusy) return;
    const parts = name.trim().split(/\s+/);
    setNameBusy(true); setNameMsg(null);
    try {
      await user.update({ firstName: parts[0], lastName: parts.slice(1).join(" ") || null });
      setNameMsg({ ok: true, text: "Name updated." });
    } catch (e) {
      setNameMsg({ ok: false, text: errMsg(e, "Couldn't update your name.") });
    } finally { setNameBusy(false); }
  };

  /* ── Password ── */
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const savePassword = async () => {
    if (!user || pwBusy) return;
    if (!pw.current || !pw.next || !pw.confirm) return setPwMsg({ ok: false, text: "Fill in all three fields." });
    if (pw.next.length < 8) return setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
    if (pw.next !== pw.confirm) return setPwMsg({ ok: false, text: "New passwords don't match." });
    setPwBusy(true); setPwMsg(null);
    try {
      await user.updatePassword({ currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: "", next: "", confirm: "" });
      setPwMsg({ ok: true, text: "Password updated." });
    } catch (e) {
      setPwMsg({ ok: false, text: errMsg(e, "Couldn't update your password.") });
    } finally { setPwBusy(false); }
  };

  /* ── Data export ── */
  const [exportBusy, setExportBusy] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const exportData = async () => {
    if (exportBusy) return;
    setExportBusy(true); setExportMsg(null);
    try {
      const res = await fetch("/api/user-data");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zelrex-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExportMsg({ ok: true, text: "Download started." });
    } catch (e: any) {
      setExportMsg({ ok: false, text: e?.message ? `Export failed: ${e.message}` : "Export failed." });
    } finally { setExportBusy(false); }
  };

  /* ── Delete account ── */
  const [delOpen, setDelOpen] = useState(false);
  const [delText, setDelText] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delErr, setDelErr] = useState("");

  const deleteAccount = async () => {
    if (!user || delText !== "DELETE" || delBusy) return;
    setDelBusy(true); setDelErr("");
    try {
      await user.delete();
      onAccountDeleted();
    } catch (e) {
      setDelErr(errMsg(e, "Couldn't delete your account. Nothing was changed."));
      setDelBusy(false);
    }
  };

  const provider = user?.externalAccounts?.[0]?.provider;
  const providerLabel = provider ? provider.replace(/^oauth_/, "").replace(/^./, (c) => c.toUpperCase()) : "";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const set = onChange;
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div role="dialog" aria-label="Settings" className="sp-root" style={{ position: "fixed", inset: 0, zIndex: 9500, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{STYLES}</style>

      <div className="sp-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: C.accent }}>
          <GearIcon />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Settings</span>
        </div>
        <button className="sp-icon-btn" onClick={onClose} aria-label="Close" title="Close (Esc)"><XIcon /></button>
      </div>

      <div className="sp-body">
        <nav className="sp-nav" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.id} className="sp-tab" aria-current={tab === t.id ? "page" : undefined} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        <div className="sp-scroll" ref={scrollRef}>
          <div className="sp-content" key={tab}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>{active.title}</h1>
            <p style={{ margin: "10px 0 32px", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>{active.sub}</p>

            {/* ───────────────────────── ACCOUNT ───────────────────────── */}
            {tab === "account" && (<>
              <Group label="Profile">
                <div className="sp-row" style={{ justifyContent: "flex-start", gap: 14 }}>
                  {user?.imageUrl
                    ? <img src={user.imageUrl} alt="" width={44} height={44} style={{ width: 44, height: 44, borderRadius: 999, objectFit: "cover", flexShrink: 0 }} />
                    : <div style={{ width: 44, height: 44, borderRadius: 999, background: "rgba(255,255,255,0.06)", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 600, flexShrink: 0 }}>{(currentName || email || "?").charAt(0).toUpperCase()}</div>}
                  <div className="sp-row-text">
                    <div className="sp-row-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentName || "Your account"}</div>
                    <div className="sp-row-desc" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}{email ? " · " : ""}{provider ? `Signed in with ${providerLabel}` : "Email sign-in"}</div>
                  </div>
                </div>
                <div className="sp-row">
                  <div className="sp-row-text">
                    <label htmlFor="sp-name" className="sp-row-title" style={{ display: "block" }}>Name</label>
                    {nameMsg && <div className="sp-note" role="status" style={{ marginTop: 2, color: nameMsg.ok ? C.green : C.red }}>{nameMsg.text}</div>}
                  </div>
                  <div className="sp-row-control" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input id="sp-name" className="sp-input" style={{ width: 200 }} value={name} onChange={(e) => { setName(e.target.value); if (nameMsg) setNameMsg(null); }} onKeyDown={(e) => { if (e.key === "Enter") saveName(); }} placeholder="Your name" autoComplete="name" />
                    <button className="sp-btn-accent" onClick={saveName} disabled={!nameDirty || nameBusy}>{nameBusy ? <Spinner /> : "Save"}</button>
                  </div>
                </div>
              </Group>

              <Group label="Plan and connections">
                <Row title="Plan" desc="Paid plans aren't available yet.">
                  <Status>Free</Status>
                </Row>
                <Row title="Stripe" desc="Lets your website take payments into your own Stripe account.">
                  {stripeStatus === "connected" ? <Status ok>Connected</Status>
                    : stripeStatus === "no-site" ? <Status>Build a site first</Status>
                    : <button className="sp-btn" onClick={onConnectStripe}>Connect</button>}
                </Row>
              </Group>

              {user?.passwordEnabled && (
                <Group label="Password">
                  <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                    {([["current", "Current password", "current-password"], ["next", "New password", "new-password"], ["confirm", "Confirm new password", "new-password"]] as const).map(([k, l, ac]) => (
                      <div key={k}>
                        <label htmlFor={`sp-pw-${k}`} style={{ display: "block", fontSize: 12, fontWeight: 500, color: C.textSec, marginBottom: 6 }}>{l}</label>
                        <input id={`sp-pw-${k}`} className="sp-input" type="password" autoComplete={ac} value={pw[k]} onChange={(e) => { setPw({ ...pw, [k]: e.target.value }); if (pwMsg) setPwMsg(null); }} onKeyDown={(e) => { if (e.key === "Enter") savePassword(); }} />
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minHeight: 34 }}>
                      <button className="sp-btn-accent" onClick={savePassword} disabled={pwBusy}>{pwBusy ? <><Spinner /> Updating</> : "Update password"}</button>
                      {pwMsg && <span className="sp-note" role="status" style={{ color: pwMsg.ok ? C.green : C.red }}>{pwMsg.text}</span>}
                    </div>
                  </div>
                </Group>
              )}

              <Group label="Your data">
                <Row title="Export your data" desc={<>Chats, websites, goal and notifications as a JSON file.{exportMsg && <span style={{ color: exportMsg.ok ? C.green : C.red }}> {exportMsg.text}</span>}</>}>
                  <button className="sp-btn" onClick={exportData} disabled={exportBusy}>{exportBusy ? <><Spinner /> Preparing</> : "Export"}</button>
                </Row>
              </Group>

              <Group label="Session">
                <Row title="Sign out"><button className="sp-btn" onClick={onSignOut}>Sign out</button></Row>
                <Row title="Delete account" desc="Permanently deletes your account and the data tied to it. This can't be undone." danger>
                  {!delOpen && <button className="sp-btn-danger" onClick={() => { setDelOpen(true); setDelText(""); setDelErr(""); }}>Delete</button>}
                </Row>
                {delOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.border}` }}>
                    <label htmlFor="sp-del" style={{ display: "block", fontSize: 13, color: C.textSec, margin: "14px 0 8px" }}>Type <strong style={{ color: C.text, fontWeight: 600 }}>DELETE</strong> to confirm.</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input id="sp-del" className="sp-input" style={{ width: 180 }} autoFocus value={delText} onChange={(e) => { setDelText(e.target.value); if (delErr) setDelErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") deleteAccount(); }} autoComplete="off" autoCapitalize="off" spellCheck={false} />
                      <button className="sp-btn-danger" onClick={deleteAccount} disabled={delText !== "DELETE" || delBusy} style={{ background: delText === "DELETE" ? "rgba(239,68,68,0.10)" : undefined }}>{delBusy ? <><Spinner /> Deleting</> : "Delete my account"}</button>
                      <button className="sp-btn" onClick={() => { setDelOpen(false); setDelText(""); setDelErr(""); }} disabled={delBusy}>Cancel</button>
                    </div>
                    {delErr && <div className="sp-note" role="alert" style={{ marginTop: 10, color: C.red }}>{delErr}</div>}
                  </div>
                )}
              </Group>
            </>)}

            {/* ───────────────────────── ASSISTANT ───────────────────────── */}
            {tab === "assistant" && (<>
              <Group label="Replies">
                <Row title="Style" desc="Direct is short and to the point. Coaching asks more questions.">
                  <Select label="Response style" value={settings.responseStyle} onChange={(v) => set("responseStyle", v as PanelSettings["responseStyle"])} options={[["direct", "Direct"], ["detailed", "Detailed"], ["coaching", "Coaching"]]} />
                </Row>
                <Row title="Language" desc="Zelrex replies in this language. The rest of the app stays in English.">
                  <Select label="Reply language" value={settings.language} onChange={(v) => set("language", v)} options={LANGUAGES} />
                </Row>
              </Group>

              <Group label="About your business">
                <Row title="Niche" desc="Shared with Zelrex and used when it builds your site.">
                  <Select label="Freelance niche" value={settings.freelanceNiche} onChange={(v) => set("freelanceNiche", v)} options={NICHES} />
                </Row>
                <Row title="Experience" desc="Zelrex pitches advice at this level.">
                  <Select label="Experience level" value={settings.experienceLevel} onChange={(v) => set("experienceLevel", v as PanelSettings["experienceLevel"])} options={[["beginner", "Under 1 year"], ["intermediate", "1 to 3 years"], ["expert", "3+ years"]]} />
                </Row>
                <Row title="Time zone" desc="Shared with Zelrex so timing advice fits your day.">
                  <Select label="Time zone" value={settings.timezone} onChange={(v) => set("timezone", v)} options={TIMEZONES} />
                </Row>
              </Group>

              <Group label="On its own">
                <ToggleRow title="Deploy after build" desc="Publish a site to a live URL as soon as it's built, without waiting for you to review the preview." checked={settings.autoDeploy} onChange={(v) => set("autoDeploy", v)} />
                <ToggleRow title="Offer to add clients" desc="When you mention a client in chat, Zelrex asks if you want them added to Clients." checked={settings.permAutoExtractClients} onChange={(v) => set("permAutoExtractClients", v)} />
                <ToggleRow title="Offer to create invoices" desc={settings.permAutoExtractClients ? "When you mention a client and an amount, Zelrex offers to draft an invoice." : "Needs “Offer to add clients” to be on."} checked={settings.permAutoSuggestInvoices} onChange={(v) => set("permAutoSuggestInvoices", v)} disabled={!settings.permAutoExtractClients} />
              </Group>
            </>)}

            {/* ───────────────────────── NOTIFICATIONS ───────────────────────── */}
            {tab === "notifications" && (<>
              <Group label="Suggestions">
                <ToggleRow title="Business suggestions" desc="Nudges after a few quiet days, and follow-ups on advice Zelrex gave you." checked={settings.inAppSuggestions} onChange={(v) => set("inAppSuggestions", v)} />
                <ToggleRow title="Follow-up reminders" desc={settings.inAppSuggestions ? "A reminder when Zelrex asked something and you haven't replied." : "Needs “Business suggestions” to be on."} checked={settings.permProactiveFollowups} onChange={(v) => set("permProactiveFollowups", v)} disabled={!settings.inAppSuggestions} />
                <ToggleRow title="Market alerts" desc="Changes in your market that Zelrex's daily check picks up." checked={settings.marketMonitoring} onChange={(v) => set("marketMonitoring", v)} />
                <ToggleRow title="Welcome back" desc="A short check-in once per session." checked={settings.notifPositiveEncouragement} onChange={(v) => set("notifPositiveEncouragement", v)} />
              </Group>
              <Group label="Alerts">
                <ToggleRow title="Deploys" desc="When your website goes live." checked={settings.inAppDeployStatus} onChange={(v) => set("inAppDeployStatus", v)} />
                <ToggleRow title="Invoices" desc="Overdue invoices, and ones due in the next few days." checked={settings.notifOverdueInvoices} onChange={(v) => set("notifOverdueInvoices", v)} />
                <ToggleRow title="Goal deadline" desc="As the deadline on your goal gets close." checked={settings.notifGoalProgress} onChange={(v) => set("notifGoalProgress", v)} />
                <ToggleRow title="Traffic drops" desc="When visits to your site fall well below your usual." checked={settings.notifTrafficDrops} onChange={(v) => set("notifTrafficDrops", v)} />
                <ToggleRow title="Revenue changes" desc="When your tracked revenue moves a lot." checked={settings.notifRevenueChanges} onChange={(v) => set("notifRevenueChanges", v)} />
              </Group>
              <p className="sp-note" style={{ margin: "-8px 2px 0", color: C.textMuted }}>These appear in the bell inside Zelrex. Email notifications aren't available yet.</p>
            </>)}

            {/* ───────────────────────── HELP & LEGAL ───────────────────────── */}
            {tab === "help" && (<>
              <Group label="Help">
                <Row title="Contact support" desc="Questions, bugs, or data requests.">
                  <a className="sp-btn" href="/contact" target="_blank" rel="noopener noreferrer">Contact <ArrowUpRight /></a>
                </Row>
                <Row title="Replay the tour" desc="Walk through the main parts of Zelrex again.">
                  <button className="sp-btn" onClick={onReplayTutorial}>Replay</button>
                </Row>
              </Group>

              <Group label="Terms of Service">
                <div className="sp-legal" style={{ padding: 16 }}>
                  <p>By using Zelrex, you agree to the following terms and conditions. Zelrex provides AI-powered business tools including website building, client management, and business analytics.</p>
                  <p>You are responsible for the content you create and publish through our platform. Zelrex reserves the right to suspend accounts that violate these terms or engage in prohibited activities.</p>
                  <p>All websites built and deployed through Zelrex remain your intellectual property. Zelrex provides the infrastructure and tools but does not claim ownership over your content, designs, or business data.</p>
                  <p>Zelrex offers both free and paid subscription tiers. Paid features are subject to the terms of your subscription plan. Refunds are handled on a case-by-case basis within 14 days of purchase.</p>
                  <p>These terms may be updated periodically. Continued use of Zelrex constitutes acceptance of any modifications.</p>
                  <p style={{ fontSize: 11.5, color: C.textMuted }}>Last updated: January 2025</p>
                </div>
              </Group>

              <Group label="Privacy Policy">
                <div className="sp-legal" style={{ padding: 16 }}>
                  <p>Zelrex is committed to protecting your privacy. This policy explains how we collect, use, and safeguard your personal information.</p>
                  <p>We collect information you provide directly, including your name, email address, business details, and content created through the platform. We also collect usage data to improve our services.</p>
                  <p>Your data is used solely to provide and improve Zelrex services. We do not sell, share, or distribute your personal data to third parties for marketing purposes. Your conversations and business data are never used to train AI models.</p>
                  <p>All data is encrypted in transit and at rest. We use industry-standard security measures to protect your information from unauthorized access.</p>
                  <p>You have the right to access, export, or delete your data at any time through the Account settings. For data-related requests, contact support@zelrex.com.</p>
                  <p style={{ fontSize: 11.5, color: C.textMuted }}>Last updated: January 2025</p>
                </div>
              </Group>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
