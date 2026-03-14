"use client";
import React, { useState, useEffect, useCallback } from "react";
import { AreaChart, Area, BarChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type TimeRange = "today" | "7d" | "30d" | "90d" | "365d";

interface AnalyticsData {
  timeRange: TimeRange;
  pageviews: number;
  uniqueVisitors: number;
  ctaClicks: number;
  checkoutStarts: number;
  conversionRate: number;
  checkoutRate: number;
  avgTimeOnPage: number;
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; count: number }[];
  deviceBreakdown: { device: string; count: number; pct: number }[];
  dailyData: { date: string; pageviews: number; visitors: number; clicks: number; checkouts: number }[];
  revenue: {
    total: number;
    count: number;
    avgOrder: number;
    byTier: { tier: string; total: number; count: number }[];
    dailyRevenue: { date: string; amount: number; count: number }[];
  };
}

const G = {
  bg: "#06090F",
  glass: "rgba(255,255,255,0.03)",
  glassBorder: "rgba(255,255,255,0.06)",
  text: "rgba(255,255,255,0.88)",
  textSec: "rgba(255,255,255,0.50)",
  textMuted: "rgba(255,255,255,0.28)",
  accent: "#4A90FF",
  accentGlow: "rgba(74,144,255,0.15)",
  green: "#10B981",
  greenGlow: "rgba(16,185,129,0.15)",
  amber: "#F59E0B",
  amberGlow: "rgba(245,158,11,0.15)",
  purple: "#8B5CF6",
  purpleGlow: "rgba(139,92,246,0.15)",
  chartLine1: "#4A90FF",
  chartLine2: "#10B981",
  chartLine3: "#F59E0B",
};

const PIE_COLORS = ["#4A90FF", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];

const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
  backdropFilter: "blur(40px) saturate(1.5)",
  WebkitBackdropFilter: "blur(40px) saturate(1.5)",
  border: `1px solid ${G.glassBorder}`,
  boxShadow: "0 8px 32px rgba(0,0,0,0.3), inset 0 0.5px 0 rgba(255,255,255,0.08)",
  borderRadius: 20,
};

const liquidPill: React.CSSProperties = { ...liquidGlass, borderRadius: 999 };

