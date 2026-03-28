"use client";
import React, { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────
interface Client { id: string; name: string; email: string; company: string; phone: string; source: string; status: string; value_cents: number; notes: string; tags: string[]; last_contacted_at: string | null; created_at: string; crm_invoices?: any[]; crm_contracts?: any[]; crm_followups?: any[]; }
interface Invoice { id: string; client_id: string; invoice_number: string; status: string; amount_cents: number; currency: string; due_date: string | null; paid_date: string | null; items: any[]; notes: string; sent_at: string | null; reminder_count: number; created_at: string; crm_clients?: { name: string; email: string; company: string }; }
interface Contract { id: string; client_id: string; title: string; status: string; type: string; content: string; amount_cents: number; created_at: string; crm_clients?: { name: string; email: string }; }
interface DashStats { totalClients: number; activeClients: number; totalRevenue: number; totalOutstanding: number; totalPending: number; totalInvoices: number; paidInvoices: number; overdueInvoices: number; activeContracts: number; estimatedMRR: number; }

const G = { bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)", text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)", accent: "#3B82F6", accentGlow: "rgba(59,130,246,0.12)", green: "#34D399", greenGlow: "rgba(52,211,153,0.10)", amber: "#FBBF24", amberGlow: "rgba(251,191,36,0.10)", purple: "#A78BFA", purpleGlow: "rgba(167,139,250,0.10)", red: "#F87171" };
const EASE = "cubic-bezier(0.22,1,0.36,1)";
const glass: React.CSSProperties = { background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)", backdropFilter: "blur(64px) saturate(1.6)", WebkitBackdropFilter: "blur(64px) saturate(1.6)", border: `0.5px solid ${G.glassBorder}`, boxShadow: "0 0.5px 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.25)", borderRadius: 20 };
const fmt = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
const fmtShort = (c: number) => c >= 100000 ? `$${(c / 100000).toFixed(1)}k` : fmt(c);

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
  const deleteClient = async (id: string) => { if (confirm("Delete this client and all their invoices/contracts?")) { await api("clients-delete", { clientId: id }); setSelectedClient(null); loadAll(); } };

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
    setScreenResult(data); setScreening(false);
  };

  const statusColor = (s: string) => ({ lead: G.amber, prospect: G.accent, active: G.green, completed: G.purple, lost: G.textMuted, draft: G.textMuted, sent: G.accent, paid: G.green, overdue: G.red, cancelled: G.textMuted, accepted: G.green, declined: G.red, expired: G.textMuted }[s] || G.textMuted);

  const tabItems = [
    { id: "dashboard", icon: "◎", label: "Dashboard" },
    { id: "clients", icon: "◉", label: "Clients" },
    { id: "invoices", icon: "◈", label: "Invoices" },
    { id: "contracts", icon: "◆", label: "Contracts" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9600, background: "rgba(3,5,8,0.75)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .crm-card{transition:all 300ms ${EASE};cursor:pointer}
        .crm-card:hover{border-color:rgba(255,255,255,0.10)!important;transform:translateY(-1px)}
        .crm-btn{transition:all 300ms ${EASE};cursor:pointer;border-radius:999px;position:relative;overflow:hidden}
        .crm-btn:hover{transform:translateY(-0.5px);background:rgba(255,255,255,0.05)!important}
        .crm-btn:active{transform:scale(0.97);transition-duration:100ms}
        .crm-input{width:100%;padding:10px 14px;border-radius:12px;border:0.5px solid ${G.glassBorder};background:rgba(255,255,255,0.03);color:${G.text};font-size:13px;outline:none;transition:all 300ms ${EASE}}
        .crm-input:focus{border-color:rgba(59,130,246,0.3);box-shadow:0 0 0 3px rgba(59,130,246,0.06)}
        .crm-gs::-webkit-scrollbar{width:5px}.crm-gs::-webkit-scrollbar-track{background:transparent}.crm-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:999px}
        @media(max-width:768px){
          .crm-header{flex-direction:column!important;gap:10px!important;padding:12px 14px!important}
          .crm-tabs{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
          .crm-tabs::-webkit-scrollbar{display:none}
          .crm-content{padding:12px!important}
          .crm-stat-grid{grid-template-columns:1fr 1fr!important}
        }
        @media(max-width:480px){.crm-stat-grid{grid-template-columns:1fr!important}}
      `}</style>

      {/* Header */}
      <div className="crm-header" style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `0.5px solid ${G.glassBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: G.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16, color: G.accent }}>◎</span>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Client Manager</div>
            <div style={{ fontSize: 12, color: G.textMuted }}>Clients · Invoices · Contracts</div>
          </div>
        </div>
        <div className="crm-tabs" style={{ display: "flex", gap: 4, padding: 3, ...glass, borderRadius: 999 }}>
          {tabItems.map(t => (
            <button key={t.id} className="crm-btn" onClick={() => setTab(t.id as any)} style={{ padding: "6px 14px", border: "none", fontSize: 12, fontWeight: 600, background: tab === t.id ? `${G.accent}20` : "transparent", color: tab === t.id ? G.accent : G.textSec }}>{t.label}</button>
          ))}
        </div>
        <button className="crm-btn" onClick={onClose} style={{ width: 36, height: 36, border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
      </div>

      {/* Content */}
      <div className="crm-gs crm-content" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.accent, animation: "spin 1s linear infinite" }} />
          </div>
        ) : tab === "dashboard" ? (
          /* ─── DASHBOARD ────────────────────────── */
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div className="crm-stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total Revenue", value: fmtShort(stats?.totalRevenue || 0), color: G.green },
                { label: "Outstanding", value: fmtShort(stats?.totalOutstanding || 0), color: G.red },
                { label: "Est. MRR", value: fmtShort(stats?.estimatedMRR || 0), color: G.purple },
                { label: "Active Clients", value: stats?.activeClients || 0, color: G.accent },
              ].map((s, i) => (
                <div key={i} style={{ ...glass, padding: "16px 18px", animation: `fadeUp 280ms ${EASE} ${i * 50}ms both` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
              <div style={{ ...glass, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12 }}>Pipeline</div>
                {["lead", "prospect", "active", "completed"].map(s => {
                  const count = clients.filter(c => c.status === s).length;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: 999, background: statusColor(s) }} />
                        <span style={{ fontSize: 12, color: G.textSec, textTransform: "capitalize" }}>{s}</span>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{count}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ ...glass, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 12 }}>Invoices</div>
                {[
                  { label: "Paid", count: stats?.paidInvoices || 0, color: G.green },
                  { label: "Sent", count: invoices.filter(i => i.status === "sent").length, color: G.accent },
                  { label: "Overdue", count: stats?.overdueInvoices || 0, color: G.red },
                  { label: "Draft", count: invoices.filter(i => i.status === "draft").length, color: G.textMuted },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 999, background: s.color }} />
                      <span style={{ fontSize: 12, color: G.textSec }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: G.text }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Client Screening */}
            <div style={{ ...glass, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 4 }}>Screen a Potential Client</div>
              <div style={{ fontSize: 11, color: G.textMuted, marginBottom: 12 }}>Paste a project description or client message to check for red flags</div>
              <textarea className="crm-input" value={screenText} onChange={e => setScreenText(e.target.value)} placeholder="e.g., 'We need a logo designed by tomorrow, budget is flexible, we'll know it when we see it...'" style={{ minHeight: 70, resize: "vertical", marginBottom: 10 }} />
              <button className="crm-btn" onClick={screenClient} disabled={screening || !screenText.trim()} style={{ padding: "8px 18px", border: "none", background: `${G.accent}20`, color: G.accent, fontSize: 12, fontWeight: 700, opacity: screening ? 0.5 : 1 }}>{screening ? "Analyzing..." : "Screen Client"}</button>
              {screenResult && (
                <div style={{ marginTop: 14, padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}`, animation: "fadeUp 200ms ease" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: screenResult.score >= 70 ? G.greenGlow : screenResult.score >= 40 ? G.amberGlow : "rgba(248,113,113,0.10)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: screenResult.score >= 70 ? G.green : screenResult.score >= 40 ? G.amber : G.red }}>{screenResult.score}</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{screenResult.verdict}</div>
                      <div style={{ fontSize: 11, color: G.textMuted }}>Client Score</div>
                    </div>
                  </div>
                  {screenResult.flags?.length > 0 && <div style={{ marginBottom: 8 }}>{screenResult.flags.map((f: string, i: number) => <div key={i} style={{ fontSize: 12, color: G.red, padding: "2px 0" }}>⚠ {f}</div>)}</div>}
                  {screenResult.green_lights?.length > 0 && <div style={{ marginBottom: 8 }}>{screenResult.green_lights.map((g: string, i: number) => <div key={i} style={{ fontSize: 12, color: G.green, padding: "2px 0" }}>✓ {g}</div>)}</div>}
                  <div style={{ fontSize: 12, color: G.textSec, lineHeight: 1.6, marginTop: 8, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.02)" }}>{screenResult.recommendation}</div>
                  <div style={{ fontSize: 10, color: G.textMuted, marginTop: 8, fontStyle: "italic" }}>AI analysis for informational purposes only. Use your professional judgment.</div>
                </div>
              )}
            </div>
          </div>
        ) : tab === "clients" ? (
          /* ─── CLIENTS ──────────────────────────── */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button className="crm-btn" onClick={() => setShowAddClient(!showAddClient)} style={{ padding: "10px 20px", border: "none", background: `${G.green}20`, color: G.green, fontSize: 13, fontWeight: 700 }}>{showAddClient ? "Cancel" : "+ Add Client"}</button>
            </div>

            {showAddClient && (
              <div style={{ ...glass, padding: 20, marginBottom: 16, animation: "fadeUp 200ms ease" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <input className="crm-input" placeholder="Name *" value={formName} onChange={e => setFormName(e.target.value)} />
                  <input className="crm-input" placeholder="Email" value={formEmail} onChange={e => setFormEmail(e.target.value)} />
                  <input className="crm-input" placeholder="Company" value={formCompany} onChange={e => setFormCompany(e.target.value)} />
                  <input className="crm-input" placeholder="Phone" value={formPhone} onChange={e => setFormPhone(e.target.value)} />
                </div>
                <textarea className="crm-input" placeholder="Notes" value={formNotes} onChange={e => setFormNotes(e.target.value)} style={{ minHeight: 50, resize: "vertical", marginBottom: 10 }} />
                <button className="crm-btn" onClick={addClient} style={{ padding: "8px 20px", border: "none", background: `${G.green}20`, color: G.green, fontSize: 12, fontWeight: 700 }}>Save Client</button>
              </div>
            )}

            {clients.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 8 }}>No clients yet</div>
                <div style={{ fontSize: 13 }}>Add your first client to start tracking your business relationships.</div>
              </div>
            ) : clients.map((c, i) => (
              <div key={c.id} className="crm-card" onClick={() => setSelectedClient(selectedClient?.id === c.id ? null : c)} style={{ ...glass, padding: 16, marginBottom: 8, animation: `fadeUp 250ms ${EASE} ${i * 30}ms both`, borderLeft: `3px solid ${statusColor(c.status)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{c.company || c.email || "No details"} · {c.source}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {c.value_cents > 0 && <span style={{ fontSize: 12, fontWeight: 700, color: G.green }}>{fmt(c.value_cents)}</span>}
                    <span style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(c.status)}15`, border: `0.5px solid ${statusColor(c.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(c.status), textTransform: "capitalize" }}>{c.status}</span>
                  </div>
                </div>
                {selectedClient?.id === c.id && (
                  <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: `0.5px solid ${G.glassBorder}`, animation: "fadeUp 200ms ease" }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                      {["lead", "prospect", "active", "completed", "lost"].map(s => (
                        <button key={s} className="crm-btn" onClick={() => updateClientStatus(c.id, s)} style={{ padding: "4px 10px", border: `0.5px solid ${c.status === s ? statusColor(s) + "40" : G.glassBorder}`, background: c.status === s ? `${statusColor(s)}15` : "transparent", color: c.status === s ? statusColor(s) : G.textMuted, fontSize: 11, fontWeight: 600, textTransform: "capitalize" }}>{s}</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button className="crm-btn" onClick={() => { setInvClientId(c.id); setShowAddInvoice(true); setTab("invoices"); }} style={{ padding: "6px 12px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, fontSize: 11, fontWeight: 600 }}>Create Invoice</button>
                      <button className="crm-btn" onClick={() => generateContract(c.id, "contract")} disabled={generating} style={{ padding: "6px 12px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, fontSize: 11, fontWeight: 600 }}>{generating ? "..." : "Generate Contract"}</button>
                      <button className="crm-btn" onClick={() => generateContract(c.id, "proposal")} disabled={generating} style={{ padding: "6px 12px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, fontSize: 11, fontWeight: 600 }}>{generating ? "..." : "Generate Proposal"}</button>
                      <button className="crm-btn" onClick={() => deleteClient(c.id)} style={{ padding: "6px 12px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.red, fontSize: 11, fontWeight: 600 }}>Delete</button>
                    </div>
                    {c.notes && <div style={{ fontSize: 12, color: G.textSec, marginTop: 8, lineHeight: 1.5 }}>{c.notes}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : tab === "invoices" ? (
          /* ─── INVOICES ─────────────────────────── */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
              <button className="crm-btn" onClick={() => setShowAddInvoice(!showAddInvoice)} style={{ padding: "10px 20px", border: "none", background: `${G.green}20`, color: G.green, fontSize: 13, fontWeight: 700 }}>{showAddInvoice ? "Cancel" : "+ Create Invoice"}</button>
            </div>

            {showAddInvoice && (
              <div style={{ ...glass, padding: 20, marginBottom: 16, animation: "fadeUp 200ms ease" }}>
                <select className="crm-input" value={invClientId} onChange={e => setInvClientId(e.target.value)} style={{ marginBottom: 10, cursor: "pointer" }}>
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ""}</option>)}
                </select>
                {invItems.map((item, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "3fr 1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                    <input className="crm-input" placeholder="Description" value={item.description} onChange={e => { const n = [...invItems]; n[idx].description = e.target.value; setInvItems(n); }} />
                    <input className="crm-input" placeholder="Qty" type="number" value={item.qty} onChange={e => { const n = [...invItems]; n[idx].qty = parseInt(e.target.value) || 1; setInvItems(n); }} />
                    <input className="crm-input" placeholder="Rate ($)" type="number" value={item.rate_cents / 100 || ""} onChange={e => { const n = [...invItems]; n[idx].rate_cents = Math.round(parseFloat(e.target.value || "0") * 100); setInvItems(n); }} />
                    <button className="crm-btn" onClick={() => setInvItems(invItems.filter((_, i) => i !== idx))} style={{ width: 36, height: 36, border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.red, fontSize: 14 }}>×</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button className="crm-btn" onClick={() => setInvItems([...invItems, { description: "", qty: 1, rate_cents: 0 }])} style={{ padding: "6px 14px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, fontSize: 11, fontWeight: 600 }}>+ Add Line</button>
                  <input className="crm-input" type="date" placeholder="Due date" value={invDue} onChange={e => setInvDue(e.target.value)} style={{ width: 160 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>Total: {fmt(invItems.reduce((s, i) => s + i.qty * i.rate_cents, 0))}</div>
                  <button className="crm-btn" onClick={createInvoice} style={{ padding: "8px 20px", border: "none", background: `${G.green}20`, color: G.green, fontSize: 12, fontWeight: 700 }}>Create Invoice</button>
                </div>
              </div>
            )}

            {invoices.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 8 }}>No invoices yet</div>
                <div style={{ fontSize: 13 }}>Create your first invoice from the Clients tab or click above.</div>
              </div>
            ) : invoices.map((inv, i) => (
              <div key={inv.id} style={{ ...glass, padding: 16, marginBottom: 8, animation: `fadeUp 250ms ${EASE} ${i * 30}ms both`, borderLeft: `3px solid ${statusColor(inv.status)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{inv.invoice_number} — {inv.crm_clients?.name || "Unknown"}</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{inv.due_date ? `Due ${inv.due_date}` : "No due date"} · {inv.items?.length || 0} items</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: G.text }}>{fmt(inv.amount_cents)}</span>
                    <span style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(inv.status)}15`, border: `0.5px solid ${statusColor(inv.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(inv.status), textTransform: "capitalize" }}>{inv.status}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {inv.status !== "paid" && <button className="crm-btn" onClick={() => markInvoicePaid(inv.id)} style={{ padding: "5px 12px", border: `0.5px solid ${G.green}30`, background: G.greenGlow, color: G.green, fontSize: 11, fontWeight: 700 }}>Mark Paid</button>}
                  {(inv.status === "sent" || inv.status === "overdue") && <button className="crm-btn" onClick={() => sendInvoiceReminder(inv)} style={{ padding: "5px 12px", border: `0.5px solid ${G.amber}30`, background: G.amberGlow, color: G.amber, fontSize: 11, fontWeight: 700 }}>Send Reminder</button>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ─── CONTRACTS ────────────────────────── */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            {contracts.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: G.textMuted }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: G.text, marginBottom: 8 }}>No contracts yet</div>
                <div style={{ fontSize: 13 }}>Generate a contract or proposal from the Clients tab.</div>
              </div>
            ) : contracts.map((con, i) => (
              <div key={con.id} style={{ ...glass, padding: 16, marginBottom: 8, animation: `fadeUp 250ms ${EASE} ${i * 30}ms both`, borderLeft: `3px solid ${statusColor(con.status)}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: G.text }}>{con.title}</div>
                    <div style={{ fontSize: 12, color: G.textMuted, marginTop: 2 }}>{con.crm_clients?.name || "Unknown"} · {con.type}</div>
                  </div>
                  <span style={{ padding: "3px 10px", borderRadius: 999, background: `${statusColor(con.status)}15`, border: `0.5px solid ${statusColor(con.status)}25`, fontSize: 11, fontWeight: 600, color: statusColor(con.status), textTransform: "capitalize" }}>{con.status}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {con.status === "draft" && <button className="crm-btn" onClick={() => sendContractEmail(con)} style={{ padding: "5px 12px", border: `0.5px solid ${G.accent}30`, background: G.accentGlow, color: G.accent, fontSize: 11, fontWeight: 700 }}>Send to Client ↗</button>}
                  <button className="crm-btn" onClick={() => { navigator.clipboard.writeText(con.content); }} style={{ padding: "5px 12px", border: `0.5px solid ${G.glassBorder}`, background: G.glass, color: G.textSec, fontSize: 11, fontWeight: 600 }}>Copy</button>
                  {con.status === "sent" && <button className="crm-btn" onClick={() => api("contracts-update", { contractId: con.id, status: "accepted", accepted_at: new Date().toISOString() }).then(loadAll)} style={{ padding: "5px 12px", border: `0.5px solid ${G.green}30`, background: G.greenGlow, color: G.green, fontSize: 11, fontWeight: 700 }}>Mark Accepted</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}