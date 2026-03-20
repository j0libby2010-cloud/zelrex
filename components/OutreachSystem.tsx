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

const G = {
  bg: "#050709",
  glass: "rgba(255,255,255,0.025)",
  glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.52)",
  textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6",
  accentGlow: "rgba(59,130,246,0.12)",
  green: "#34D399",
  greenGlow: "rgba(52,211,153,0.10)",
  amber: "#FBBF24",
  amberGlow: "rgba(251,191,36,0.10)",
  purple: "#A78BFA",
  purpleGlow: "rgba(167,139,250,0.10)",
  red: "#F87171",
};

const EASE = "cubic-bezier(0.22,1,0.36,1)";

const glass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`,
  boxShadow: "0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.25)",
  borderRadius: 20,
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

  // Settings form
  const [formTarget, setFormTarget] = useState("");
  const [formTone, setFormTone] = useState("professional");
  const [formLimit, setFormLimit] = useState(5);

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
      background: "rgba(3,5,8,0.75)",
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.3;transform:scale(0.8)}50%{opacity:1;transform:scale(1.1)}}
        .or-card{transition:all 300ms ${EASE}}
        .or-card:hover{border-color:rgba(255,255,255,0.10)!important;transform:translateY(-1px)}
        .or-btn{transition:all 300ms ${EASE};cursor:pointer;position:relative;overflow:hidden;border-radius:999px}
        .or-btn:hover{transform:translateY(-0.5px);background:rgba(255,255,255,0.05)!important}
        .or-btn:active{transform:scale(0.97);transition-duration:120ms}
        .or-gs::-webkit-scrollbar{width:5px}
        .or-gs::-webkit-scrollbar-track{background:transparent}
        .or-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:999px}
      `}</style>

      {/* Header */}
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.5px solid ${G.glassBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: G.amberGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={G.amber} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Outreach</div>
            <div style={{ fontSize: 12, color: G.textMuted }}>Find clients while you sleep</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: 3, ...glass, borderRadius: 999 }}>
          {(["queue", "sent", "settings"] as const).map((t) => (
            <button key={t} className="or-btn" onClick={() => { setTab(t); setSetupMode(false); }} style={{
              padding: "6px 16px", border: "none", fontSize: 12, fontWeight: 600, textTransform: "capitalize",
              background: tab === t ? `linear-gradient(135deg, ${G.accent}25, ${G.accent}10)` : "transparent",
              color: tab === t ? G.accent : G.textSec,
              boxShadow: tab === t ? `0 0 12px ${G.accent}20, inset 0 0.5px 0 rgba(255,255,255,0.1)` : "none",
            }}>{t}</button>
          ))}
        </div>

        <button className="or-btn" onClick={onClose} style={{ width: 36, height: 36, border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      {/* Stats bar */}
      {stats && !setupMode && (
        <div style={{ padding: "12px 24px", display: "flex", gap: 20, borderBottom: `0.5px solid ${G.glassBorder}` }}>
          {[
            { label: "Discovered", value: stats.discovered, color: G.amber },
            { label: "Queued", value: stats.queued, color: G.accent },
            { label: "Sent", value: stats.sent, color: G.purple },
            { label: "Replied", value: stats.replied, color: G.green },
            { label: "Reply Rate", value: `${stats.replyRate}%`, color: stats.replyRate > 10 ? G.green : G.textMuted },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
              <span style={{ fontSize: 11, color: G.textMuted, fontWeight: 500 }}>{s.label}:</span>
              <span style={{ fontSize: 12, color: G.text, fontWeight: 700 }}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="or-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.amber, animation: "spin 1s linear infinite" }} />
          </div>
        ) : setupMode || tab === "settings" ? (
          /* ─── Settings / Setup ────────────────────── */
          <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ ...glass, padding: 28 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 4 }}>
                {settings ? "Outreach Settings" : "Set Up Outreach"}
              </div>
              <div style={{ fontSize: 13, color: G.textMuted, marginBottom: 24 }}>
                {settings ? "Adjust how Zelrex finds and contacts prospects." : "Tell Zelrex who your ideal clients are and how to reach them."}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 6, display: "block" }}>Who is your ideal client?</label>
                  <textarea value={formTarget} onChange={(e) => setFormTarget(e.target.value)} placeholder="e.g., YouTube creators with 10k-100k subscribers who post weekly but have inconsistent editing quality" style={{
                    width: "100%", padding: "12px 14px", borderRadius: 14, border: `0.5px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.03)", color: G.text, fontSize: 13, lineHeight: 1.6, resize: "vertical", minHeight: 80,
                  }} />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 6, display: "block" }}>Email tone</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["professional", "casual", "bold"].map((t) => (
                      <button key={t} className="or-btn" onClick={() => setFormTone(t)} style={{
                        padding: "8px 18px", border: `0.5px solid ${formTone === t ? G.accent + "40" : G.glassBorder}`,
                        background: formTone === t ? G.accentGlow : G.glass,
                        color: formTone === t ? G.accent : G.textSec, fontSize: 12, fontWeight: 600, textTransform: "capitalize",
                      }}>{t}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: G.textSec, marginBottom: 6, display: "block" }}>Daily prospect limit</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[3, 5, 10].map((n) => (
                      <button key={n} className="or-btn" onClick={() => setFormLimit(n)} style={{
                        padding: "8px 18px", border: `0.5px solid ${formLimit === n ? G.accent + "40" : G.glassBorder}`,
                        background: formLimit === n ? G.accentGlow : G.glass,
                        color: formLimit === n ? G.accent : G.textSec, fontSize: 12, fontWeight: 700,
                      }}>{n}/day</button>
                    ))}
                  </div>
                </div>

                <button className="or-btn" onClick={saveSettings} style={{
                  padding: "12px 24px", border: "none", marginTop: 8,
                  background: `linear-gradient(135deg, ${G.green}25, ${G.green}10)`,
                  color: G.green, fontSize: 14, fontWeight: 700,
                  boxShadow: `0 0 16px ${G.green}15`,
                }}>
                  {settings ? "Save Settings" : "Start Finding Clients"}
                </button>
              </div>
            </div>
          </div>
        ) : tab === "queue" ? (
          /* ─── Queue Tab ───────────────────────────── */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button className="or-btn" onClick={findProspects} disabled={finding} style={{
                padding: "10px 20px", border: "none",
                background: `linear-gradient(135deg, ${G.amber}20, ${G.amber}08)`,
                color: G.amber, fontSize: 13, fontWeight: 700, opacity: finding ? 0.6 : 1,
                boxShadow: `0 0 12px ${G.amber}10`,
              }}>
                {finding ? "Finding..." : "Find New Prospects"}
              </button>
              {queueProspects.some((p) => p.status === "discovered") && (
                <button className="or-btn" onClick={() => generateEmails()} disabled={generating} style={{
                  padding: "10px 20px", border: "none",
                  background: `linear-gradient(135deg, ${G.accent}20, ${G.accent}08)`,
                  color: G.accent, fontSize: 13, fontWeight: 700, opacity: generating ? 0.6 : 1,
                  boxShadow: `0 0 12px ${G.accent}10`,
                }}>
                  {generating ? "Writing Emails..." : "Generate Emails"}
                </button>
              )}
            </div>

            {queueProspects.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>
                <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px", background: G.amberGlow, border: `0.5px solid rgba(251,191,36,0.12)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke={G.amber} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 8 }}>No prospects yet</div>
                <div style={{ fontSize: 14, lineHeight: 1.6 }}>Click "Find New Prospects" to discover potential clients based on your business.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {queueProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  const isExpanded = expandedId === p.id;
                  return (
                    <div key={p.id} className="or-card" onClick={() => setExpandedId(isExpanded ? null : p.id)} style={{
                      ...glass, padding: 18, cursor: "pointer",
                      animation: `fadeUp 280ms ${EASE} ${i * 40}ms both`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: `${platformColor(p.platform)}15`, border: `0.5px solid ${platformColor(p.platform)}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: platformColor(p.platform) }}>
                            {platformIcon(p.platform)}
                          </div>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: G.textMuted }}>{p.company} · {p.platform}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(p.status)}15`, border: `0.5px solid ${statusColor(p.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(p.status), textTransform: "capitalize" }}>
                            {p.status}
                          </div>
                          <div style={{ fontSize: 12, color: G.textMuted }}>{p.relevance_score}%</div>
                        </div>
                      </div>

                      <div style={{ fontSize: 12, color: G.textSec, marginTop: 8, lineHeight: 1.5 }}>{p.relevance_reason}</div>

                      {isExpanded && email && (
                        <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}`, animation: "fadeUp 200ms ease" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: G.accent, marginBottom: 4 }}>Subject: {email.subject}</div>
                          <div style={{ fontSize: 13, color: G.textSec, lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 14 }}>{email.body}</div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button className="or-btn" onClick={() => { openInEmail(email, p); markSent(email.id); }} style={{
                              padding: "8px 16px", border: "none",
                              background: `linear-gradient(135deg, ${G.green}20, ${G.green}08)`,
                              color: G.green, fontSize: 12, fontWeight: 700,
                            }}>Open in Email ↗</button>
                            <button className="or-btn" onClick={() => copyEmail(email)} style={{
                              padding: "8px 16px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.textSec, fontSize: 12, fontWeight: 600,
                            }}>Copy</button>
                            <button className="or-btn" onClick={() => regenerateEmail(p.id)} style={{
                              padding: "8px 16px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.textSec, fontSize: 12, fontWeight: 600,
                            }}>Rewrite</button>
                            <button className="or-btn" onClick={() => archiveProspect(p.id)} style={{
                              padding: "8px 16px", border: `0.5px solid ${G.glassBorder}`,
                              background: G.glass, color: G.red, fontSize: 12, fontWeight: 600,
                            }}>Skip</button>
                          </div>
                        </div>
                      )}

                      {isExpanded && !email && p.status === "discovered" && (
                        <div style={{ marginTop: 14, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                          <button className="or-btn" onClick={() => generateEmails([p.id])} disabled={generating} style={{
                            padding: "8px 20px", border: "none",
                            background: `linear-gradient(135deg, ${G.accent}20, ${G.accent}08)`,
                            color: G.accent, fontSize: 12, fontWeight: 700,
                          }}>{generating ? "Writing..." : "Write Email"}</button>
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
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {sentProspects.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 8 }}>No sent emails yet</div>
                <div style={{ fontSize: 13 }}>Find prospects and send your first outreach emails.</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {sentProspects.map((p, i) => {
                  const email = p.outreach_emails?.[0];
                  return (
                    <div key={p.id} className="or-card" style={{
                      ...glass, padding: 18,
                      animation: `fadeUp 280ms ${EASE} ${i * 40}ms both`,
                      borderLeft: `3px solid ${p.status === "replied" ? G.green : G.purple}`,
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{p.name} — {p.company}</div>
                          <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{email?.subject || "No subject"}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(p.status)}15`, border: `0.5px solid ${statusColor(p.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(p.status), textTransform: "capitalize" }}>
                            {p.status}
                          </div>
                          {p.status === "sent" && email && (
                            <button className="or-btn" onClick={() => markReplied(email.id, p.id)} style={{
                              padding: "5px 12px", border: `0.5px solid ${G.green}30`,
                              background: G.greenGlow, color: G.green, fontSize: 11, fontWeight: 700,
                            }}>Mark Replied</button>
                          )}
                        </div>
                      </div>
                      {email?.sent_at && (
                        <div style={{ fontSize: 11, color: G.textMuted, marginTop: 6 }}>
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