export function AnalyticsDashboard({ userId, onClose, deployed = false }: { userId: string; onClose: () => void; deployed?: boolean }) {
  const [range, setRange] = useState<TimeRange>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<"traffic" | "revenue">("traffic");

  const fetchData = useCallback(async () => {
    if (!deployed || !userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/z/px?action=dash&userId=${userId}&range=${range}`);
      if (res.ok) { const json = await res.json(); if (json.pageviews !== undefined) setData(json); }
    } catch (e) { console.error("[Analytics] Fetch failed:", e); }
    finally { setLoading(false); }
  }, [userId, range, deployed]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const ranges: { key: TimeRange; label: string }[] = [
    { key: "today", label: "Today" }, { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" }, { key: "90d", label: "90 Days" }, { key: "365d", label: "Year" },
  ];

  const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
  const fmtMoney = (c: number) => `$${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const fmtTime = (s: number) => s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: "rgba(3,5,8,0.94)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .z-stat:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(0,0,0,0.4),inset 0 0.5px 0 rgba(255,255,255,0.12)!important}
        .z-stat{transition:transform 200ms ease,box-shadow 200ms ease}
        .z-rb:hover{background:rgba(255,255,255,0.06)!important}
        .z-rb{transition:all 200ms ease}
        .z-ct{transition:all 200ms ease;cursor:pointer}
        .z-ct:hover{background:rgba(255,255,255,0.04)!important}
        .z-gs::-webkit-scrollbar{width:6px}
        .z-gs::-webkit-scrollbar-track{background:transparent}
        .z-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:999px}
      `}</style>

      {/* ─── Header ──────────────────────────────── */}
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${G.glassBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 12, background: G.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.4"/><path d="M8 14l2.5-3 2.5 1.5L16 9" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16" cy="9" r="1.5" fill={G.accent}/></svg>
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: G.text, letterSpacing: "-0.02em" }}>Analytics</div>
            <div style={{ fontSize: 12, color: G.textMuted, marginTop: 1 }}>Real-time website performance</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 3, ...liquidPill }}>
          {ranges.map(r => (
            <button key={r.key} className="z-rb" onClick={() => setRange(r.key)} style={{
              padding: "6px 14px", borderRadius: 999, border: "none", cursor: "pointer",
              background: range === r.key ? `linear-gradient(135deg, ${G.accent}25, ${G.accent}10)` : "transparent",
              color: range === r.key ? G.accent : G.textSec, fontSize: 12, fontWeight: 600,
              boxShadow: range === r.key ? `0 0 12px ${G.accent}20, inset 0 0.5px 0 rgba(255,255,255,0.1)` : "none",
            }}>{r.label}</button>
          ))}
        </div>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", color: G.textSec, cursor: "pointer", border: `1px solid ${G.glassBorder}`, background: G.glass }}>✕</button>
      </div>

      {/* ─── Content ─────────────────────────────── */}
      <div className="z-gs" style={{ flex: 1, overflow: "auto", padding: 20 }}>
        {!deployed ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec }}>
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px", background: `linear-gradient(135deg, ${G.purpleGlow}, transparent)`, border: `1px solid rgba(139,92,246,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.purple} strokeWidth="1.4"/><path d="M8 14l2.5-3 2.5 1.5L16 9" stroke={G.purple} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 8 }}>No business deployed yet</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>Build and deploy your website first. Once it's live, analytics will start tracking visitors, clicks, and revenue automatically.</div>
            </div>
          </div>
        ) : loading && !data ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 999, border: `2px solid ${G.glassBorder}`, borderTopColor: G.accent, animation: "spin 1s linear infinite", margin: "0 auto 12px" }}/>
              <div style={{ fontSize: 14 }}>Loading analytics...</div>
            </div>
          </div>
        ) : !data || data.pageviews === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec }}>
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, margin: "0 auto 20px", background: `linear-gradient(135deg, ${G.accentGlow}, transparent)`, border: `1px solid rgba(74,144,255,0.15)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.4"/><path d="M12 8v4M12 16h.01" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: G.text, marginBottom: 8 }}>No analytics data yet</div>
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>Your site is deployed but hasn't received any visitors yet. Share your URL to start collecting data.</div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Stat Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
              <StatCard label="Visitors" value={fmt(data.uniqueVisitors)} sub={`${fmt(data.pageviews)} pageviews`} color={G.accent} />
              <StatCard label="CTA Clicks" value={fmt(data.ctaClicks)} sub={`${data.conversionRate}% click rate`} color={G.green} />
              <StatCard label="Checkouts" value={fmt(data.checkoutStarts)} sub={`${data.checkoutRate}% checkout rate`} color={G.amber} />
              <StatCard label="Revenue" value={fmtMoney(data.revenue.total)} sub={`${data.revenue.count} payments`} color={G.purple} />
            </div>

            {/* Chart */}
            <div className="z-stat" style={{ ...liquidGlass, padding: 0, marginBottom: 20 }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${G.glassBorder}`, padding: "0 20px" }}>
                {(["traffic", "revenue"] as const).map(tab => (
                  <div key={tab} className="z-ct" onClick={() => setActiveChart(tab)} style={{
                    padding: "14px 20px", fontSize: 13, fontWeight: 600, textTransform: "capitalize",
                    color: activeChart === tab ? G.accent : G.textSec,
                    borderBottom: activeChart === tab ? `2px solid ${G.accent}` : "2px solid transparent",
                  }}>{tab}</div>
                ))}
              </div>
              <div style={{ padding: "20px 20px 10px", height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "traffic" ? (
                    <AreaChart data={data.dailyData}>
                      <defs>
                        <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={G.chartLine1} stopOpacity={0.3}/><stop offset="100%" stopColor={G.chartLine1} stopOpacity={0}/></linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={G.chartLine2} stopOpacity={0.2}/><stop offset="100%" stopColor={G.chartLine2} stopOpacity={0}/></linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: G.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }}/>
                      <YAxis tick={{ fill: G.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} width={40}/>
                      <Tooltip content={<ChartTooltip/>}/>
                      <Area type="monotone" dataKey="pageviews" stroke={G.chartLine1} strokeWidth={2} fill="url(#gV)" name="Pageviews" dot={false}/>
                      <Area type="monotone" dataKey="clicks" stroke={G.chartLine2} strokeWidth={2} fill="url(#gC)" name="CTA Clicks" dot={false}/>
                      <Line type="monotone" dataKey="checkouts" stroke={G.chartLine3} strokeWidth={2} name="Checkouts" dot={false} strokeDasharray="4 4"/>
                    </AreaChart>
                  ) : (
                    <BarChart data={data.revenue.dailyRevenue}>
                      <XAxis dataKey="date" tick={{ fill: G.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }}/>
                      <YAxis tick={{ fill: G.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} width={50} tickFormatter={v => `$${(v/100).toFixed(0)}`}/>
                      <Tooltip content={<RevTooltip/>}/>
                      <Bar dataKey="amount" fill={G.purple} radius={[6,6,0,0]} fillOpacity={0.8}/>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {activeChart === "traffic" && (
                <div style={{ display: "flex", gap: 20, padding: "0 20px 14px", justifyContent: "center" }}>
                  <Dot color={G.chartLine1} label="Pageviews"/><Dot color={G.chartLine2} label="CTA Clicks"/><Dot color={G.chartLine3} label="Checkouts" dashed/>
                </div>
              )}
            </div>

            {/* Bottom Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <Panel title="Top Pages" items={data.topPages.slice(0,6)} renderItem={(p:any,i:number) => (
                <Row key={i} left={<span style={{ fontFamily: "monospace" }}>{p.path}</span>} right={p.views} last={i===Math.min(data.topPages.length,6)-1}/>
              )} empty="No page data yet"/>
              <Panel title="Top Referrers" items={data.topReferrers.slice(0,6)} renderItem={(r:any,i:number) => (
                <Row key={i} left={r.referrer} right={r.count} last={i===Math.min(data.topReferrers.length,6)-1}/>
              )} empty="No referrer data yet"/>
              <div className="z-stat" style={{ ...liquidGlass, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 14 }}>Devices</div>
                {data.deviceBreakdown.length === 0 ? <div style={{ fontSize: 12, color: G.textMuted }}>No device data yet</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {data.deviceBreakdown.map((d,i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: G.textSec, textTransform: "capitalize" }}>{d.device}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{d.pct}%</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 999, background: G.glassBorder }}>
                          <div style={{ height: "100%", borderRadius: 999, width: `${d.pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], transition: "width 500ms ease" }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by Tier */}
            {data.revenue.byTier.length > 0 && (
              <div className="z-stat" style={{ ...liquidGlass, padding: 20, marginTop: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 14 }}>Revenue by Tier</div>
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.revenue.byTier.length, 4)}, 1fr)`, gap: 14 }}>
                  {data.revenue.byTier.map((t,i) => (
                    <div key={i} style={{ padding: 16, borderRadius: 14, background: `linear-gradient(135deg, ${PIE_COLORS[i%PIE_COLORS.length]}10, transparent)`, border: `1px solid ${PIE_COLORS[i%PIE_COLORS.length]}20` }}>
                      <div style={{ fontSize: 12, color: G.textSec, marginBottom: 6 }}>{t.tier}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{fmtMoney(t.total)}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 4 }}>{t.count} payments</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
              <div className="z-stat" style={{ ...liquidGlass, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: G.accentGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.4"/><path d="M12 6v6l4 2" stroke={G.accent} strokeWidth="1.6" strokeLinecap="round"/></svg>
                </div>
                <div><div style={{ fontSize: 12, color: G.textSec, marginBottom: 2 }}>Avg. Time on Page</div><div style={{ fontSize: 24, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{fmtTime(data.avgTimeOnPage)}</div></div>
              </div>
              <div className="z-stat" style={{ ...liquidGlass, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: data.revenue.count > 0 ? G.greenGlow : G.amberGlow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke={data.revenue.count > 0 ? G.green : G.amber} strokeWidth="1.4"/><path d="M2 10h20" stroke={data.revenue.count > 0 ? G.green : G.amber} strokeWidth="1.4"/></svg>
                </div>
                <div><div style={{ fontSize: 12, color: G.textSec, marginBottom: 2 }}>Avg. Order Value</div><div style={{ fontSize: 24, fontWeight: 800, color: G.text, letterSpacing: "-0.02em" }}>{data.revenue.count > 0 ? fmtMoney(data.revenue.avgOrder) : "—"}</div></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="z-stat" style={{ ...liquidGlass, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 8px ${color}60` }}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: G.textSec, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: G.text, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: G.textMuted, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

