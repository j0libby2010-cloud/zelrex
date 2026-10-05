"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// Types
interface Client { id: string; name: string; email: string; company: string; phone: string; source: string; status: string; value_cents: number; notes: string; tags: string[]; last_contacted_at: string | null; created_at: string; crm_invoices?: any[]; crm_contracts?: any[]; crm_followups?: any[]; }
interface Invoice { id: string; client_id: string; invoice_number: string; status: string; amount_cents: number; currency: string; due_date: string | null; paid_date: string | null; items: any[]; notes: string; sent_at: string | null; reminder_count: number; created_at: string; crm_clients?: { name: string; email: string; company: string }; }
interface DashStats { totalClients: number; activeClients: number; totalRevenue: number; totalOutstanding: number; totalPending: number; totalInvoices: number; paidInvoices: number; overdueInvoices: number; activeContracts: number; estimatedMRR: number; activeProjects?: number; recentPaidInvoices?: number; revenueMilestones?: { reached: string[]; next: { label: string; progress: number } | null }; avgClientValue?: number; avgInvoiceSize?: number; }

/* Zelrex design tokens — mirrors the C object in ChatPageClient.tsx. Same
   values everywhere, so this panel reads as part of the same product. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", amber: "#F59E0B", red: "#EF4444",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtShort = (c: number) => c >= 100000 ? `$${(c / 100000).toFixed(1)}k` : fmt(c);

// One consistent 4-step ladder for every status across clients, invoices,
// contracts, and projects — not a different hue per status. Muted (not
// active yet), accent (in progress / needs attention), green (succeeded),
// red (a genuine negative or urgent outcome — lost, overdue, declined).
const statusColor = (s: string) => ({
  lead: C.textMuted, prospect: C.textMuted, active: C.accent, completed: C.green, lost: C.red,
  draft: C.textMuted, sent: C.accent, paid: C.green, overdue: C.red, cancelled: C.textMuted,
  accepted: C.green, declined: C.red, expired: C.textMuted, paused: C.textMuted,
}[s] || C.textMuted);

/* Icons drawn to match the main interface's set (1.5 stroke, round caps) */
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const ClientsIcon = ({ size = 16, color = C.accent }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.5" /><circle cx="8" cy="11" r="2" stroke={color} strokeWidth="1.5" /><path d="M13 9.5h5M13 12.5h3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" /><path d="M5.5 16c.6-1.4 1.7-2 2.5-2s1.9.6 2.5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const SearchIcon = ({ size = 14, color = C.accent }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke={color} strokeWidth="1.5" /><path d="M21 21l-4.3-4.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
);

/* Shared subcomponents */
const StatusBadge = ({ status }: { status: string }) => (
  <span style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(status)}15`, border: `1px solid ${statusColor(status)}28`, fontSize: 11, fontWeight: 600, color: statusColor(status), textTransform: "capitalize" }}>{status}</span>
);
const Btn = ({ children, variant = "ghost", ...props }: any) => {
  const base: React.CSSProperties = { padding: "7px 16px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600, border: "none" };
  const styles: Record<string, React.CSSProperties> = {
    ghost: { background: "none", color: C.textSec },
    outlined: { background: "none", color: C.textSec, border: `1px solid ${C.border}` },
    accent: { background: C.accent, color: "#fff" },
    danger: { background: "none", color: C.red },
  };
  return <button {...props} className={variant === "accent" ? "cr-btn-accent" : "cr-btn"} style={{ ...base, ...styles[variant], ...props.style }}>{children}</button>;
};
const Input = ({ style, ...props }: any) => <input {...props} className="cr-input" style={{ width: "100%", ...style }} />;

export function CRMSystem({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"dashboard" | "clients" | "invoices" | "projects">("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

  // Revenue trend
  const [revenueTrend, setRevenueTrend] = useState<any>(null);
  // Recurring invoices
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recFreq, setRecFreq] = useState("monthly");
  const [recClientId, setRecClientId] = useState("");
  const [recItems, setRecItems] = useState<any[]>([{ description: "", qty: 1, rate_cents: 0 }]);
  // Outcomes (30/60/90 day)
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [showAddOutcome, setShowAddOutcome] = useState(false);
  const [outcomeGoal, setOutcomeGoal] = useState("");
  const [outcomeClientId, setOutcomeClientId] = useState("");
  const [outcomeTarget, setOutcomeTarget] = useState("");
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [checkInNotes, setCheckInNotes] = useState("");
  const [checkInResult, setCheckInResult] = useState<any>(null);

  // Forms
  const [formName, setFormName] = useState(""); const [formEmail, setFormEmail] = useState(""); const [formCompany, setFormCompany] = useState(""); const [formPhone, setFormPhone] = useState(""); const [formNotes, setFormNotes] = useState(""); const [formSource] = useState("manual");
  const [invItems, setInvItems] = useState<any[]>([{ description: "", qty: 1, rate_cents: 0 }]); const [invDue, setInvDue] = useState(""); const [invClientId, setInvClientId] = useState("");
  const [screenText, setScreenText] = useState(""); const [screenResult, setScreenResult] = useState<any>(null); const [screening, setScreening] = useState(false);
  const [screenHistory, setScreenHistory] = useState<any[]>([]);
  // Project form
  const [projName, setProjName] = useState(""); const [projDesc, setProjDesc] = useState(""); const [projClientId, setProjClientId] = useState(""); const [projValue, setProjValue] = useState(""); const [projDue, setProjDue] = useState("");

  const api = async (action: string, extra: any = {}) => {
    const res = await fetch("/api/z/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, ...extra }) });
    return res.json();
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cl, inv, dash, proj, trend, outcomeRes] = await Promise.all([
      api("clients-list"), api("invoices-list"),
      api("dashboard"), api("projects-list"),
      api("revenue-trend", { months: 12 }).catch(() => null),
      api("outcome-list").catch(() => ({ outcomes: [] })),
    ]);
    setClients(cl.clients || []); setInvoices(inv.invoices || []); setStats(dash); setProjects(proj.projects || []);
    if (trend && !trend.error) setRevenueTrend(trend);
    setOutcomes(outcomeRes.outcomes || []);
    api("invoices-process-recurring").catch(() => {});
    api("auto-mark-overdue").catch(() => {});
    setLoading(false);
  }, [userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const addClient = async () => {
    if (!formName.trim()) return;
    await api("clients-create", { name: formName, email: formEmail, company: formCompany, phone: formPhone, notes: formNotes, source: formSource });
    setFormName(""); setFormEmail(""); setFormCompany(""); setFormPhone(""); setFormNotes(""); setShowAddClient(false);
    loadAll();
  };

  const updateClientStatus = async (id: string, status: string) => { await api("clients-update", { clientId: id, status }); loadAll(); };
  const deleteClient = async (id: string) => { if (confirm("Delete this client and all their invoices/contracts?")) { await api("clients-delete", { clientId: id }); setSelectedClient(null); setEditingClient(null); loadAll(); } };

  const saveEditClient = async () => {
    if (!editingClient) return;
    await api("clients-update", { clientId: editingClient.id, name: editingClient.name, email: editingClient.email, company: editingClient.company, phone: editingClient.phone, notes: editingClient.notes });
    setEditingClient(null); loadAll();
  };

  const deleteInvoice = async (id: string) => { if (confirm("Delete this invoice?")) { await api("invoices-update", { invoiceId: id, status: "cancelled" }); loadAll(); } };
  const markInvoiceUnpaid = async (id: string) => { await api("invoices-update", { invoiceId: id, status: "sent", paid_date: null }); loadAll(); };

  const createInvoice = async () => {
    if (!invClientId || invItems.every(i => !i.description)) return;
    const items = invItems.map(i => ({ ...i, amount_cents: i.qty * i.rate_cents }));
    await api("invoices-create", { clientId: invClientId, items, dueDate: invDue || undefined });
    setInvItems([{ description: "", qty: 1, rate_cents: 0 }]); setInvDue(""); setShowAddInvoice(false);
    loadAll();
  };

  const markInvoicePaid = async (id: string) => { await api("invoices-update", { invoiceId: id, status: "paid", paid_date: new Date().toISOString().slice(0, 10) }); loadAll(); };
  const sendInvoiceReminder = async (inv: Invoice) => {
    const data = await api("followups-generate", { clientId: inv.client_id, invoiceId: inv.id, type: "payment" });
    if (data.subject && data.body) {
      const mailto = `mailto:${inv.crm_clients?.email || ""}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(data.body)}`;
      window.open(mailto, "_blank");
      await api("invoices-update", { invoiceId: inv.id, reminder_count: inv.reminder_count + 1 });
      loadAll();
    }
  };

  // FIXED: Contracts are gone as a feature entirely now, not just AI
  // generation. An earlier pass kept a manual-tracking replacement (title,
  // status, paste-your-own-text) reasoning it was lower-risk than
  // AI-written content — but that wasn't asked for, so it's removed too.
  // If contract tracking is wanted later, it can be added back deliberately
  // rather than carried over by default.

  const screenClient = async () => {
    if (!screenText.trim()) return;
    setScreening(true); setScreenResult(null);
    const data = await api("screen-client", { description: screenText });
    setScreenResult(data);
    setScreenHistory(prev => [{ id: Date.now().toString(), text: screenText.slice(0, 80), ...data, date: new Date().toISOString() }, ...prev]);
    setScreening(false);
  };
  const deleteScreen = (id: string) => { setScreenHistory(prev => prev.filter(s => s.id !== id)); };

  const tabItems = [
    { id: "dashboard", label: "Dashboard" },
    { id: "clients", label: "Clients" },
    { id: "invoices", label: "Invoices" },
    { id: "projects", label: "Projects" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9600, background: C.bg, display: "flex", flexDirection: "column", overflow: "hidden", opacity: mounted ? 1 : 0, transition: `opacity 300ms ${EASE}` }}>
      <style>{`
        @keyframes cr-fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes cr-spin{to{transform:rotate(360deg)}}

        .cr-btn{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer}
        .cr-btn:hover{background:rgba(255,255,255,0.05)!important}
        .cr-btn:disabled{opacity:0.5!important;cursor:not-allowed!important}
        .cr-btn-accent{transition:filter 150ms ${EASE},transform 100ms ${EASE};cursor:pointer}
        .cr-btn-accent:hover{filter:brightness(1.1)}
        .cr-btn-accent:active{transform:scale(0.98)}
        .cr-btn-accent:disabled{opacity:0.5!important;cursor:not-allowed!important;filter:none!important}
        .cr-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
        .cr-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}

        .cr-tab{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .cr-tab:hover{background:rgba(255,255,255,0.04)}
        .cr-tab.cr-tab-active,.cr-tab.cr-tab-active:hover{background:rgba(255,255,255,0.07)}

        .cr-card{transition:border-color 150ms ${EASE}}
        .cr-card:hover{border-color:${C.borderHover}}

        .cr-input{padding:10px 14px;border-radius:10px;border:1px solid ${C.border};background:${C.bgInput};color:${C.text};font-size:13px;font-family:inherit;outline:none;transition:border-color 150ms ${EASE}}
        .cr-input:focus{border-color:${C.accent}}
        .cr-input::placeholder{color:${C.textMuted}}
        select.cr-input{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:32px}
        select.cr-input option{background:${C.bgElevated};color:${C.text}}

        .cr-gs::-webkit-scrollbar{width:5px}
        .cr-gs::-webkit-scrollbar-track{background:transparent}
        .cr-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .cr-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

        /* Same height and rule as every other panel's top bar. Grid
           (1fr auto 1fr) centers tabs on the true page center. */
        .cr-header{height:52px;padding:0 14px 0 20px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid ${C.border}}
        .cr-header-title{display:flex;align-items:center;gap:8px}
        .cr-close{justify-self:end}

        @media(max-width:768px){
          .cr-header{height:auto;padding:10px 10px 10px 16px;grid-template-columns:1fr auto;grid-template-areas:"title close" "tabs tabs";row-gap:8px}
          .cr-header-title{grid-area:title}
          .cr-close{grid-area:close}
          .cr-tabs{grid-area:tabs;justify-self:start;overflow-x:auto}
          .cr-content{padding:14px!important}
          .cr-stat-grid{grid-template-columns:1fr 1fr!important}
          .cr-dual-grid{grid-template-columns:1fr!important}
          .cr-input{font-size:16px!important;padding:12px 14px!important}
          .cr-new-form{grid-template-columns:1fr!important}
        }
        @media(max-width:480px){
          .cr-stat-grid{grid-template-columns:1fr!important}
          .cr-content{padding:10px!important}
        }
        @supports(padding-bottom:env(safe-area-inset-bottom)){.cr-content{padding-bottom:calc(14px + env(safe-area-inset-bottom))!important}}
      `}</style>

      {/* Header */}
      <div className="cr-header">
        <div className="cr-header-title">
          <ClientsIcon size={16} color="#3B82F6" />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Clients</span>
        </div>
        <div className="cr-tabs" style={{ display: "flex", gap: 2 }}>
          {tabItems.map(t => (
            <button key={t.id} className={tab === t.id ? "cr-tab cr-tab-active" : "cr-tab"} onClick={() => setTab(t.id as any)} style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500,
              color: tab === t.id ? C.text : C.textSec, whiteSpace: "nowrap",
            }}>{t.label}</button>
          ))}
        </div>
        <button className="cr-btn-icon cr-close" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32, border: "none", background: "none", color: C.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={17} /></button>
      </div>

      {/* Content */}
      <div className="cr-gs cr-content" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "cr-spin 0.8s linear infinite" }} />
          </div>
        ) : tab === "dashboard" ? (
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            {/* Stats — consistent treatment, no per-card color. These are
                metrics, not statuses. */}
            <div className="cr-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total Revenue", value: fmtShort(stats?.totalRevenue || 0) },
                { label: "Outstanding", value: fmtShort(stats?.totalOutstanding || 0) },
                { label: "Est. MRR", value: fmtShort(stats?.estimatedMRR || 0) },
                { label: "Active Clients", value: String(stats?.activeClients || 0) },
              ].map((s, i) => (
                <div key={i} className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, animation: `cr-fadeUp 300ms ${EASE} ${i * 40}ms both` }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: C.text, letterSpacing: "-0.02em" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Pipeline + Invoice Status */}
            <div className="cr-dual-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, animation: `cr-fadeUp 300ms ${EASE} 140ms both` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>Pipeline</div>
                {["lead", "prospect", "active", "completed"].map((s, i) => {
                  const count = clients.filter(c => c.status === s).length;
                  const total = clients.length || 1;
                  return (
                    <div key={s} style={{ marginBottom: i < 3 ? 12 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.textSec, textTransform: "capitalize" }}>{s}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{count}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 999, background: C.bgInput, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, width: `${(count / total) * 100}%`, background: statusColor(s), transition: `width 800ms ${EASE}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, animation: `cr-fadeUp 300ms ${EASE} 180ms both` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>Invoice Status</div>
                {[
                  { label: "Paid", count: stats?.paidInvoices || 0, color: C.green },
                  { label: "Sent", count: invoices.filter(i => i.status === "sent").length, color: C.accent },
                  { label: "Overdue", count: stats?.overdueInvoices || 0, color: C.red },
                  { label: "Draft", count: invoices.filter(i => i.status === "draft").length, color: C.textMuted },
                ].map((s, i) => {
                  const total = (stats?.totalInvoices || 1);
                  return (
                    <div key={s.label} style={{ marginBottom: i < 3 ? 12 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: C.textSec }}>{s.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.count}</span>
                      </div>
                      <div style={{ height: 3, borderRadius: 999, background: C.bgInput, overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 999, width: `${(s.count / total) * 100}%`, background: s.color, transition: `width 800ms ${EASE}` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Revenue Trend */}
            {revenueTrend?.trend?.length > 0 && (
              <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: `cr-fadeUp 300ms ${EASE} 220ms both` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Revenue trend</div>
                    <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                      {revenueTrend.summary?.growthRate !== null && revenueTrend.summary?.growthRate !== undefined && (
                        <span style={{ color: revenueTrend.summary.growthRate >= 0 ? C.green : C.red, fontWeight: 600 }}>{revenueTrend.summary.growthRate >= 0 ? "+" : ""}{revenueTrend.summary.growthRate}% vs last month</span>
                      )}
                      {revenueTrend.summary?.avgMonthly > 0 && <span> · Avg {fmtShort(revenueTrend.summary.avgMonthly)}/mo</span>}
                    </div>
                  </div>
                  {revenueTrend.summary?.bestMonth && (
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Best month</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.green }}>{revenueTrend.summary.bestMonth.month} · {fmtShort(revenueTrend.summary.bestMonth.revenue)}</div>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, marginBottom: 12 }}>
                  {revenueTrend.trend.map((t: any, i: number) => {
                    const maxRev = Math.max(...revenueTrend.trend.map((x: any) => x.revenue), 1);
                    const h = Math.max(2, (t.revenue / maxRev) * 100);
                    const isLast = i === revenueTrend.trend.length - 1;
                    return (
                      <div key={t.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                        <div style={{ fontSize: 9, color: C.textMuted }}>{t.revenue > 0 ? fmtShort(t.revenue) : ""}</div>
                        <div style={{ width: "100%", height: h, borderRadius: 3, background: isLast ? C.green : C.accent, opacity: isLast ? 1 : 0.5, transition: `height 800ms ${EASE}` }} />
                        <div style={{ fontSize: 9, color: C.textMuted }}>{t.label}</div>
                      </div>
                    );
                  })}
                </div>
                {stats?.revenueMilestones?.next && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: C.bgInput, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 12, color: C.textSec }}>Next milestone: <span style={{ fontWeight: 600, color: C.accent }}>{stats.revenueMilestones.next.label}</span></div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 70, height: 3, borderRadius: 999, background: C.border, overflow: "hidden" }}><div style={{ height: "100%", width: `${stats.revenueMilestones.next.progress}%`, background: C.accent }} /></div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: C.accent }}>{stats.revenueMilestones.next.progress}%</span>
                    </div>
                  </div>
                )}
                {(stats?.revenueMilestones?.reached?.length ?? 0) > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                    {stats!.revenueMilestones!.reached!.map((m: string) => (
                      <span key={m} style={{ padding: "3px 10px", borderRadius: 999, background: `${C.green}12`, border: `1px solid ${C.green}25`, fontSize: 10, fontWeight: 600, color: C.green }}>{m}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Goal tracking */}
            <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: `cr-fadeUp 300ms ${EASE} 260ms both` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Goal tracking</div>
                <Btn variant="outlined" onClick={() => setShowAddOutcome(!showAddOutcome)}>{showAddOutcome ? "Cancel" : "+ New goal"}</Btn>
              </div>

              {showAddOutcome && (
                <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <Input value={outcomeGoal} onChange={(e: any) => setOutcomeGoal(e.target.value)} placeholder="Goal: e.g., Land 3 new clients at $2k+ each" style={{ marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                    <select className="cr-input" value={outcomeClientId} onChange={(e: any) => setOutcomeClientId(e.target.value)} style={{ flex: 1 }}>
                      <option value="">Link to client (optional)</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <Input value={outcomeTarget} onChange={(e: any) => setOutcomeTarget(e.target.value)} placeholder="Revenue target ($)" style={{ flex: 1 }} />
                  </div>
                  <Btn variant="accent" onClick={async () => {
                    if (!outcomeGoal.trim()) return;
                    await api("outcome-create", { goalDescription: outcomeGoal, clientId: outcomeClientId || undefined, targetRevenue: outcomeTarget ? Math.round(parseFloat(outcomeTarget) * 100) : undefined });
                    setOutcomeGoal(""); setOutcomeClientId(""); setOutcomeTarget(""); setShowAddOutcome(false); loadAll();
                  }}>Create goal with 30/60/90 day check-ins</Btn>
                </div>
              )}

              {outcomes.length === 0 && !showAddOutcome ? (
                <div style={{ textAlign: "center", padding: 24, color: C.textMuted, fontSize: 13 }}>No goals yet. Create one to track your progress with check-ins at 30, 60, and 90 days.</div>
              ) : outcomes.map((o: any, i: number) => {
                const checkpoints = o.checkpoints || [];
                const completed = checkpoints.filter((cp: any) => cp.status === "completed").length;
                const needsCheckIn = o.needsCheckIn;
                return (
                  <div key={o.id} style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderLeft: `2px solid ${needsCheckIn ? C.accent : o.status === "completed" ? C.green : C.border}`, borderRadius: 12, padding: 16, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{o.goal_description}</div>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>
                          {o.crm_clients?.name ? `${o.crm_clients.name} · ` : ""}Started {new Date(o.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {o.target_revenue_cents ? ` · Target ${fmt(o.target_revenue_cents)}` : ""}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: needsCheckIn ? C.accent : C.textMuted }}>{needsCheckIn ? "Check-in due" : `${completed}/${checkpoints.length} done`}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginBottom: needsCheckIn ? 12 : 0 }}>
                      {checkpoints.map((cp: any, ci: number) => (
                        <div key={ci} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: 999, background: cp.status === "completed" ? C.green : cp.status === "pending" && cp.date <= new Date().toISOString().slice(0, 10) ? C.accent : C.border }} />
                          <span style={{ fontSize: 10, color: cp.status === "completed" ? C.green : C.textMuted }}>Day {cp.day}</span>
                          {ci < checkpoints.length - 1 && <div style={{ width: 14, height: 1, background: C.border }} />}
                        </div>
                      ))}
                    </div>
                    {needsCheckIn && checkingIn !== o.id && (
                      <Btn variant="outlined" onClick={() => setCheckingIn(o.id)}>Do check-in (Day {o.nextCheckpoint?.day})</Btn>
                    )}
                    {checkingIn === o.id && (
                      <div style={{ marginTop: 10 }}>
                        <Input value={checkInNotes} onChange={(e: any) => setCheckInNotes(e.target.value)} placeholder="How's it going? What have you achieved?" style={{ marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <Btn variant="accent" onClick={async () => {
                            const res = await api("outcome-check", { outcomeId: o.id, checkpointDay: o.nextCheckpoint?.day, notes: checkInNotes });
                            setCheckInResult(res.analysis); setCheckInNotes(""); setCheckingIn(null); loadAll();
                          }}>Submit check-in</Btn>
                          <Btn onClick={() => { setCheckingIn(null); setCheckInNotes(""); }}>Cancel</Btn>
                        </div>
                      </div>
                    )}
                    {checkInResult && checkingIn === null && (
                      <div style={{ marginTop: 10, padding: 14, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: checkInResult.progress_rating === "on_track" || checkInResult.progress_rating === "ahead" ? C.green : checkInResult.progress_rating === "behind" ? C.amber : C.red, textTransform: "uppercase", letterSpacing: "0.05em" }}>{(checkInResult.progress_rating || "").replace("_", " ")}</span>
                          {checkInResult.adjusted_confidence && <span style={{ fontSize: 10, color: C.textMuted }}>· {checkInResult.adjusted_confidence}% confidence</span>}
                        </div>
                        <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, marginBottom: 8 }}>{checkInResult.analysis}</div>
                        {checkInResult.next_actions?.length > 0 && (
                          <div style={{ fontSize: 11, color: C.textMuted }}>{checkInResult.next_actions.map((a: string, ai: number) => <div key={ai} style={{ padding: "2px 0" }}>→ {a}</div>)}</div>
                        )}
                        <Btn onClick={() => setCheckInResult(null)} style={{ marginTop: 6, padding: "4px 10px", fontSize: 11 }}>Dismiss</Btn>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Recurring invoices */}
            <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: `cr-fadeUp 300ms ${EASE} 300ms both` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Recurring invoices</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>Auto-generate invoices on a schedule</div>
                </div>
                <Btn variant="outlined" onClick={() => setShowAddRecurring(!showAddRecurring)}>{showAddRecurring ? "Cancel" : "+ New recurring"}</Btn>
              </div>

              {showAddRecurring && (
                <div style={{ background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
                  <select className="cr-input" value={recClientId} onChange={(e: any) => setRecClientId(e.target.value)} style={{ marginBottom: 8, width: "100%" }}>
                    <option value="">Select client *</option>
                    {clients.filter(c => c.status === "active").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <select className="cr-input" value={recFreq} onChange={(e: any) => setRecFreq(e.target.value)} style={{ marginBottom: 8, width: "100%" }}>
                    <option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option>
                  </select>
                  {recItems.map((item: any, idx: number) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <Input value={item.description} onChange={(e: any) => { const u = [...recItems]; u[idx].description = e.target.value; setRecItems(u); }} placeholder="Service description" style={{ flex: 2 }} />
                      <Input type="number" value={item.rate_cents / 100 || ""} onChange={(e: any) => { const u = [...recItems]; u[idx].rate_cents = Math.round(parseFloat(e.target.value || "0") * 100); setRecItems(u); }} placeholder="$" style={{ flex: 1 }} />
                    </div>
                  ))}
                  <Btn variant="accent" onClick={async () => {
                    if (!recClientId || recItems.every((i: any) => !i.description)) return;
                    const items = recItems.map((i: any) => ({ ...i, qty: 1, amount_cents: i.rate_cents }));
                    await api("invoices-create-recurring", { clientId: recClientId, items, frequency: recFreq });
                    setRecItems([{ description: "", qty: 1, rate_cents: 0 }]); setRecClientId(""); setShowAddRecurring(false); loadAll();
                  }}>Create recurring invoice</Btn>
                </div>
              )}
              <div style={{ fontSize: 12, color: C.textMuted, textAlign: "center", padding: 10 }}>Recurring invoices auto-generate when they're due. Check the Invoices tab for generated invoices.</div>
            </div>

            {/* Client Screening */}
            <div className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, animation: `cr-fadeUp 300ms ${EASE} 340ms both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <SearchIcon size={15} color={C.accent} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>AI Client Screening</div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>Paste a message or project description to analyze for red flags</div>
                </div>
              </div>
              <textarea className="cr-input" value={screenText} onChange={e => setScreenText(e.target.value)} placeholder="e.g., 'We need a logo designed by tomorrow, budget is flexible...'" style={{ width: "100%", minHeight: 76, resize: "vertical", marginBottom: 10 }} />
              <Btn variant="accent" onClick={screenClient} disabled={screening || !screenText.trim()} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                {screening && <div style={{ width: 12, height: 12, borderRadius: 999, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "cr-spin 0.7s linear infinite" }} />}
                {screening ? "Analyzing…" : "Screen Client"}
              </Btn>

              {screenResult && (
                <div style={{ marginTop: 16, background: C.bgInput, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, animation: "cr-fadeUp 250ms ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${screenResult.score >= 70 ? C.green : screenResult.score >= 40 ? C.amber : C.red}15`, border: `1px solid ${screenResult.score >= 70 ? C.green : screenResult.score >= 40 ? C.amber : C.red}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: screenResult.score >= 70 ? C.green : screenResult.score >= 40 ? C.amber : C.red }}>{screenResult.score}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{screenResult.verdict}</div>
                      <div style={{ fontSize: 11, color: C.textMuted }}>{screenResult.risk_level ? `${screenResult.risk_level} risk` : "Client score"}</div>
                    </div>
                  </div>
                  {screenResult.flags?.length > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Red flags</div>{screenResult.flags.map((f: string, i: number) => <div key={i} style={{ fontSize: 12, color: C.textSec, padding: "2px 0" }}>{f}</div>)}</div>}
                  {screenResult.green_lights?.length > 0 && <div style={{ marginBottom: 10 }}><div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Green lights</div>{screenResult.green_lights.map((g: string, i: number) => <div key={i} style={{ fontSize: 12, color: C.textSec, padding: "2px 0" }}>{g}</div>)}</div>}
                  <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, marginTop: 8, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>{screenResult.recommendation}</div>

                  {screenResult.suggested_questions?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Ask the client</div>
                      {screenResult.suggested_questions.map((q: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, color: C.textSec, padding: "6px 10px", marginBottom: 4, borderRadius: 8, background: C.bg, border: `1px solid ${C.border}` }}>"{q}"</div>
                      ))}
                    </div>
                  )}
                  {screenResult.pricing_advice && (
                    <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Pricing strategy</div>
                      <div style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>{screenResult.pricing_advice}</div>
                    </div>
                  )}
                  {screenResult.contract_warnings?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Discuss with a lawyer before you sign</div>
                      {screenResult.contract_warnings.map((w: string, i: number) => <div key={i} style={{ fontSize: 12, color: C.textSec, padding: "2px 0" }}>{w}</div>)}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: C.textMuted, marginTop: 12, fontStyle: "italic" }}>AI analysis for informational purposes only. Use your own judgment.</div>
                  {screenResult.company_info && (
                    <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 12, color: screenResult.company_verified ? C.green : C.red, marginBottom: 4 }}>{screenResult.company_verified ? "Verified online" : "Not verified"}</div>
                      <div style={{ fontSize: 11, color: C.textSec, lineHeight: 1.5 }}>{screenResult.company_info}</div>
                    </div>
                  )}
                  <Btn onClick={() => { setScreenResult(null); setScreenText(""); }} style={{ marginTop: 8, padding: "4px 10px", fontSize: 11 }}>Clear</Btn>
                </div>
              )}

              {screenHistory.length > 0 && !screenResult && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Past screenings</div>
                  {screenHistory.map((s, i) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderRadius: 10, background: C.bgInput, border: `1px solid ${C.border}`, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 24, height: 24, borderRadius: 8, background: `${s.score >= 70 ? C.green : s.score >= 40 ? C.amber : C.red}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: s.score >= 70 ? C.green : s.score >= 40 ? C.amber : C.red, flexShrink: 0 }}>{s.score}</div>
                        <div style={{ fontSize: 12, color: C.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}...</div>
                      </div>
                      <button className="cr-btn-icon" onClick={() => deleteScreen(s.id)} style={{ border: "none", background: "none", color: C.textMuted, width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><XIcon size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : tab === "clients" ? (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
              <Btn variant="accent" onClick={() => setShowAddClient(!showAddClient)}>{showAddClient ? "Cancel" : "+ Add Client"}</Btn>
              {clients.length > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>}
            </div>

            {showAddClient && (
              <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: "cr-fadeUp 200ms ease" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>New Client</div>
                <div className="cr-new-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <Input placeholder="Name *" value={formName} onChange={(e: any) => setFormName(e.target.value)} />
                  <Input placeholder="Email" value={formEmail} onChange={(e: any) => setFormEmail(e.target.value)} />
                  <Input placeholder="Company" value={formCompany} onChange={(e: any) => setFormCompany(e.target.value)} />
                  <Input placeholder="Phone" value={formPhone} onChange={(e: any) => setFormPhone(e.target.value)} />
                </div>
                <textarea className="cr-input" placeholder="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ width: "100%", minHeight: 56, resize: "vertical", marginBottom: 12 }} />
                <Btn variant="accent" onClick={addClient}>Save Client</Btn>
              </div>
            )}

            {clients.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: C.text }}>No clients yet</h1>
                <p style={{ margin: "8px auto 0", fontSize: 13, color: C.textSec, maxWidth: 300 }}>Add your first client to start tracking your business relationships.</p>
              </div>
            ) : clients.map((c, i) => (
              <div key={c.id} className="cr-card" onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)} style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderLeft: `2px solid ${statusColor(c.status)}`, borderRadius: 14, padding: 18, marginBottom: 8, cursor: "pointer", animation: `cr-fadeUp 250ms ${EASE} ${i * 30}ms both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{c.company || c.email || "No details"} · <span style={{ textTransform: "capitalize" }}>{c.source}</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {c.value_cents > 0 && <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{fmt(c.value_cents)}</span>}
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 14, padding: 16, borderRadius: 12, background: C.bgInput, border: `1px solid ${C.border}` }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Status</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                      {["lead", "prospect", "active", "completed", "lost"].map(s => (
                        <button key={s} onClick={() => updateClientStatus(c.id, s)} className="cr-btn" style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${c.status === s ? statusColor(s) + "50" : C.border}`, background: c.status === s ? `${statusColor(s)}15` : "none", color: c.status === s ? statusColor(s) : C.textMuted, fontSize: 11, textTransform: "capitalize" }}>{s}</button>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Actions</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Btn variant="outlined" onClick={() => setEditingClient(editingClient?.id === c.id ? null : { ...c })}>{editingClient?.id === c.id ? "Cancel Edit" : "Edit Info"}</Btn>
                      <Btn variant="outlined" onClick={() => { setInvClientId(c.id); setShowAddInvoice(true); setTab("invoices"); }}>Create Invoice</Btn>
                      <Btn variant="danger" onClick={() => deleteClient(c.id)}>Delete</Btn>
                    </div>
                    {editingClient?.id === c.id && (
                      <div style={{ marginTop: 12, padding: 14, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>
                        <div className="cr-new-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <Input placeholder="Name" value={editingClient.name} onChange={(e: any) => setEditingClient({ ...editingClient, name: e.target.value })} />
                          <Input placeholder="Email" value={editingClient.email} onChange={(e: any) => setEditingClient({ ...editingClient, email: e.target.value })} />
                          <Input placeholder="Company" value={editingClient.company} onChange={(e: any) => setEditingClient({ ...editingClient, company: e.target.value })} />
                          <Input placeholder="Phone" value={editingClient.phone} onChange={(e: any) => setEditingClient({ ...editingClient, phone: e.target.value })} />
                        </div>
                        <textarea className="cr-input" placeholder="Notes" value={editingClient.notes || ""} onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })} style={{ width: "100%", minHeight: 48, resize: "vertical", marginBottom: 10 }} />
                        <Btn variant="accent" onClick={saveEditClient}>Save Changes</Btn>
                      </div>
                    )}
                    {c.notes && <div style={{ fontSize: 12, color: C.textSec, marginTop: 12, lineHeight: 1.6, padding: 12, borderRadius: 10, background: C.bg, border: `1px solid ${C.border}` }}>{c.notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "invoices" ? (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
              <Btn variant="accent" onClick={() => setShowAddInvoice(!showAddInvoice)}>{showAddInvoice ? "Cancel" : "+ Create Invoice"}</Btn>
              {invoices.length > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>}
            </div>

            {showAddInvoice && (
              <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: "cr-fadeUp 200ms ease" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>New Invoice</div>
                <select className="cr-input" value={invClientId} onChange={e => setInvClientId(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
                </select>
                {invItems.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <Input placeholder="Description" value={item.description} onChange={(e: any) => { const n = [...invItems]; n[idx].description = e.target.value; setInvItems(n); }} />
                    <Input placeholder="Qty" type="number" value={item.qty} onChange={(e: any) => { const n = [...invItems]; n[idx].qty = parseInt(e.target.value) || 1; setInvItems(n); }} />
                    <Input placeholder="Rate ($)" type="number" value={item.rate_cents / 100 || ""} onChange={(e: any) => { const n = [...invItems]; n[idx].rate_cents = Math.round(parseFloat(e.target.value || "0") * 100); setInvItems(n); }} />
                    <button className="cr-btn-icon" onClick={() => setInvItems(invItems.filter((_, i) => i !== idx))} style={{ width: 36, height: 36, border: "none", background: "none", color: C.textMuted, display: "flex", alignItems: "center", justifyContent: "center" }}><XIcon size={14} /></button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
                  <Btn variant="outlined" onClick={() => setInvItems([...invItems, { description: "", qty: 1, rate_cents: 0 }])}>+ Add Line</Btn>
                  <Input type="date" value={invDue} onChange={(e: any) => setInvDue(e.target.value)} style={{ width: 170 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>Total: {fmt(invItems.reduce((s, i) => s + i.qty * i.rate_cents, 0))}</div>
                  <Btn variant="accent" onClick={createInvoice}>Create Invoice</Btn>
                </div>
              </div>
            )}

            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: C.text }}>No invoices yet</h1>
                <p style={{ margin: "8px auto 0", fontSize: 13, color: C.textSec, maxWidth: 300 }}>Create your first invoice from the Clients tab or click above.</p>
              </div>
            ) : invoices.map((inv, i) => (
              <div key={inv.id} className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderLeft: `2px solid ${statusColor(inv.status)}`, borderRadius: 14, padding: 18, marginBottom: 8, animation: `cr-fadeUp 250ms ${EASE} ${i * 30}ms both` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{inv.invoice_number}</div>
                      <span style={{ fontSize: 12, color: C.textMuted }}>·</span>
                      <span style={{ fontSize: 13, color: C.textSec }}>{inv.crm_clients?.name || "Unknown"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{inv.due_date ? `Due ${inv.due_date}` : "No due date"} · {inv.items?.length || 0} item{(inv.items?.length || 0) !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{fmt(inv.amount_cents)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {inv.status !== "paid" && <Btn variant="outlined" onClick={() => markInvoicePaid(inv.id)}>Mark Paid</Btn>}
                  {inv.status === "paid" && <Btn variant="outlined" onClick={() => markInvoiceUnpaid(inv.id)}>Mark Unpaid</Btn>}
                  {(inv.status === "sent" || inv.status === "overdue") && <Btn variant="outlined" onClick={() => sendInvoiceReminder(inv)}>Send Reminder</Btn>}
                  <Btn variant="danger" onClick={() => deleteInvoice(inv.id)}>Delete</Btn>
                </div>
              </div>
            ))}
          </div>
        ) : tab === "projects" ? (
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 20 }}>
              <Btn variant="accent" onClick={() => setShowAddProject(!showAddProject)}>{showAddProject ? "Cancel" : "+ New Project"}</Btn>
              {projects.length > 0 && <span style={{ fontSize: 12, color: C.textMuted }}>{projects.filter(p => p.status === "active").length} active · {projects.length} total</span>}
            </div>

            {showAddProject && (
              <div style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 20, marginBottom: 16, animation: "cr-fadeUp 200ms ease" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>New Project</div>
                <div className="cr-new-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <Input placeholder="Project name *" value={projName} onChange={(e: any) => setProjName(e.target.value)} />
                  <select className="cr-input" value={projClientId} onChange={e => setProjClientId(e.target.value)}>
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` (${c.company})` : ""}</option>)}
                  </select>
                  <Input placeholder="Value ($)" value={projValue} onChange={(e: any) => setProjValue(e.target.value)} type="number" />
                  <Input placeholder="Due date" value={projDue} onChange={(e: any) => setProjDue(e.target.value)} type="date" />
                </div>
                <textarea className="cr-input" placeholder="Description / scope" value={projDesc} onChange={e => setProjDesc(e.target.value)} style={{ width: "100%", minHeight: 56, resize: "vertical", marginBottom: 12 }} />
                <Btn variant="accent" onClick={async () => {
                  if (!projName.trim()) return;
                  await api("projects-create", {
                    name: projName, description: projDesc, clientId: projClientId || null,
                    totalValueCents: Math.round(parseFloat(projValue || "0") * 100), dueDate: projDue || null,
                    milestones: [{ name: "Discovery / kickoff", done: false }, { name: "First draft", done: false }, { name: "Revisions", done: false }, { name: "Final delivery", done: false }],
                  });
                  setProjName(""); setProjDesc(""); setProjClientId(""); setProjValue(""); setProjDue(""); setShowAddProject(false); loadAll();
                }}>Create Project</Btn>
              </div>
            )}

            {projects.length === 0 ? (
              <div style={{ textAlign: "center", padding: "56px 20px" }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.03em", color: C.text }}>No projects yet</h1>
                <p style={{ margin: "8px auto 0", fontSize: 13, color: C.textSec, maxWidth: 320 }}>Create a project when you start work for a client. Track progress, milestones, and deadlines in one place.</p>
              </div>
            ) : projects.sort((a: any, b: any) => {
              const order: Record<string, number> = { active: 0, paused: 1, completed: 2, cancelled: 3 };
              return (order[a.status] || 9) - (order[b.status] || 9);
            }).map((proj: any, i: number) => {
              const daysLeft = proj.due_date ? Math.ceil((new Date(proj.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const isOverdue = daysLeft !== null && daysLeft < 0 && proj.status === "active";
              const isDueSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3 && proj.status === "active";
              const clientName = clients.find(c => c.id === proj.client_id)?.name || "";
              const milestones = proj.milestones || [];

              return (
                <div key={proj.id} className="cr-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderLeft: `2px solid ${proj.status === "completed" ? C.green : isOverdue ? C.red : isDueSoon ? C.amber : C.accent}`, borderRadius: 14, padding: 18, marginBottom: 8, animation: `cr-fadeUp 250ms ${EASE} ${i * 30}ms both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{proj.name}</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                        {clientName && `${clientName} · `}{proj.total_value_cents > 0 && `${fmt(proj.total_value_cents)} · `}
                        <span style={{ textTransform: "capitalize" }}>{proj.status}</span>
                        {daysLeft !== null && proj.status === "active" && (
                          <span style={{ color: isOverdue ? C.red : isDueSoon ? C.amber : C.textMuted }}>{isOverdue ? ` · ${Math.abs(daysLeft)} days overdue` : ` · ${daysLeft} days left`}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: proj.progress_percent >= 100 ? C.green : C.text }}>{proj.progress_percent || 0}%</div>
                  </div>

                  <div style={{ height: 4, borderRadius: 999, background: C.bgInput, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${proj.progress_percent || 0}%`, background: proj.progress_percent >= 100 ? C.green : isOverdue ? C.red : C.accent, transition: "width 0.3s ease" }} />
                  </div>

                  {milestones.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {milestones.map((m: any, mi: number) => (
                        <button key={mi} onClick={async () => {
                          const updated = [...milestones];
                          updated[mi] = { ...updated[mi], done: !updated[mi].done };
                          const progress = Math.round((updated.filter((x: any) => x.done).length / updated.length) * 100);
                          await api("projects-update", { projectId: proj.id, milestones: updated, progressPercent: progress, ...(progress >= 100 ? { status: "completed", completedAt: new Date().toISOString() } : {}) });
                          loadAll();
                        }} className="cr-btn" style={{ padding: "4px 12px", borderRadius: 999, background: m.done ? `${C.green}12` : "none", border: `1px solid ${m.done ? C.green + "40" : C.border}`, fontSize: 11, color: m.done ? C.green : C.textMuted, textDecoration: m.done ? "line-through" : "none" }}>{m.name}</button>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 8 }}>
                    {proj.status === "active" && (
                      <>
                        <Btn variant="outlined" onClick={async () => {
                          const newProgress = Math.min(100, (proj.progress_percent || 0) + 25);
                          await api("projects-update", { projectId: proj.id, progressPercent: newProgress, ...(newProgress >= 100 ? { status: "completed", completedAt: new Date().toISOString() } : {}) });
                          loadAll();
                        }}>+25%</Btn>
                        <Btn variant="outlined" onClick={async () => { await api("projects-update", { projectId: proj.id, status: "completed", progressPercent: 100, completedAt: new Date().toISOString() }); loadAll(); }}>Complete</Btn>
                        <Btn onClick={async () => { await api("projects-update", { projectId: proj.id, status: "paused" }); loadAll(); }}>Pause</Btn>
                      </>
                    )}
                    {proj.status === "paused" && <Btn variant="outlined" onClick={async () => { await api("projects-update", { projectId: proj.id, status: "active" }); loadAll(); }}>Resume</Btn>}
                    {proj.status === "completed" && <Btn variant="outlined" onClick={async () => { setInvClientId(proj.client_id); setShowAddInvoice(true); setTab("invoices"); }}>Create Invoice</Btn>}
                    <Btn variant="danger" onClick={async () => { if (confirm("Delete this project?")) { await api("projects-delete", { projectId: proj.id }); loadAll(); } }}>Delete</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}