// @ts-nocheck
"use client";
import React, { useState, useEffect, useCallback } from "react";

interface Prospect {
  id: string;
  name: string;
  company: string;
  platform: string;
  platform_url: string;
  source_url?: string;
  relevance_reason: string;
  status: string;
  email?: string;
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
  queued: number;
  sent: number;
  replied: number;
  replyRate: number;
  templateStats?: {
    currentTone: string;
    initialEmails: { sent: number; replied: number; replyRate: number };
    followUps: { sent: number; replied: number; replyRate: number };
  };
}

interface Settings {
  tone: string;
  follow_up_days: number;
  active: boolean;
}

/* Zelrex design tokens — mirrors the C object in ChatPageClient.tsx.
   Same values, so this panel reads as part of the same product instead of
   a separately-designed screen bolted on. */
const C = {
  bg: "#06090F", bgSurface: "#0A0F1A", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentGlow: "rgba(74,144,255,0.15)", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", purple: "#8B5CF6", amber: "#F59E0B", red: "#EF4444",
};

export function OutreachSystem({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"queue" | "sent" | "settings">("queue");
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", company: "", email: "", platform_url: "", notes: "" });
  const [setupMode, setSetupMode] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [linkedInDm, setLinkedInDm] = useState<any>(null);
  const [linkedInLoading, setLinkedInLoading] = useState(false);
  const [abTesting, setAbTesting] = useState(false);
  // Shared progress tracking for AI-generation actions (write email, A/B
  // test) so the button can show elapsed time and a real cancel, instead of
  // just flipping its label with no way to back out.
  const [genElapsed, setGenElapsed] = useState(0);
  const genAbortRef = React.useRef<AbortController | null>(null);
  const genTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startGenTimer = () => {
    setGenElapsed(0);
    if (genTimerRef.current) clearInterval(genTimerRef.current);
    genTimerRef.current = setInterval(() => setGenElapsed((e) => e + 1), 1000);
  };
  const stopGenTimer = () => { if (genTimerRef.current) { clearInterval(genTimerRef.current); genTimerRef.current = null; } };
  const cancelGenerating = () => {
    genAbortRef.current?.abort();
    genAbortRef.current = null;
    stopGenTimer();
    setGenerating(false);
    setAbTesting(false);
  };

  const [formTone, setFormTone] = useState("professional");

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  useEffect(() => () => { genAbortRef.current?.abort(); if (genTimerRef.current) clearInterval(genTimerRef.current); }, []);

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
      setFormTone(settingsRes.settings.tone || "professional");
    } else {
      setSetupMode(true);
    }
    setLoading(false);
  }, [userId]);

  const loadStats = useCallback(async () => {
    try { const s = await api("stats"); setStats(s); } catch {}
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveSettings = async () => {
    await api("setup", { tone: formTone });
    setSettings({ tone: formTone, follow_up_days: 3, active: true });
    setSetupMode(false);
  };

  const generateEmails = async (prospectIds?: string[]) => {
    setGenerating(true);
    startGenTimer();
    const ctrl = new AbortController();
    genAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/z/outreach", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ action: "generate", userId, prospectIds }),
      });
      const data = await res.json();
      if (data.emails) {
        const listRes = await api("list", { status: "all" });
        setProspects(listRes.prospects || []);
      }
      const s = await api("stats");
      setStats(s);
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("[Outreach] Generate error:", e);
    } finally {
      genAbortRef.current = null;
      stopGenTimer();
      setGenerating(false);
    }
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

  const addManualProspect = async () => {
    if (!manualForm.name.trim()) return;
    try {
      const res = await api("add-manual", { ...manualForm });
      if (res.prospect) {
        loadData();
        setManualForm({ name: "", company: "", email: "", platform_url: "", notes: "" });
        setShowManualAdd(false);
      }
    } catch {}
  };

  const openInEmail = (email: Email, prospect: Prospect) => {
    const mailto = `mailto:${email.email_to || ''}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`;
    window.open(mailto, '_blank');
  };

  const copyEmail = (email: Email) => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
  };

  const generateLinkedInDM = async (prospectId: string) => {
    setLinkedInLoading(true);
    setLinkedInDm(null);
    try {
      const res = await fetch("/api/z/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-linkedin-dm", userId, prospectId }),
      });
      const data = await res.json();
      if (data.linkedinDm) {
        setLinkedInDm({ ...data.linkedinDm, prospectName: data.prospect?.name, prospectCompany: data.prospect?.company });
      }
    } catch (e) {
      console.error("[Outreach] LinkedIn DM error:", e);
    } finally {
      setLinkedInLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const generateABTest = async (prospectId: string) => {
    setAbTesting(true);
    startGenTimer();
    const ctrl = new AbortController();
    genAbortRef.current = ctrl;
    try {
      const res = await fetch("/api/z/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        body: JSON.stringify({ action: "ab-generate", userId, prospectId }),
      });
      const data = await res.json();
      if (data.variants) {
        const listRes = await fetch("/api/z/outreach", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list", userId }),
        });
        const listData = await listRes.json();
        setProspects(listData.prospects || []);
        loadStats();
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error("[Outreach] A/B test error:", e);
    } finally {
      genAbortRef.current = null;
      stopGenTimer();
      setAbTesting(false);
    }
  };

  // Only ever show prospects added through the manual-entry form. Anything
  // else is a leftover from the automated-discovery feature that's been
  // removed — those still exist in the database from before, but showing
  // them here would mean surfacing cold-pitch analysis of strangers inside
  // a tool that's now specifically about people you already know.
  const knownProspects = prospects.filter((p) => p.source_url === "manual");
  const queueProspects = knownProspects.filter((p) => ["discovered", "queued"].includes(p.status));
  const sentProspects = knownProspects.filter((p) => ["sent", "replied"].includes(p.status));

  const platformColor = (p: string) => {
    const colors: Record<string, string> = { youtube: "#FF0000", instagram: "#E1306C", linkedin: "#0A66C2", website: C.accent, other: C.textMuted };
    return colors[p] || C.textMuted;
  };

  const statusColor = (s: string) => {
    const colors: Record<string, string> = { discovered: C.accent, queued: C.accent, sent: C.purple, replied: C.green, archived: C.textMuted };
    return colors[s] || C.textMuted;
  };

  // "Discovered" is the backend's default status for a just-added prospect —
  // a holdover name from when it meant "found by automated search." For a
  // manually-added contact it just means "not yet contacted," so it's
  // relabeled here without touching the underlying value anything else
  // filters on.
  const statusLabel = (s: string) => (s === "discovered" ? "New" : s);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: C.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: mounted ? 1 : 0,
      transition: "opacity 300ms cubic-bezier(0.22,1,0.36,1)",
    }}>
      <style>{`
        @keyframes or-fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes or-fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes or-spin { to { transform: rotate(360deg) } }

        .or-btn{transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms cubic-bezier(0.22,1,0.36,1),color 150ms cubic-bezier(0.22,1,0.36,1);cursor:pointer}
        .or-btn:hover{background:rgba(255,255,255,0.04)!important;color:${C.text}!important}
        .or-btn:active{background:rgba(255,255,255,0.06)!important;transition-duration:80ms!important}
        .or-btn:disabled{opacity:0.5!important;cursor:not-allowed!important}

        .or-btn-outlined{transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),border-color 150ms cubic-bezier(0.22,1,0.36,1),color 150ms cubic-bezier(0.22,1,0.36,1);cursor:pointer}
        .or-btn-outlined:hover{background:rgba(255,255,255,0.04)!important;border-color:${C.borderHover}!important;color:${C.text}!important}
        .or-btn-outlined:active{background:rgba(255,255,255,0.06)!important;transition-duration:80ms!important}

        .or-btn-accent{transition:filter 150ms cubic-bezier(0.22,1,0.36,1),transform 100ms cubic-bezier(0.22,1,0.36,1);cursor:pointer}
        .or-btn-accent:hover{filter:brightness(1.1)}
        .or-btn-accent:active{filter:brightness(0.95);transform:scale(0.98);transition-duration:80ms}
        .or-btn-accent:disabled{opacity:0.5!important;cursor:not-allowed!important;filter:none!important}

        .or-btn-icon{transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),color 150ms cubic-bezier(0.22,1,0.36,1);cursor:pointer;border-radius:999px}
        .or-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
        .or-btn-icon:active{background:rgba(255,255,255,0.10)!important;transition-duration:80ms!important}

        .or-card{transition:border-color 150ms cubic-bezier(0.22,1,0.36,1),background-color 150ms cubic-bezier(0.22,1,0.36,1)}
        .or-card:hover{border-color:${C.borderHover}!important;background:${C.bgElevated}!important}

        .or-tab{transition:background-color 150ms cubic-bezier(0.22,1,0.36,1),color 150ms cubic-bezier(0.22,1,0.36,1);cursor:pointer}
        .or-tab:hover{background:rgba(255,255,255,0.04)!important}

        .or-gs::-webkit-scrollbar { width: 5px; }
        .or-gs::-webkit-scrollbar-track { background: transparent; }
        .or-gs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 999px; }
        .or-gs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

        .or-input{transition:border-color 150ms cubic-bezier(0.22,1,0.36,1)}
        .or-input:focus { border-color: ${C.accent} !important; outline: none; }

        @media (max-width: 768px) {
          .or-header { flex-direction: column !important; gap: 10px !important; padding: 14px 16px !important; position: relative !important; }
          .or-header > div:first-child { width: 100%; }
          .or-header .or-close { position: absolute !important; right: 14px !important; top: 14px !important; }
          .or-stats-bar { flex-wrap: nowrap !important; gap: 8px !important; padding: 10px 14px !important; overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
          .or-stats-bar::-webkit-scrollbar { display: none; }
          .or-stat { flex: none !important; padding: 10px 16px !important; min-width: auto !important; white-space: nowrap !important; }
          .or-content { padding: 14px !important; }
          .or-actions { flex-direction: column !important; gap: 8px !important; }
          .or-actions button { width: 100% !important; min-height: 44px !important; }
          .or-email-actions button { flex: 1 !important; min-width: calc(50% - 4px) !important; min-height: 42px !important; }
          .or-prospect-card { padding: 16px !important; }
        }
        @supports(padding-bottom: env(safe-area-inset-bottom)){
          .or-content { padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>

      <div className="or-header" style={{
        padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${C.amber}15`, border: `1px solid ${C.amber}25`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="17" r="2" stroke={C.amber} strokeWidth="1.5" /><circle cx="19" cy="7" r="2" stroke={C.amber} strokeWidth="1.5" /><path d="M6.8 15.3 17.2 8.7" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" /><path d="M14 7.5h5.2V12.7" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Outreach</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>Reach out to people you know</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, background: C.bgInput, border: `1px solid ${C.border}` }}>
          {(["queue", "sent", "settings"] as const).map((t) => (
            <button key={t} className="or-tab" onClick={() => { setTab(t); setSetupMode(false); }} style={{
              padding: "6px 16px", border: "none", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
              borderRadius: 999,
              background: tab === t ? C.accentSoft : "transparent",
              color: tab === t ? C.accent : C.textSec,
            }}>{t}</button>
          ))}
        </div>

        <button className="or-btn-icon or-close" onClick={onClose} style={{
          width: 32, height: 32,
          border: `1px solid ${C.border}`, background: "none", color: C.textSec,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
        }}>✕</button>
      </div>

      {stats && !setupMode && (
        <div className="or-stats-bar" style={{ padding: "12px 24px", display: "flex", gap: 10, borderBottom: `1px solid ${C.border}`, animation: "or-fadeIn 300ms ease 100ms both" }}>
          {[
            { label: "Queued", value: stats.queued, color: C.accent },
            { label: "Sent", value: stats.sent, color: C.purple },
            { label: "Replied", value: stats.replied, color: C.green },
            { label: "Reply Rate", value: `${stats.replyRate}%`, color: stats.replyRate > 10 ? C.green : C.textMuted },
          ].map((s, i) => (
            <div key={i} className="or-stat" style={{
              background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 12, padding: "9px 14px",
              flex: 1, display: "flex", alignItems: "center", gap: 9,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, letterSpacing: "0.03em", textTransform: "uppercase" }}>{s.label}</div>
                <div style={{ fontSize: 14, color: C.text, fontWeight: 700, marginTop: 1 }}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {stats?.templateStats && (stats.templateStats.initialEmails.sent > 0 || stats.templateStats.followUps.sent > 0) && !setupMode && (
        <div style={{ padding: "8px 24px 10px", display: "flex", gap: 14, alignItems: "center", borderBottom: `1px solid ${C.border}`, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ color: C.textMuted, fontWeight: 500 }}>Performance:</span>
          <span style={{ color: C.textSec }}>Initial {stats.templateStats.initialEmails.replyRate}% reply rate ({stats.templateStats.initialEmails.replied}/{stats.templateStats.initialEmails.sent})</span>
          {stats.templateStats.followUps.sent > 0 && <span style={{ color: C.textSec }}>· Follow-ups {stats.templateStats.followUps.replyRate}% ({stats.templateStats.followUps.replied}/{stats.templateStats.followUps.sent})</span>}
          <span style={{ color: C.textMuted }}>· Tone: {stats.templateStats.currentTone}</span>
        </div>
      )}

      <div className="or-gs or-content" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 36, height: 36, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.amber, animation: "or-spin 0.8s linear infinite" }} />
          </div>
        ) : setupMode || tab === "settings" ? (
          <div style={{ maxWidth: 480, margin: "0 auto", animation: "or-fadeUp 300ms ease 80ms both" }}>
            <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 16, padding: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 6, letterSpacing: "-0.01em" }}>
                {settings ? "Outreach Settings" : "Set Up Outreach"}
              </div>
              <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                What tone should Zelrex use when writing your outreach messages?
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 8, display: "block" }}>Email tone</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["professional", "casual", "bold"].map((t) => (
                      <button key={t} className={formTone === t ? "or-btn-accent" : "or-btn-outlined"} onClick={() => setFormTone(t)} style={{
                        padding: "8px 18px", borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                        border: `1px solid ${formTone === t ? "transparent" : C.border}`,
                        background: formTone === t ? C.accent : "none",
                        color: formTone === t ? "#fff" : C.textSec,
                      }}>{t}</button>
                    ))}
                  </div>
                </div>

                <button className="or-btn-accent" onClick={saveSettings} style={{
                  padding: "11px 24px", borderRadius: 999, border: "none", marginTop: 6,
                  background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600,
                }}>{settings ? "Save Settings" : "Get Started"}</button>
              </div>
            </div>
          </div>
        ) : tab === "queue" ? (
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            <div className="or-actions" style={{ display: "flex", gap: 10, marginBottom: 16, animation: "or-fadeUp 300ms ease 60ms both" }}>
              <button className="or-btn-accent" onClick={() => setShowManualAdd(!showManualAdd)} style={{
                padding: "9px 20px", borderRadius: 999, border: "none",
                background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600,
              }}>{showManualAdd ? "Cancel" : "+ Add a prospect"}</button>
            </div>

            {showManualAdd && (
              <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16, animation: "or-fadeUp 200ms ease" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>Add a prospect</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input className="or-input" placeholder="Name *" value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: "none" }} />
                  <input className="or-input" placeholder="Company" value={manualForm.company} onChange={e => setManualForm(f => ({ ...f, company: e.target.value }))} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: "none" }} />
                  <input className="or-input" placeholder="Email" value={manualForm.email} onChange={e => setManualForm(f => ({ ...f, email: e.target.value }))} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: "none" }} />
                  <input className="or-input" placeholder="Website URL" value={manualForm.platform_url} onChange={e => setManualForm(f => ({ ...f, platform_url: e.target.value }))} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: "none" }} />
                </div>
                <input className="or-input" placeholder="How do you know them? (helps Zelrex write a relevant email)" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.bgInput, color: C.text, fontSize: 13, outline: "none", marginBottom: 12 }} />
                <button className="or-btn-accent" onClick={addManualProspect} style={{ padding: "9px 18px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 13, fontWeight: 600 }}>Save</button>
              </div>
            )}

            {queueProspects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 40px", animation: "or-fadeUp 300ms ease 120ms both" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px", background: `${C.amber}12`, border: `1px solid ${C.amber}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="17" r="2" stroke={C.amber} strokeWidth="1.5" /><circle cx="19" cy="7" r="2" stroke={C.amber} strokeWidth="1.5" /><path d="M6.8 15.3 17.2 8.7" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" /></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No prospects yet</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>
                  Add someone you'd like to reach out to — a referral, a past client, someone who already knows your work.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {queueProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  const isExpanded = expandedId === p.id;
                  return (
                    <div key={p.id} className="or-card or-prospect-card" onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{
                      background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, cursor: "pointer",
                      animation: `or-fadeUp 250ms ease ${80 + i * 40}ms both`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${platformColor(p.platform)}15`, border: `1px solid ${platformColor(p.platform)}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: platformColor(p.platform), fontWeight: 700 }}>
                            {p.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>{p.company || "—"}{p.platform ? ` · ${p.platform}` : ""}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(p.status)}15`, border: `1px solid ${statusColor(p.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(p.status), textTransform: "capitalize" }}>{statusLabel(p.status)}</div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ color: C.textMuted, transition: "transform 200ms ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </div>
                      </div>

                      {p.relevance_reason && <div style={{ fontSize: 12, color: C.textSec, marginTop: 10, lineHeight: 1.6 }}>{p.relevance_reason}</div>}

                      {p.platform_url && (
                        <div style={{ marginTop: 8 }}>
                          <a href={p.platform_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="or-btn" style={{ fontSize: 11, fontWeight: 600, color: C.accent, textDecoration: "none", padding: "3px 10px", borderRadius: 999, background: C.accentSoft, display: "inline-flex", alignItems: "center", gap: 4 }}>
                            Visit website ↗
                          </a>
                        </div>
                      )}

                      {isExpanded && email && (
                        <div style={{ marginTop: 14, padding: 16, borderRadius: 12, background: C.bgInput, border: `1px solid ${C.border}` }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 6 }}>Subject: {email.subject}</div>
                          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 14 }}>{email.body}</div>
                          <div className="or-email-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <button className="or-btn-accent" onClick={() => { openInEmail(email, p); markSent(email.id); }} style={{ padding: "8px 16px", borderRadius: 999, border: "none", background: C.green, color: "#fff", fontSize: 12, fontWeight: 600 }}>Open in email ↗</button>
                            <button className="or-btn-outlined" onClick={() => copyEmail(email)} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 12, fontWeight: 600 }}>Copy</button>
                            <button className="or-btn-outlined" onClick={() => regenerateEmail(p.id)} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textSec, fontSize: 12, fontWeight: 600 }}>Rewrite</button>
                            <button className="or-btn-outlined" onClick={() => generateLinkedInDM(p.id)} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.purple}30`, background: `${C.purple}12`, color: C.purple, fontSize: 12, fontWeight: 600 }}>LinkedIn DM</button>
                            <button className="or-btn-outlined" onClick={() => archiveProspect(p.id)} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.red, fontSize: 12, fontWeight: 600 }}>Skip</button>
                          </div>
                        </div>
                      )}

                      {isExpanded && !email && (
                        <div style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          {generating || abTesting ? (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: C.bgInput, border: `1px solid ${C.border}` }}>
                                <div style={{ width: 12, height: 12, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "or-spin 0.7s linear infinite" }} />
                                <span style={{ fontSize: 12, color: C.textSec, fontVariantNumeric: "tabular-nums" }}>
                                  {abTesting ? "Writing variants…" : "Writing…"} {genElapsed}s
                                </span>
                              </div>
                              <button className="or-btn-outlined" onClick={cancelGenerating} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textMuted, fontSize: 12, fontWeight: 600 }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button className="or-btn-accent" onClick={() => generateEmails([p.id])} style={{ padding: "8px 18px", borderRadius: 999, border: "none", background: C.accent, color: "#fff", fontSize: 12, fontWeight: 600 }}>Write email</button>
                              <button className="or-btn-outlined" onClick={() => generateABTest(p.id)} style={{ padding: "8px 18px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.amber, fontSize: 12, fontWeight: 600 }}>A/B test</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div style={{ maxWidth: 780, margin: "0 auto" }}>
            {sentProspects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 40px", animation: "or-fadeUp 300ms ease 120ms both" }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, margin: "0 auto 20px", background: `${C.purple}12`, border: `1px solid ${C.purple}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 12l2 2 4-4M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 8 }}>No sent emails yet</div>
                <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.6, maxWidth: 340, margin: "0 auto" }}>Add a prospect and send your first outreach email.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sentProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  return (
                    <div key={p.id} className="or-card" style={{
                      background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18,
                      borderLeft: `2px solid ${p.status === "replied" ? C.green : C.purple}`,
                      animation: `or-fadeUp 250ms ease ${80 + i * 40}ms both`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}{p.company ? ` — ${p.company}` : ""}</div>
                          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{email?.subject || "No subject"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(p.status)}15`, border: `1px solid ${statusColor(p.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(p.status), textTransform: "capitalize" }}>{statusLabel(p.status)}</div>
                          {p.status === "sent" && email && (
                            <button className="or-btn-outlined" onClick={() => markReplied(email.id, p.id)} style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${C.green}30`, background: `${C.green}12`, color: C.green, fontSize: 11, fontWeight: 600 }}>Mark replied</button>
                          )}
                        </div>
                      </div>
                      {email?.sent_at && (
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 8 }}>
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

      {(linkedInDm || linkedInLoading) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: 20 }} onClick={() => { setLinkedInDm(null); setLinkedInLoading(false); }}>
          <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 18, maxWidth: 500, width: "100%", padding: 0, overflow: "hidden", animation: "or-fadeUp 200ms ease" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>LinkedIn DM script</div>
                {linkedInDm && <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{linkedInDm.prospectName} · {linkedInDm.prospectCompany}</div>}
              </div>
              <button className="or-btn-icon" onClick={() => { setLinkedInDm(null); setLinkedInLoading(false); }} style={{ background: "none", border: "none", color: C.textMuted, fontSize: 16, width: 28, height: 28 }}>✕</button>
            </div>

            {linkedInLoading ? (
              <div style={{ padding: "36px 22px", textAlign: "center", color: C.textSec, fontSize: 13 }}>Generating LinkedIn script…</div>
            ) : linkedInDm && (
              <div style={{ padding: "18px 22px 22px" }}>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.purple, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Connection request note</div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: `${C.purple}0A`, border: `1px solid ${C.purple}20`, color: C.textSec, fontSize: 13, lineHeight: 1.6 }}>{linkedInDm.connection_note}</div>
                  <button className="or-btn-outlined" onClick={() => copyToClipboard(linkedInDm.connection_note)} style={{ marginTop: 6, padding: "5px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Copy</button>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Opening DM</div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: C.bgInput, border: `1px solid ${C.border}`, color: C.textSec, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{linkedInDm.opening_dm}</div>
                  <button className="or-btn-outlined" onClick={() => copyToClipboard(linkedInDm.opening_dm)} style={{ marginTop: 6, padding: "5px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Copy</button>
                </div>
                <div style={{ marginBottom: linkedInDm.profile_tip ? 18 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Follow-up DM (5 days later)</div>
                  <div style={{ padding: "11px 14px", borderRadius: 10, background: `${C.amber}08`, border: `1px solid ${C.amber}18`, color: C.textSec, fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{linkedInDm.follow_up_dm}</div>
                  <button className="or-btn-outlined" onClick={() => copyToClipboard(linkedInDm.follow_up_dm)} style={{ marginTop: 6, padding: "5px 12px", borderRadius: 999, border: `1px solid ${C.border}`, background: "none", color: C.textMuted, fontSize: 11, fontWeight: 600 }}>Copy</button>
                </div>
                {linkedInDm.profile_tip && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: C.bgInput, border: `1px solid ${C.border}`, fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>💡 {linkedInDm.profile_tip}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}