function Dot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: G.textSec }}>
      <div style={{ width: 16, height: 2, borderRadius: 999, background: dashed ? undefined : color, ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg,${color} 0px,${color} 4px,transparent 4px,transparent 8px)` } : {}) }}/>{label}
    </div>
  );
}

function Panel({ title, items, renderItem, empty }: { title: string; items: any[]; renderItem: (item: any, i: number) => React.ReactNode; empty: string }) {
  return (
    <div className="z-stat" style={{ ...liquidGlass, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: G.text, marginBottom: 14 }}>{title}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: G.textMuted }}>{empty}</div> : items.map(renderItem)}
    </div>
  );
}

function Row({ left, right, last }: { left: React.ReactNode; right: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: last ? "none" : `1px solid ${G.glassBorder}` }}>
      <span style={{ fontSize: 13, color: G.textSec }}>{left}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: G.text }}>{right as any}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...liquidGlass, padding: "10px 14px", fontSize: 12, borderRadius: 12 }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 6 }}>{label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: 999, background: p.color }}/><span style={{ color: G.textSec }}>{p.name}:</span><span style={{ fontWeight: 600, color: G.text }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...liquidGlass, padding: "10px 14px", fontSize: 12, borderRadius: 12 }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 6 }}>{label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</div>
      <div style={{ color: G.text, fontWeight: 700, fontSize: 16 }}>${((payload[0]?.value||0)/100).toFixed(2)}</div>
      <div style={{ color: G.textMuted, fontSize: 11, marginTop: 2 }}>{payload[0]?.payload?.count||0} payments</div>
    </div>
  );
}
