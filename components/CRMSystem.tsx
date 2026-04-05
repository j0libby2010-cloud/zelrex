"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ──────────────────────────────────────────
interface Client { id: string; name: string; email: string; company: string; phone: string; source: string; status: string; value_cents: number; notes: string; tags: string[]; last_contacted_at: string | null; created_at: string; crm_invoices?: any[]; crm_contracts?: any[]; crm_followups?: any[]; }
interface Invoice { id: string; client_id: string; invoice_number: string; status: string; amount_cents: number; currency: string; due_date: string | null; paid_date: string | null; items: any[]; notes: string; sent_at: string | null; reminder_count: number; created_at: string; crm_clients?: { name: string; email: string; company: string }; }
interface Contract { id: string; client_id: string; title: string; status: string; type: string; content: string; amount_cents: number; created_at: string; crm_clients?: { name: string; email: string }; }
interface DashStats { totalClients: number; activeClients: number; totalRevenue: number; totalOutstanding: number; totalPending: number; totalInvoices: number; paidInvoices: number; overdueInvoices: number; activeContracts: number; estimatedMRR: number; }

/* ─── Design Tokens (consistent with Zelrex) ─────── */
const G = {
  bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6", accentSoft: "#5B9BF7", accentGlow: "rgba(59,130,246,0.12)",
  green: "#34D399", greenGlow: "rgba(52,211,153,0.10)",
  amber: "#FBBF24", amberGlow: "rgba(251,191,36,0.10)",
  purple: "#A78BFA", purpleGlow: "rgba(167,139,250,0.10)", red: "#F87171",
};
const EASE = "cubic-bezier(0.22,1,0.36,1)";

