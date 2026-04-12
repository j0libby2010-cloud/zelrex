// @ts-nocheck
"use client";
import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";

const G = {
  bg: "#050709", glass: "rgba(255,255,255,0.025)", glassBorder: "rgba(255,255,255,0.055)",
  text: "rgba(255,255,255,0.92)", textSec: "rgba(255,255,255,0.52)", textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6", green: "#34D399", amber: "#FBBF24", red: "#F87171", purple: "#A78BFA",
};

const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)", WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`, borderRadius: 20,
  boxShadow: "0 0.5px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px rgba(0,0,0,0.4)",
};

const fmt = (n: number) => n >= 100000 ? `$${(n / 100000).toFixed(1)}k` : `$${(n / 100).toFixed(2)}`;

export default function AdminDashboard() {
  const { user } = useUser();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadHealth = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/z/health?userId=${user?.id}`);
      if (res.status === 401) { setError("Not authorized. Set ADMIN_USER_ID in Vercel env vars to your Clerk user ID."); setLoading(false); return; }
      const d = await res.json();
      setData(d);
      setLastRefresh(new Date());
    } catch (e: any) { setError(e?.message || "Failed to load"); }
    setLoading(false);
  };

  useEffect(() => { if (user?.id) loadHealth(); }, [user?.id]);

  if (!user) return <div style={{ minHeight: "100vh", background: G.bg, display: "flex", alignItems: "center", justifyContent: "center", color: G.textMuted }}>Loading...</div>;

  return (
    <div style={{ minHeight: "100vh", background: G.bg, color: G.text, fontFamily: "-apple-system, 'Inter', sans-serif", padding: "40px 24px" }}>
      <style>{`@keyframes aFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em" }}>Zelrex admin</h1>
            <div style={{ fontSize: 13, color: G.textMuted, marginTop: 4 }}>
              System health & reliability
              {lastRefresh && <span> · Updated {lastRefresh.toLocaleTimeString()}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={loadHealth} disabled={loading} style={{ padding: "8px 18px", borderRadius: 10, border: `1px solid ${G.glassBorder}`, background: "rgba(255,255,255,0.04)", color: G.textSec, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {loading ? "Loading..." : "Refresh"}
            </button>
            <a href="/chat" style={{ padding: "8px 18px", borderRadius: 10, background: G.accent, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>Back to Zelrex</a>
          </div>
        </div>

        {error && <div style={{ padding: "14px 18px", borderRadius: 14, background: `${G.red}08`, border: `1px solid ${G.red}20`, color: G.red, fontSize: 13, marginBottom: 24 }}>{error}</div>}

        {data && (
          <>
            {/* Status bar */}
            <div style={{ ...liquidGlass, padding: "16px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12, animation: "aFade 300ms ease" }}>
              <div style={{ width: 12, height: 12, borderRadius: 999, background: data.status === "operational" ? G.green : G.red, boxShadow: `0 0 10px ${data.status === "operational" ? G.green : G.red}50` }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: data.status === "operational" ? G.green : G.red, textTransform: "uppercase", letterSpacing: "0.04em" }}>{data.status}</span>
              <span style={{ fontSize: 12, color: G.textMuted, marginLeft: "auto" }}>{data.timestamp && new Date(data.timestamp).toLocaleString()}</span>
            </div>

            {/* Top stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total users", value: data.users?.total || 0, color: G.accent },
                { label: "Active (7d)", value: data.users?.activeThisWeek || 0, color: G.green },
                { label: "Chats today", value: data.chat?.chatsToday || 0, color: G.purple },
                { label: "Platform revenue", value: fmt(data.crm?.platformRevenue || 0), color: G.green },
              ].map((s, i) => (
                <div key={i} style={{ ...liquidGlass, padding: "18px 20px", animation: `aFade 300ms ease ${i * 60}ms both` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: G.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: G.text, letterSpacing: "-0.04em" }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Section cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {/* Websites & Deploys */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 200ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>Websites</div>
                <Row label="Built" value={data.websites?.totalBuilt || 0} />
                <Row label="Deployed" value={data.websites?.totalDeployed || 0} />
                <Row label="Deploy rate" value={data.websites?.totalBuilt > 0 ? `${Math.round((data.websites.totalDeployed / data.websites.totalBuilt) * 100)}%` : "—"} color={G.green} />
              </div>

              {/* CRM */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 260ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>CRM</div>
                <Row label="Total invoices" value={data.crm?.totalInvoices || 0} />
                <Row label="Paid invoices" value={data.crm?.paidInvoices || 0} color={G.green} />
                <Row label="Active outcomes" value={data.crm?.outcomes || 0} />
              </div>

              {/* Outreach */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 320ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>Outreach</div>
                <Row label="Prospects found" value={data.outreach?.totalProspects || 0} />
                <Row label="Emails sent" value={data.outreach?.emailsSent || 0} />
                <Row label="Replies" value={data.outreach?.emailsReplied || 0} color={G.green} />
                <Row label="Reply rate" value={`${data.outreach?.replyRate || 0}%`} color={data.outreach?.replyRate > 10 ? G.green : G.amber} />
              </div>

              {/* Memory & AI */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 380ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>Memory & AI</div>
                <Row label="Memory facts stored" value={data.memory?.totalFacts || 0} />
                <Row label="Auto summaries (30d)" value={data.summaries?.autoGenerated30d || 0} />
                <Row label="Manual summaries (30d)" value={data.summaries?.manualGenerated30d || 0} />
              </div>

              {/* Analytics */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 440ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>Analytics</div>
                <Row label="Events (7d)" value={(data.analytics?.eventsThisWeek || 0).toLocaleString()} />
                <Row label="Data points (7d)" value={data.analytics?.dataPointsThisWeek || 0} />
                <Row label="Total chats" value={(data.chat?.totalChats || 0).toLocaleString()} />
              </div>

              {/* Infrastructure */}
              <div style={{ ...liquidGlass, padding: 24, animation: "aFade 300ms ease 500ms both" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: G.text, marginBottom: 14 }}>Infrastructure</div>
                <CheckRow label="Database" ok={data.infrastructure?.database === "supabase"} />
                <CheckRow label="Memory system" ok={data.infrastructure?.memorySystem} />
                <CheckRow label="Stripe" ok={data.infrastructure?.stripeConnected} />
                <CheckRow label="Cron secret" ok={data.infrastructure?.cronSecret} />
                <CheckRow label="Admin configured" ok={data.infrastructure?.adminConfigured} />
                <Row label="Unread contact msgs" value={data.support?.unreadContactMessages || 0} color={data.support?.unreadContactMessages > 0 ? G.amber : G.textMuted} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `0.5px solid ${G.glassBorder}` }}>
      <span style={{ fontSize: 12, color: G.textSec }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || G.text, letterSpacing: "-0.02em" }}>{value}</span>
    </div>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `0.5px solid ${G.glassBorder}` }}>
      <span style={{ fontSize: 12, color: G.textSec }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: ok ? G.green : G.red }}>{ok ? "✓ Connected" : "✕ Missing"}</span>
    </div>
  );
}