/* Apple Liquid Glass — layered depth, luminous edge, soft refraction */
const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`,
  boxShadow: "0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 -0.5px 0 0 rgba(255,255,255,0.02) inset, 0 1px 3px rgba(0,0,0,0.12), 0 8px 40px rgba(0,0,0,0.22)",
  borderRadius: 22,
};
const liquidPill: React.CSSProperties = { ...liquidGlass, borderRadius: 999, boxShadow: "0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 1px 2px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.14)" };

const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtShort = (c: number) => c >= 100000 ? `$${(c / 100000).toFixed(1)}k` : fmt(c);

const statusColor = (s: string) => ({ lead: G.amber, prospect: G.accent, active: G.green, completed: G.purple, lost: G.textMuted, draft: G.textMuted, sent: G.accent, paid: G.green, overdue: G.red, cancelled: G.textMuted, accepted: G.green, declined: G.red, expired: G.textMuted }[s] || G.textMuted);

/* shared subcomponents */
const StatusBadge = ({ status }: { status: string }) => (
  <span style={{ padding: "4px 12px", borderRadius: 999, background: `${statusColor(status)}12`, border: `0.5px solid ${statusColor(status)}28`, fontSize: 11, fontWeight: 600, color: statusColor(status), textTransform: "capitalize", letterSpacing: "0.01em" }}>{status}</span>
);
const GlassBtn = ({ children, color = G.textSec, bg, ...props }: any) => (
  <button {...props} className="crm-btn-glass" style={{ padding: "7px 16px", borderRadius: 12, border: `0.5px solid ${G.glassBorder}`, cursor: "pointer", background: bg || "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)", backdropFilter: "blur(20px) brightness(1.06)", WebkitBackdropFilter: "blur(20px) brightness(1.06)", color, fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", boxShadow: "0 0.5px 0 rgba(255,255,255,0.06) inset, 0 1px 3px rgba(0,0,0,0.08)", ...props.style }}>{children}</button>
);
const GlassInput = ({ style, ...props }: any) => (
  <input {...props} className="crm-input" style={{ width: "100%", ...style }} />
);

/* ─── Sliding Glass Pill Tabs ────────────────────── */
function CRMTabs({ items, active, onChange }: { items: { id: string; label: string }[]; active: string; onChange: (id: string) => void }) {
  const refs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [bubble, setBubble] = useState({ left: 0, width: 0 });
  useEffect(() => { const el = refs.current.get(active); if (el) setBubble({ left: el.offsetLeft, width: el.offsetWidth }); }, [active]);
  return (
    <div style={{ position: "relative", display: "inline-flex", gap: 2, padding: 3, ...liquidPill }}>
      <div style={{ position: "absolute", top: 3, left: bubble.left, width: bubble.width, height: "calc(100% - 6px)", borderRadius: 999, background: "linear-gradient(165deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)", backdropFilter: "blur(20px) brightness(1.3) saturate(1.4)", WebkitBackdropFilter: "blur(20px) brightness(1.3) saturate(1.4)", boxShadow: "0 0 0 0.5px rgba(255,255,255,0.12), 0 2px 8px rgba(0,0,0,0.1), inset 0 0.5px 0 rgba(255,255,255,0.2)", transition: `left 500ms ${EASE}, width 500ms ${EASE}`, zIndex: 0 }} />
      {items.map(t => (
        <button key={t.id} ref={el => { if (el) refs.current.set(t.id, el); }} onClick={() => onChange(t.id)} style={{ position: "relative", zIndex: 1, padding: "7px 16px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 600, letterSpacing: "-0.01em", color: active === t.id ? G.text : G.textMuted, transition: `color 400ms ${EASE}` }}>{t.label}</button>
      ))}
    </div>
  );
}

export function CRMSystem({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<"dashboard" | "clients" | "invoices" | "contracts">("dashboard");
  const [clients, setClients] = useState<Client[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showScreen, setShowScreen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [viewContract, setViewContract] = useState<Contract | null>(null);
  const [screenHistory, setScreenHistory] = useState<any[]>([]);

  // Forms
  const [formName, setFormName] = useState(""); const [formEmail, setFormEmail] = useState(""); const [formCompany, setFormCompany] = useState(""); const [formPhone, setFormPhone] = useState(""); const [formNotes, setFormNotes] = useState(""); const [formSource, setFormSource] = useState("manual");
  const [invItems, setInvItems] = useState<any[]>([{ description: "", qty: 1, rate_cents: 0 }]); const [invDue, setInvDue] = useState(""); const [invClientId, setInvClientId] = useState("");
  const [screenText, setScreenText] = useState(""); const [screenResult, setScreenResult] = useState<any>(null); const [screening, setScreening] = useState(false);
  const [generating, setGenerating] = useState(false);

  const api = async (action: string, extra: any = {}) => {
    const res = await fetch("/api/z/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, ...extra }) });
    return res.json();
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cl, inv, con, dash] = await Promise.all([api("clients-list"), api("invoices-list"), api("contracts-list"), api("dashboard")]);
    setClients(cl.clients || []); setInvoices(inv.invoices || []); setContracts(con.contracts || []); setStats(dash);
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

  const deleteContract = async (id: string) => { if (confirm("Delete this contract?")) { await api("contracts-update", { contractId: id, status: "expired" }); loadAll(); } };
  const markContractNotAccepted = async (id: string) => { await api("contracts-update", { contractId: id, status: "draft", accepted_at: null }); loadAll(); };

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

  const generateContract = async (clientId: string, type: "contract" | "proposal") => {
    setGenerating(true);
    const data = await api("contracts-generate", { clientId, type, description: "" });
    if (data.content) { await api("contracts-create", { clientId, title: data.title, content: data.content, type }); loadAll(); }
    setGenerating(false);
  };

  const sendContractEmail = async (contract: Contract) => {
    const client = clients.find(c => c.id === contract.client_id);
    const mailto = `mailto:${client?.email || ""}?subject=${encodeURIComponent(contract.title)}&body=${encodeURIComponent(contract.content.slice(0, 2000))}`;
    window.open(mailto, "_blank");
    await api("contracts-update", { contractId: contract.id, status: "sent", sent_at: new Date().toISOString() });
    loadAll();
  };

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
    { id: "contracts", label: "Contracts" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9600, background: "rgb(3,5,8)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes crmFadeUp{from{opacity:0;transform:translateY(12px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes crmSpin{to{transform:rotate(360deg)}}
        @keyframes crmPulse{0%,100%{opacity:0.4}50%{opacity:0.8}}
        .crm-card{position:relative;overflow:hidden;transition:all 500ms ${EASE};cursor:pointer}
        .crm-card::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(168deg,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.03) 20%,transparent 50%,transparent 65%,rgba(255,255,255,0.02) 82%,rgba(255,255,255,0.08) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.25),inset 0 -0.5px 0 rgba(255,255,255,0.03);transition:opacity 500ms ${EASE};pointer-events:none}
        .crm-card:hover{border-color:rgba(255,255,255,0.10)!important;transform:translateY(-2px);box-shadow:0 0.5px 0 rgba(255,255,255,0.06) inset,0 8px 40px rgba(0,0,0,0.28),0 2px 8px rgba(0,0,0,0.12)!important}
        .crm-card:hover::before{opacity:1}
        .crm-card:active{transform:translateY(0) scale(0.99);transition-duration:100ms}
        .crm-btn-glass{position:relative;overflow:hidden;transition:all 400ms ${EASE};cursor:pointer}
        .crm-btn-glass::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(160deg,rgba(255,255,255,0.2) 0%,rgba(255,255,255,0.04) 15%,transparent 42%,transparent 58%,rgba(255,255,255,0.03) 80%,rgba(255,255,255,0.1) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.4),inset 0 -0.5px 0 rgba(255,255,255,0.04);transition:opacity 400ms ${EASE};pointer-events:none}
        .crm-btn-glass:hover{transform:translateY(-0.5px)}
        .crm-btn-glass:hover::before{opacity:1}
        .crm-btn-glass:active{transform:scale(0.97);transition-duration:100ms}
        /* ─ Liquid glass close button ─ */
        .crm-close-btn{position:relative;overflow:hidden;transition:all 500ms ${EASE}!important;backdrop-filter:none;-webkit-backdrop-filter:none}
        .crm-close-btn::before{content:'';position:absolute;inset:0;border-radius:inherit;opacity:0;background:linear-gradient(160deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.04) 15%,transparent 42%,transparent 58%,rgba(255,255,255,0.03) 80%,rgba(255,255,255,0.12) 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,0.45),inset 0 -0.5px 0 rgba(255,255,255,0.04);transition:opacity 500ms ${EASE};pointer-events:none}
        .crm-close-btn::after{content:'';position:absolute;top:-50%;left:5%;width:90%;height:80%;border-radius:50%;background:radial-gradient(ellipse at 40% 25%,rgba(255,255,255,0.12) 0%,rgba(255,255,255,0.02) 35%,transparent 70%);opacity:0;transition:opacity 500ms ${EASE};pointer-events:none}
        .crm-close-btn:hover::before,.crm-close-btn:hover::after{opacity:1}
        .crm-close-btn:hover{background:rgba(255,255,255,0.05)!important;border-color:rgba(255,255,255,0.12)!important;backdrop-filter:blur(20px) brightness(1.22) saturate(1.6)!important;-webkit-backdrop-filter:blur(20px) brightness(1.22) saturate(1.6)!important;box-shadow:0 0 0 0.5px rgba(255,255,255,0.18),0 2px 8px rgba(0,0,0,0.08),0 8px 32px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.45)!important;transform:translateY(-0.5px)}
        .crm-close-btn:active{transform:scale(0.92) translateY(0)!important;transition-duration:120ms!important}
        .crm-input{width:100%;padding:11px 16px;border-radius:14px;border:0.5px solid ${G.glassBorder};background:rgba(255,255,255,0.025);backdrop-filter:blur(20px) brightness(1.04);-webkit-backdrop-filter:blur(20px) brightness(1.04);color:${G.text};font-size:13px;font-weight:500;font-family:inherit;outline:none;letter-spacing:-0.01em;transition:all 400ms ${EASE};box-shadow:0 0.5px 0 rgba(255,255,255,0.04) inset}
        .crm-input:focus{border-color:rgba(59,130,246,0.3);box-shadow:0 0 0 3px rgba(59,130,246,0.06),0 0 16px rgba(59,130,246,0.04)}
        .crm-input::placeholder{color:${G.textMuted};font-weight:400}
        select.crm-input{cursor:pointer;appearance:none;-webkit-appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px}
        select.crm-input option{background:#0D1320;color:${G.text};padding:8px;font-size:13px}
        select.crm-input:hover{border-color:rgba(255,255,255,0.10);background-color:rgba(255,255,255,0.035)}
        .crm-gs::-webkit-scrollbar{width:5px}.crm-gs::-webkit-scrollbar-track{background:transparent}.crm-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:999px}.crm-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.1)}
        @media(max-width:768px){
          .crm-header-inner{flex-direction:column!important;gap:12px!important}
          .crm-tabs-wrap{overflow-x:auto!important;-webkit-overflow-scrolling:touch;width:100%}
          .crm-tabs-wrap::-webkit-scrollbar{display:none}
          .crm-content{padding:14px!important}
          .crm-stat-grid{grid-template-columns:1fr 1fr!important}
          .crm-dual-grid{grid-template-columns:1fr!important}
          .crm-close-btn{position:absolute!important;top:14px!important;right:14px!important}
          .crm-header-wrap{padding:14px 16px!important}
          .crm-input{font-size:16px!important;padding:13px 16px!important;min-height:44px!important}
          .crm-invoice-grid{grid-template-columns:1fr!important;gap:8px!important}
          .crm-new-form{grid-template-columns:1fr!important}
          .crm-action-btns button{min-height:40px!important;font-size:12px!important}
          .crm-gs{-webkit-overflow-scrolling:touch!important}
        }
        @media(max-width:480px){.crm-stat-grid{grid-template-columns:1fr!important}}
        @supports(padding-bottom:env(safe-area-inset-bottom)){.crm-content{padding-bottom:calc(14px + env(safe-area-inset-bottom))!important}}
        @media(hover:none){
          .crm-btn-glass:active{transform:scale(0.95)!important;transition-duration:80ms!important}
          .crm-close-btn:active{transform:scale(0.90)!important;transition-duration:80ms!important}
        }
      `}</style>

      {/* ─── Header ──────────────────────────────────── */}
      <div className="crm-header-wrap" style={{ padding: "18px 28px", borderBottom: `0.5px solid ${G.glassBorder}`, position: "relative" }}>
        <div className="crm-header-inner" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 14, background: `linear-gradient(135deg, ${G.accent}20, ${G.accent}08)`, border: `0.5px solid ${G.accent}25`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 20px ${G.accent}10` }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: G.text, letterSpacing: "-0.03em", lineHeight: 1.2 }}>Client Manager</div>
              <div style={{ fontSize: 12, color: G.textMuted, letterSpacing: "-0.01em", marginTop: 1 }}>Clients · Invoices · Contracts</div>
            </div>
          </div>
          <div className="crm-tabs-wrap" style={{ display: "flex" }}>
            <CRMTabs items={tabItems} active={tab} onChange={v => setTab(v as any)} />
          </div>
          <button className="crm-btn-glass crm-close-btn" onClick={onClose} style={{ width: 38, height: 38, borderRadius: 999, border: `0.5px solid ${G.glassBorder}`, background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)", backdropFilter: "blur(20px) brightness(1.06)", WebkitBackdropFilter: "blur(20px) brightness(1.06)", color: G.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0.5px 0 rgba(255,255,255,0.06) inset, 0 1px 3px rgba(0,0,0,0.08)" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────── */}
      <div className="crm-gs crm-content" style={{ flex: 1, overflow: "auto", padding: 28 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.accent, animation: "crmSpin 1s linear infinite", boxShadow: `0 0 20px ${G.accent}15` }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: G.textMuted, letterSpacing: "-0.01em" }}>Loading your CRM...</span>
          </div>
        ) : tab === "dashboard" ? (
          /* ─── DASHBOARD ────────────────────────── */
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            {/* Stats Grid */}
            <div className="crm-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Total Revenue", value: fmtShort(stats?.totalRevenue || 0), color: G.green, icon: "↑" },
                { label: "Outstanding", value: fmtShort(stats?.totalOutstanding || 0), color: G.red, icon: "!" },
                { label: "Est. MRR", value: fmtShort(stats?.estimatedMRR || 0), color: G.purple, icon: "∞" },
                { label: "Active Clients", value: String(stats?.activeClients || 0), color: G.accent, icon: "◉" },
              ].map((s, i) => (
                <div key={i} className="crm-card" style={{ ...liquidGlass, padding: "20px 22px", animation: `crmFadeUp 400ms ${EASE} ${i * 60}ms both` }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                    <div style={{ width: 28, height: 28, borderRadius: 10, background: `${s.color}12`, border: `0.5px solid ${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: s.color }}>{s.icon}</div>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: G.text, letterSpacing: "-0.04em", lineHeight: 1 }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Pipeline + Invoice Status */}
            <div className="crm-dual-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
              <div style={{ ...liquidGlass, padding: 24, animation: `crmFadeUp 400ms ${EASE} 280ms both` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 18 }}>Pipeline</div>
                {["lead", "prospect", "active", "completed"].map((s, i) => {
                  const count = clients.filter(c => c.status === s).length;
                  const total = clients.length || 1;
                  return (
                    <div key={s} style={{ marginBottom: i < 3 ? 14 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 999, background: statusColor(s), boxShadow: `0 0 8px ${statusColor(s)}40` }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: G.textSec, textTransform: "capitalize" }}>{s}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{count}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${(count / total) * 100}%`, background: `linear-gradient(90deg, ${statusColor(s)}, ${statusColor(s)}88)`, transition: `width 800ms ${EASE}`, boxShadow: `0 0 8px ${statusColor(s)}30` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...liquidGlass, padding: 24, animation: `crmFadeUp 400ms ${EASE} 340ms both` }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 18 }}>Invoice Status</div>
                {[
                  { label: "Paid", count: stats?.paidInvoices || 0, color: G.green },
                  { label: "Sent", count: invoices.filter(i => i.status === "sent").length, color: G.accent },
                  { label: "Overdue", count: stats?.overdueInvoices || 0, color: G.red },
                  { label: "Draft", count: invoices.filter(i => i.status === "draft").length, color: G.textMuted },
                ].map((s, i) => {
                  const total = (stats?.totalInvoices || 1);
                  return (
                    <div key={s.label} style={{ marginBottom: i < 3 ? 14 : 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 999, background: s.color, boxShadow: `0 0 8px ${s.color}40` }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: G.textSec }}>{s.label}</span>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{s.count}</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 2, width: `${(s.count / total) * 100}%`, background: `linear-gradient(90deg, ${s.color}, ${s.color}88)`, transition: `width 800ms ${EASE}`, boxShadow: `0 0 8px ${s.color}30` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Client Screening */}
            <div style={{ ...liquidGlass, padding: 24, animation: `crmFadeUp 400ms ${EASE} 400ms both` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: `${G.accent}12`, border: `0.5px solid ${G.accent}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.accent} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>AI Client Screening</div>
                  <div style={{ fontSize: 11, color: G.textMuted, marginTop: 1 }}>Paste a message or project description to analyze for red flags</div>
                </div>
              </div>
              <textarea className="crm-input" value={screenText} onChange={e => setScreenText(e.target.value)} placeholder="e.g., 'We need a logo designed by tomorrow, budget is flexible...'" style={{ minHeight: 80, resize: "vertical", marginBottom: 12, borderRadius: 16 }} />
              <GlassBtn onClick={screenClient} disabled={screening || !screenText.trim()} color={G.accent} bg={`${G.accent}15`} style={{ border: `0.5px solid ${G.accent}25`, opacity: screening ? 0.6 : 1 }}>
                {screening ? <><span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 999, border: "2px solid transparent", borderTopColor: G.accent, animation: "crmSpin 0.8s linear infinite", marginRight: 8, verticalAlign: "middle" }}/>Analyzing...</> : "Screen Client"}
              </GlassBtn>
              {screenResult && (
                <div style={{ marginTop: 18, ...liquidGlass, padding: 20, borderRadius: 18, animation: "crmFadeUp 300ms ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 48, height: 48, borderRadius: 16, background: `linear-gradient(135deg, ${screenResult.score >= 70 ? G.green : screenResult.score >= 40 ? G.amber : G.red}18, ${screenResult.score >= 70 ? G.green : screenResult.score >= 40 ? G.amber : G.red}06)`, border: `0.5px solid ${screenResult.score >= 70 ? G.green : screenResult.score >= 40 ? G.amber : G.red}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, letterSpacing: "-0.02em", color: screenResult.score >= 70 ? G.green : screenResult.score >= 40 ? G.amber : G.red }}>{screenResult.score}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>{screenResult.verdict}</div>
                      <div style={{ fontSize: 11, color: G.textMuted }}>Client Score</div>
                    </div>
                  </div>
                  {screenResult.flags?.length > 0 && <div style={{ marginBottom: 10 }}>{screenResult.flags.map((f: string, i: number) => <div key={i} style={{ fontSize: 12, color: G.red, padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10 }}>⚠</span>{f}</div>)}</div>}
                  {screenResult.green_lights?.length > 0 && <div style={{ marginBottom: 10 }}>{screenResult.green_lights.map((g: string, i: number) => <div key={i} style={{ fontSize: 12, color: G.green, padding: "3px 0", display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 10 }}>✓</span>{g}</div>)}</div>}
                  <div style={{ fontSize: 12, color: G.textSec, lineHeight: 1.7, marginTop: 10, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}` }}>{screenResult.recommendation}</div>
                  <div style={{ fontSize: 10, color: G.textMuted, marginTop: 10, fontStyle: "italic", opacity: 0.7 }}>AI analysis for informational purposes only.</div>
                  <GlassBtn onClick={() => { setScreenResult(null); setScreenText(""); }} color={G.textMuted} style={{ fontSize: 10, marginTop: 8 }}>Clear</GlassBtn>
                </div>
              )}

              {/* Screen History */}
              {screenHistory.length > 0 && !screenResult && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Past Screenings</div>
                  {screenHistory.map((s, i) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 12, background: "rgba(255,255,255,0.015)", border: `0.5px solid ${G.glassBorder}`, marginBottom: 6, animation: `crmFadeUp 200ms ${EASE} ${i * 30}ms both` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: `${s.score >= 70 ? G.green : s.score >= 40 ? G.amber : G.red}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: s.score >= 70 ? G.green : s.score >= 40 ? G.amber : G.red, flexShrink: 0 }}>{s.score}</div>
                        <div style={{ fontSize: 12, color: G.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}...</div>
                      </div>
                      <GlassBtn onClick={() => deleteScreen(s.id)} color={G.red} style={{ fontSize: 10, padding: "3px 8px" }}>×</GlassBtn>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : tab === "clients" ? (
          /* ─── CLIENTS ──────────────────────────── */
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 24, animation: `crmFadeUp 300ms ${EASE}` }}>
              <GlassBtn onClick={() => setShowAddClient(!showAddClient)} color={G.green} bg={`${G.green}12`} style={{ border: `0.5px solid ${G.green}25`, padding: "10px 22px", fontSize: 13, fontWeight: 700 }}>
                {showAddClient ? "Cancel" : "+ Add Client"}
              </GlassBtn>
              {clients.length > 0 && <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: G.textMuted, fontWeight: 500 }}>{clients.length} client{clients.length !== 1 ? "s" : ""}</span>}
            </div>

            {showAddClient && (
              <div style={{ ...liquidGlass, padding: 24, marginBottom: 20, animation: "crmFadeUp 300ms ease" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 16 }}>New Client</div>
                <div className="crm-new-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <GlassInput placeholder="Name *" value={formName} onChange={(e: any) => setFormName(e.target.value)} />
                  <GlassInput placeholder="Email" value={formEmail} onChange={(e: any) => setFormEmail(e.target.value)} />
                  <GlassInput placeholder="Company" value={formCompany} onChange={(e: any) => setFormCompany(e.target.value)} />
                  <GlassInput placeholder="Phone" value={formPhone} onChange={(e: any) => setFormPhone(e.target.value)} />
                </div>
                <textarea className="crm-input" placeholder="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ minHeight: 60, resize: "vertical", marginBottom: 14, borderRadius: 16 }} />
                <GlassBtn onClick={addClient} color={G.green} bg={`${G.green}12`} style={{ border: `0.5px solid ${G.green}25` }}>Save Client</GlassBtn>
              </div>
            )}

            {clients.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, animation: `crmFadeUp 400ms ${EASE}` }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.15 }}>◎</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 6 }}>No clients yet</div>
                <div style={{ fontSize: 13, color: G.textMuted, maxWidth: 280, margin: "0 auto", lineHeight: 1.5 }}>Add your first client to start tracking your business relationships.</div>
              </div>
            ) : clients.map((c, i) => (
              <div key={c.id} className="crm-card" onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)} style={{ ...liquidGlass, padding: "18px 22px", marginBottom: 10, animation: `crmFadeUp 350ms ${EASE} ${i * 40}ms both`, borderLeft: `3px solid ${statusColor(c.status)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 3, letterSpacing: "-0.01em" }}>{c.company || c.email || "No details"} · <span style={{ textTransform: "capitalize" }}>{c.source}</span></div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    {c.value_cents > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: G.green, letterSpacing: "-0.02em" }}>{fmt(c.value_cents)}</span>}
                    <StatusBadge status={c.status} />
                  </div>
                </div>
                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 16, padding: 18, borderRadius: 18, background: "rgba(255,255,255,0.015)", border: `0.5px solid ${G.glassBorder}`, animation: "crmFadeUp 250ms ease" }} onClick={e => e.stopPropagation()}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Status</div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                      {["lead", "prospect", "active", "completed", "lost"].map(s => (
                        <GlassBtn key={s} onClick={() => updateClientStatus(c.id, s)} color={c.status === s ? statusColor(s) : G.textMuted} bg={c.status === s ? `${statusColor(s)}12` : "transparent"} style={{ padding: "5px 14px", border: `0.5px solid ${c.status === s ? statusColor(s) + "35" : G.glassBorder}`, fontSize: 11, textTransform: "capitalize", borderRadius: 10 }}>{s}</GlassBtn>
                      ))}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>Actions</div>
                    <div className="crm-action-btns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <GlassBtn onClick={() => setEditingClient(editingClient?.id === c.id ? null : { ...c })} color={G.accent} style={{ fontSize: 11 }}>{editingClient?.id === c.id ? "Cancel Edit" : "Edit Info"}</GlassBtn>
                      <GlassBtn onClick={() => { setInvClientId(c.id); setShowAddInvoice(true); setTab("invoices"); }} color={G.accent} style={{ fontSize: 11 }}>Create Invoice</GlassBtn>
                      <GlassBtn onClick={() => generateContract(c.id, "contract")} disabled={generating} color={G.purple} style={{ fontSize: 11, opacity: generating ? 0.5 : 1 }}>{generating ? <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, border: "1.5px solid transparent", borderTopColor: G.purple, animation: "crmSpin 0.8s linear infinite", marginRight: 6, verticalAlign: "middle" }}/>Generating...</> : "Generate Contract"}</GlassBtn>
                      <GlassBtn onClick={() => generateContract(c.id, "proposal")} disabled={generating} color={G.amber} style={{ fontSize: 11, opacity: generating ? 0.5 : 1 }}>{generating ? <><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 999, border: "1.5px solid transparent", borderTopColor: G.amber, animation: "crmSpin 0.8s linear infinite", marginRight: 6, verticalAlign: "middle" }}/>Generating...</> : "Generate Proposal"}</GlassBtn>
                      <GlassBtn onClick={() => deleteClient(c.id)} color={G.red} style={{ fontSize: 11 }}>Delete</GlassBtn>
                    </div>

                    {/* Edit client form */}
                    {editingClient?.id === c.id && (
                      <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}`, animation: "crmFadeUp 200ms ease" }}>
                        <div className="crm-new-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                          <GlassInput placeholder="Name" value={editingClient.name} onChange={(e: any) => setEditingClient({ ...editingClient, name: e.target.value })} />
                          <GlassInput placeholder="Email" value={editingClient.email} onChange={(e: any) => setEditingClient({ ...editingClient, email: e.target.value })} />
                          <GlassInput placeholder="Company" value={editingClient.company} onChange={(e: any) => setEditingClient({ ...editingClient, company: e.target.value })} />
                          <GlassInput placeholder="Phone" value={editingClient.phone} onChange={(e: any) => setEditingClient({ ...editingClient, phone: e.target.value })} />
                        </div>
                        <textarea className="crm-input" placeholder="Notes" value={editingClient.notes || ""} onChange={e => setEditingClient({ ...editingClient, notes: e.target.value })} style={{ minHeight: 50, resize: "vertical", marginBottom: 10, borderRadius: 14 }} />
                        <GlassBtn onClick={saveEditClient} color={G.green} bg={`${G.green}12`} style={{ border: `0.5px solid ${G.green}25` }}>Save Changes</GlassBtn>
                      </div>
                    )}
                    {c.notes && <div style={{ fontSize: 12, color: G.textSec, marginTop: 14, lineHeight: 1.6, padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.015)", border: `0.5px solid ${G.glassBorder}` }}>{c.notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "invoices" ? (
          /* ─── INVOICES ─────────────────────────── */
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 24, animation: `crmFadeUp 300ms ${EASE}` }}>
              <GlassBtn onClick={() => setShowAddInvoice(!showAddInvoice)} color={G.green} bg={`${G.green}12`} style={{ border: `0.5px solid ${G.green}25`, padding: "10px 22px", fontSize: 13, fontWeight: 700 }}>
                {showAddInvoice ? "Cancel" : "+ Create Invoice"}
              </GlassBtn>
              {invoices.length > 0 && <span style={{ display: "flex", alignItems: "center", fontSize: 12, color: G.textMuted, fontWeight: 500 }}>{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</span>}
            </div>

            {showAddInvoice && (
              <div style={{ ...liquidGlass, padding: 24, marginBottom: 20, animation: "crmFadeUp 300ms ease" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 16 }}>New Invoice</div>
                <select className="crm-input" value={invClientId} onChange={e => setInvClientId(e.target.value)} style={{ marginBottom: 14, cursor: "pointer", appearance: "none", WebkitAppearance: "none" as any, backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.35)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: 36 }}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
                </select>
                {invItems.map((item, idx) => (
                  <div key={idx} className="crm-invoice-grid" style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <GlassInput placeholder="Description" value={item.description} onChange={(e: any) => { const n = [...invItems]; n[idx].description = e.target.value; setInvItems(n); }} />
                    <GlassInput placeholder="Qty" type="number" value={item.qty} onChange={(e: any) => { const n = [...invItems]; n[idx].qty = parseInt(e.target.value) || 1; setInvItems(n); }} />
                    <GlassInput placeholder="Rate ($)" type="number" value={item.rate_cents / 100 || ""} onChange={(e: any) => { const n = [...invItems]; n[idx].rate_cents = Math.round(parseFloat(e.target.value || "0") * 100); setInvItems(n); }} />
                    <GlassBtn onClick={() => setInvItems(invItems.filter((_, i) => i !== idx))} color={G.red} style={{ width: 40, height: 40, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>×</GlassBtn>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
                  <GlassBtn onClick={() => setInvItems([...invItems, { description: "", qty: 1, rate_cents: 0 }])} color={G.textSec} style={{ fontSize: 11 }}>+ Add Line</GlassBtn>
                  <GlassInput type="date" placeholder="Due date" value={invDue} onChange={(e: any) => setInvDue(e.target.value)} style={{ width: 180 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 0", borderTop: `0.5px solid ${G.glassBorder}` }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: G.text, letterSpacing: "-0.03em" }}>Total: {fmt(invItems.reduce((s, i) => s + i.qty * i.rate_cents, 0))}</div>
                  <GlassBtn onClick={createInvoice} color={G.green} bg={`${G.green}12`} style={{ border: `0.5px solid ${G.green}25`, fontWeight: 700 }}>Create Invoice</GlassBtn>
                </div>
              </div>
            )}

            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, animation: `crmFadeUp 400ms ${EASE}` }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.15 }}>◈</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 6 }}>No invoices yet</div>
                <div style={{ fontSize: 13, color: G.textMuted, maxWidth: 280, margin: "0 auto", lineHeight: 1.5 }}>Create your first invoice from the Clients tab or click above.</div>
              </div>
            ) : invoices.map((inv, i) => (
              <div key={inv.id} className="crm-card" style={{ ...liquidGlass, padding: "18px 22px", marginBottom: 10, animation: `crmFadeUp 350ms ${EASE} ${i * 40}ms both`, borderLeft: `3px solid ${statusColor(inv.status)}`, cursor: "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>{inv.invoice_number}</div>
                      <span style={{ fontSize: 12, color: G.textMuted }}>—</span>
                      <span style={{ fontSize: 13, color: G.textSec, fontWeight: 500 }}>{inv.crm_clients?.name || "Unknown"}</span>
                    </div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 3 }}>{inv.due_date ? `Due ${inv.due_date}` : "No due date"} · {inv.items?.length || 0} item{(inv.items?.length || 0) !== 1 ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: G.text, letterSpacing: "-0.03em" }}>{fmt(inv.amount_cents)}</span>
                    <StatusBadge status={inv.status} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  {inv.status !== "paid" && <GlassBtn onClick={() => markInvoicePaid(inv.id)} color={G.green} bg={`${G.green}08`} style={{ border: `0.5px solid ${G.green}25`, fontSize: 11 }}>Mark Paid</GlassBtn>}
                  {inv.status === "paid" && <GlassBtn onClick={() => markInvoiceUnpaid(inv.id)} color={G.amber} bg={`${G.amber}08`} style={{ border: `0.5px solid ${G.amber}25`, fontSize: 11 }}>Mark Unpaid</GlassBtn>}
                  {(inv.status === "sent" || inv.status === "overdue") && <GlassBtn onClick={() => sendInvoiceReminder(inv)} color={G.amber} bg={`${G.amber}08`} style={{ border: `0.5px solid ${G.amber}25`, fontSize: 11 }}>Send Reminder</GlassBtn>}
                  <GlassBtn onClick={() => deleteInvoice(inv.id)} color={G.red} style={{ fontSize: 11 }}>Delete</GlassBtn>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── CONTRACTS ────────────────────────── */
          <div style={{ maxWidth: 860, margin: "0 auto" }}>
            {contracts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 80, animation: `crmFadeUp 400ms ${EASE}` }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.15 }}>◆</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em", marginBottom: 6 }}>No contracts yet</div>
                <div style={{ fontSize: 13, color: G.textMuted, maxWidth: 280, margin: "0 auto", lineHeight: 1.5 }}>Generate a contract or proposal from the Clients tab.</div>
              </div>
            ) : contracts.map((con, i) => (
              <div key={con.id} className="crm-card" style={{ ...liquidGlass, padding: "18px 22px", marginBottom: 10, animation: `crmFadeUp 350ms ${EASE} ${i * 40}ms both`, borderLeft: `3px solid ${statusColor(con.status)}`, cursor: "default" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>{con.title}</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 3 }}>{con.crm_clients?.name || "Unknown"} · <span style={{ textTransform: "capitalize" }}>{con.type}</span></div>
                  </div>
                  <StatusBadge status={con.status} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <GlassBtn onClick={() => setViewContract(viewContract?.id === con.id ? null : con)} color={G.textSec} style={{ fontSize: 11 }}>{viewContract?.id === con.id ? "Hide" : "View"}</GlassBtn>
                  {con.status === "draft" && <GlassBtn onClick={() => sendContractEmail(con)} color={G.accent} bg={`${G.accent}08`} style={{ border: `0.5px solid ${G.accent}25`, fontSize: 11 }}>Send to Client ↗</GlassBtn>}
                  <GlassBtn onClick={() => { navigator.clipboard.writeText(con.content); }} color={G.textSec} style={{ fontSize: 11 }}>Copy</GlassBtn>
                  {con.status === "sent" && <GlassBtn onClick={() => api("contracts-update", { contractId: con.id, status: "accepted", accepted_at: new Date().toISOString() }).then(loadAll)} color={G.green} bg={`${G.green}08`} style={{ border: `0.5px solid ${G.green}25`, fontSize: 11 }}>Mark Accepted</GlassBtn>}
                  {con.status === "accepted" && <GlassBtn onClick={() => markContractNotAccepted(con.id)} color={G.amber} bg={`${G.amber}08`} style={{ border: `0.5px solid ${G.amber}25`, fontSize: 11 }}>Mark Not Accepted</GlassBtn>}
                  <GlassBtn onClick={() => deleteContract(con.id)} color={G.red} style={{ fontSize: 11 }}>Delete</GlassBtn>
                </div>
                {viewContract?.id === con.id && (
                  <div style={{ marginTop: 14, padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.015)", border: `0.5px solid ${G.glassBorder}`, animation: "crmFadeUp 200ms ease", maxHeight: 400, overflowY: "auto" }}>
                    <pre style={{ fontSize: 12, color: G.textSec, lineHeight: 1.8, whiteSpace: "pre-wrap", wordWrap: "break-word", fontFamily: "-apple-system, 'SF Pro Text', 'Inter', sans-serif", margin: 0 }}>{con.content}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}