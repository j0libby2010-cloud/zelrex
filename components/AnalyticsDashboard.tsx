"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
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
  funnel?: {
    stages: { name: string; count: number; pct: number }[];
    dropoffs: { from: string; to: string; lost: number; pct: number }[];
  };
  utmBreakdown?: { source: string; views: number; clicks: number; conversionRate: number }[];
  revenue: {
    total: number;
    count: number;
    avgOrder: number;
    byTier: { tier: string; total: number; count: number }[];
    dailyRevenue: { date: string; amount: number; count: number }[];
  };
}

/* Zelrex design tokens — mirrors the C object in ChatPageClient.tsx.
   Same values everywhere, so this panel reads as part of the same product
   rather than a separately-designed screen bolted on. */
const C = {
  bg: "#06090F", bgElevated: "#0D1320", bgInput: "#080D17",
  border: "rgba(255,255,255,0.07)", borderHover: "rgba(255,255,255,0.14)",
  accent: "#4A90FF", accentSoft: "rgba(74,144,255,0.08)",
  text: "rgba(255,255,255,0.88)", textSec: "rgba(255,255,255,0.50)", textMuted: "rgba(255,255,255,0.30)",
  green: "#10B981", red: "#EF4444",
};

// A single hue at decreasing strength for ranked/enumerable breakdowns
// (devices, pricing tiers, funnel stages) instead of a different color per
// item — the ranking reads through opacity, not a rainbow of hues.
const RANK_SHADES = [C.accent, "#4A90FFCC", "#4A90FF99", "#4A90FF66", "#4A90FF44"];

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/* Icons drawn to match the main interface's set (1.5 stroke, round caps) */
const XIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const ChartIcon = ({ size = 16, color = C.textMuted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M4 20V15M9.5 20V11M15 20V7M20 20V4" stroke={color} strokeWidth="1.6" strokeLinecap="round" /><circle cx="20" cy="4" r="1.15" fill={color} /></svg>
);
const ClockIcon = ({ size = 18, color = C.textMuted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" /><path d="M12 7v5l3.5 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" /></svg>
);
const CardIcon = ({ size = 18, color = C.textMuted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke={color} strokeWidth="1.5" /><path d="M2 10h20" stroke={color} strokeWidth="1.5" /></svg>
);
const ArrowDownIcon = ({ size = 12, color = C.textMuted }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12l7 7 7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

export function AnalyticsDashboard({ userId, onClose, deployed = false }: { userId: string; onClose: () => void; deployed?: boolean }) {
  const [range, setRange] = useState<TimeRange>("30d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChart, setActiveChart] = useState<"traffic" | "revenue">("traffic");
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);

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

  // Fill missing dates with zeros so the chart shows a continuous timeline
  const fillDateGaps = <T extends { date: string }>(rows: T[], defaults: Omit<T, "date">): T[] => {
    if (!rows || rows.length === 0) {
      const days = range === "today" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 90 : 365;
      const result: T[] = [];
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        result.push({ date: d.toISOString().slice(0, 10), ...defaults } as T);
      }
      return result;
    }
    const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    const start = new Date(sorted[0].date);
    const end = new Date();
    const map = new Map(sorted.map(r => [r.date, r]));
    const result: T[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      result.push(map.get(key) || { date: key, ...defaults } as T);
    }
    return result;
  };

  const chartDailyData = data ? fillDateGaps(data.dailyData, { pageviews: 0, visitors: 0, clicks: 0, checkouts: 0 } as any) : [];
  const chartRevenueData = data?.revenue?.dailyRevenue ? fillDateGaps(data.revenue.dailyRevenue, { amount: 0, count: 0 } as any) : [];

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9600,
      background: C.bg,
      display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: mounted ? 1 : 0,
      transition: `opacity 300ms ${EASE}`,
    }}>
      <style>{`
        @keyframes an-spin { to { transform: rotate(360deg) } }
        @keyframes an-fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes an-fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .an-btn{transition:background-color 150ms ${EASE},border-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent}
        .an-btn:hover{background:rgba(255,255,255,0.04)}
        .an-btn-icon{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;border-radius:999px}
        .an-btn-icon:hover{background:rgba(255,255,255,0.06)!important;color:${C.text}!important}
        .an-btn-icon:active{background:rgba(255,255,255,0.10)!important}

        .an-range{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .an-range:hover{background:rgba(255,255,255,0.04)}
        .an-range.an-range-active,.an-range.an-range-active:hover{background:rgba(255,255,255,0.07)}

        .an-tab{transition:background-color 150ms ${EASE},color 150ms ${EASE};cursor:pointer;background:transparent;border:none}
        .an-tab:hover{background:rgba(255,255,255,0.04)}
        .an-tab.an-tab-active,.an-tab.an-tab-active:hover{background:rgba(255,255,255,0.07)}

        .an-card{transition:border-color 150ms ${EASE}}
        .an-card:hover{border-color:${C.borderHover}}

        .an-row{transition:background-color 150ms ${EASE};border-radius:8px;margin:0 -8px;padding-left:8px!important;padding-right:8px!important}
        .an-row:hover{background:rgba(255,255,255,0.03)}

        .an-bar{transition:width 800ms ${EASE}}

        .an-gs::-webkit-scrollbar{width:5px}
        .an-gs::-webkit-scrollbar-track{background:transparent}
        .an-gs::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:999px}
        .an-gs::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.14)}

        /* Same height and rule as every other panel's top bar. Grid
           (1fr auto 1fr) centers the range pills on the true page center. */
        .an-header{height:52px;padding:0 14px 0 20px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:1px solid ${C.border}}
        .an-header-title{display:flex;align-items:center;gap:8px}
        .an-close{justify-self:end}

        @media (max-width: 768px) {
          .an-header { height: auto; padding: 10px 10px 10px 16px; grid-template-columns: 1fr auto; grid-template-areas: "title close" "ranges ranges"; row-gap: 8px; }
          .an-header-title { grid-area: title; }
          .an-close { grid-area: close; }
          .an-ranges { grid-area: ranges; justify-self: start; overflow-x: auto; }
          .an-stats-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .an-bottom-grid { grid-template-columns: 1fr !important; }
          .an-engagement-grid { grid-template-columns: 1fr !important; }
          .an-tier-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .an-gs { padding: 14px !important; }
          .an-chart-container { height: 240px !important; }
        }
        @media (max-width: 480px) {
          .an-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
          .an-tier-grid { grid-template-columns: 1fr !important; }
          .an-chart-container { height: 200px !important; }
        }
        @supports(padding-bottom: env(safe-area-inset-bottom)){
          .an-gs { padding-bottom: calc(14px + env(safe-area-inset-bottom)) !important; }
        }
      `}</style>

      {/* Header — bare icon + label, no subtitle, no tinted box, matching
          the main top bar and the sidebar's own Analytics item. */}
      <div className="an-header">
        <div className="an-header-title">
          <ChartIcon size={16} color="#8B5CF6" />
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, letterSpacing: "-0.01em" }}>Analytics</span>
        </div>

        <div className="an-ranges" style={{ display: "flex", gap: 2 }}>
          {ranges.map(r => (
            <button key={r.key} className={range === r.key ? "an-range an-range-active" : "an-range"} onClick={() => setRange(r.key)} style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 500,
              color: range === r.key ? C.text : C.textSec, whiteSpace: "nowrap",
            }}>{r.label}</button>
          ))}
        </div>

        <button className="an-btn-icon an-close" onClick={onClose} aria-label="Close" style={{
          width: 32, height: 32, border: "none", background: "none", color: C.textSec,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><XIcon size={17} /></button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="an-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {!deployed ? (
          <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: 380, animation: "an-fadeUp 300ms ease 80ms both" }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>No business deployed yet</h1>
              <p style={{ margin: "10px auto 0", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>
                Build and deploy your website first. Once it's live, analytics starts tracking visitors, clicks, and revenue automatically.
              </p>
            </div>
          </div>
        ) : loading && !data ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: 999, border: `2px solid ${C.border}`, borderTopColor: C.accent, animation: "an-spin 0.8s linear infinite" }} />
          </div>
        ) : !data ? (
          <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", maxWidth: 380, animation: "an-fadeUp 300ms ease 80ms both" }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.15, color: C.text }}>No analytics data yet</h1>
              <p style={{ margin: "10px auto 0", fontSize: 14, lineHeight: 1.6, color: C.textSec }}>
                Your site is deployed but hasn't received any visitors yet. Share your URL to start collecting data.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Stat cards — one consistent treatment, no per-card color.
                These are metrics, not statuses, so a rainbow of hues here
                was never actually communicating anything. */}
            <div className="an-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
              <StatCard label="Visitors" value={fmt(data.uniqueVisitors)} sub={`${fmt(data.pageviews)} pageviews`} delay={0} />
              <StatCard label="CTA Clicks" value={fmt(data.ctaClicks)} sub={`${data.conversionRate}% click rate`} delay={40} />
              <StatCard label="Checkouts" value={fmt(data.checkoutStarts)} sub={`${data.checkoutRate}% checkout rate`} delay={80} />
              <StatCard label="Revenue" value={fmtMoney(data.revenue.total)} sub={`${data.revenue.count} payments`} delay={120} />
            </div>

            {/* Chart */}
            <div className="an-card" style={{
              background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 0, marginBottom: 16,
              animation: "an-fadeUp 300ms ease 140ms both", overflow: "hidden",
            }}>
              <div style={{ display: "flex", borderBottom: `1px solid ${C.border}`, padding: "0 20px" }}>
                {(["traffic", "revenue"] as const).map(t => (
                  <button key={t} className={activeChart === t ? "an-tab an-tab-active" : "an-tab"} onClick={() => setActiveChart(t)} style={{
                    padding: "13px 16px", fontSize: 13, fontWeight: 500, textTransform: "capitalize",
                    color: activeChart === t ? C.text : C.textSec, borderBottom: activeChart === t ? `2px solid ${C.accent}` : "2px solid transparent",
                    marginBottom: -1,
                  }}>{t}</button>
                ))}
              </div>
              <div className="an-chart-container" style={{ padding: "20px 20px 10px", height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "traffic" ? (
                    <AreaChart data={chartDailyData}>
                      <defs>
                        <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity={0.18} />
                          <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.green} stopOpacity={0.12} />
                          <stop offset="100%" stopColor={C.green} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.border, strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="pageviews" stroke={C.accent} strokeWidth={1.5} fill="url(#gV)" name="Pageviews" dot={false} animationDuration={600} />
                      <Area type="monotone" dataKey="clicks" stroke={C.green} strokeWidth={1.5} fill="url(#gC)" name="CTA Clicks" dot={false} animationDuration={600} />
                      <Line type="monotone" dataKey="checkouts" stroke={C.textMuted} strokeWidth={1.5} name="Checkouts" dot={false} strokeDasharray="4 4" animationDuration={600} />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartRevenueData}>
                      <XAxis dataKey="date" tick={{ fill: C.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth() + 1}/${d.getDate()}`; }} />
                      <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} tickLine={false} axisLine={false} width={44} tickFormatter={v => `$${(v / 100).toFixed(0)}`} />
                      <Tooltip content={<RevTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }} />
                      <Bar dataKey="amount" fill={C.accent} radius={[4, 4, 0, 0]} animationDuration={500} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {activeChart === "traffic" && (
                <div style={{ display: "flex", gap: 20, padding: "12px 20px 16px", justifyContent: "center", borderTop: `1px solid ${C.border}` }}>
                  <Dot color={C.accent} label="Pageviews" />
                  <Dot color={C.green} label="CTA Clicks" />
                  <Dot color={C.textMuted} label="Checkouts" dashed />
                </div>
              )}
            </div>

            {/* Bottom grid */}
            <div className="an-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Panel title="Top Pages" items={data.topPages.slice(0, 6)} delay={180} renderItem={(p: any, i: number) => (
                <Row key={i} left={<span style={{ fontFamily: "'JetBrains Mono','SF Mono',monospace", fontSize: 12 }}>{p.path}</span>} right={p.views} last={i === Math.min(data.topPages.length, 6) - 1} />
              )} empty="No page data yet" />
              <Panel title="Top Referrers" items={data.topReferrers.slice(0, 6)} delay={200} renderItem={(r: any, i: number) => (
                <Row key={i} left={r.referrer} right={r.count} last={i === Math.min(data.topReferrers.length, 6) - 1} />
              )} empty="No referrer data yet" />
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, animation: "an-fadeUp 300ms ease 220ms both" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Devices</div>
                {data.deviceBreakdown.length === 0 ? <div style={{ fontSize: 12, color: C.textMuted }}>No device data yet</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {data.deviceBreakdown.map((d, i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: C.textSec, textTransform: "capitalize" }}>{d.device}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{d.pct}%</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 999, background: C.bgInput, overflow: "hidden" }}>
                          <div className="an-bar" style={{ height: "100%", borderRadius: 999, width: `${d.pct}%`, background: RANK_SHADES[i % RANK_SHADES.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by tier */}
            {data.revenue.byTier.length > 0 && (
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginTop: 12, animation: "an-fadeUp 300ms ease 240ms both" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Revenue by Tier</div>
                <div className="an-tier-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.revenue.byTier.length, 4)}, 1fr)`, gap: 10 }}>
                  {data.revenue.byTier.map((t, i) => (
                    <div key={i} style={{ padding: 16, borderRadius: 12, background: C.bgInput, border: `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 6 }}>{t.tier}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(t.total)}</div>
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>{t.count} payments</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement */}
            <div className="an-engagement-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14, animation: "an-fadeUp 300ms ease 260ms both" }}>
                <ClockIcon size={20} color={C.textMuted} />
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>Avg. Time on Page</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{fmtTime(data.avgTimeOnPage)}</div>
                </div>
              </div>
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, display: "flex", alignItems: "center", gap: 14, animation: "an-fadeUp 300ms ease 280ms both" }}>
                <CardIcon size={20} color={C.textMuted} />
                <div>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 3 }}>Avg. Order Value</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>{data.revenue.count > 0 ? fmtMoney(data.revenue.avgOrder) : "—"}</div>
                </div>
              </div>
            </div>

            {/* Conversion funnel */}
            {data.funnel && data.funnel.stages.some(s => s.count > 0) && (
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginTop: 12, animation: "an-fadeUp 300ms ease 300ms both" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 16 }}>Conversion funnel</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {data.funnel.stages.map((stage, i) => {
                    const maxCount = Math.max(...data.funnel!.stages.map(s => s.count), 1);
                    const barWidth = Math.max(4, (stage.count / maxCount) * 100);
                    const dropoff = i > 0 ? data.funnel!.dropoffs[i - 1] : null;
                    return (
                      <div key={stage.name}>
                        {dropoff && dropoff.lost > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0 3px 12px" }}>
                            <ArrowDownIcon size={11} color={C.red} />
                            <span style={{ fontSize: 11, color: C.red }}>{dropoff.pct}% dropped ({dropoff.lost.toLocaleString()} lost)</span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 96, fontSize: 12, color: C.textSec, flexShrink: 0 }}>{stage.name}</div>
                          <div style={{ flex: 1, height: 18, borderRadius: 6, background: C.bgInput, overflow: "hidden" }}>
                            <div className="an-bar" style={{ height: "100%", borderRadius: 6, width: `${barWidth}%`, background: RANK_SHADES[i % RANK_SHADES.length] }} />
                          </div>
                          <div style={{ width: 52, textAlign: "right", fontSize: 12, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{stage.count.toLocaleString()}</div>
                          {i > 0 ? <div style={{ width: 38, textAlign: "right", fontSize: 11, fontWeight: 600, color: stage.pct > 20 ? C.green : stage.pct > 5 ? C.textSec : C.red }}>{stage.pct}%</div> : <div style={{ width: 38 }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* UTM traffic sources */}
            {data.utmBreakdown && data.utmBreakdown.length > 0 && (
              <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginTop: 12, animation: "an-fadeUp 300ms ease 320ms both" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Traffic sources (UTM)</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em" }}>Source</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Views</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Clicks</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Conv.</span>
                </div>
                {data.utmBreakdown.map((utm, i) => (
                  <div key={utm.source} style={{ display: "grid", gridTemplateColumns: "1fr 70px 70px 80px", padding: "10px 0", borderBottom: i < data.utmBreakdown!.length - 1 ? `1px solid ${C.border}` : "none", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{utm.source}</span>
                    <span style={{ fontSize: 12, color: C.textSec, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{utm.views.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: C.textSec, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{utm.clicks.toLocaleString()}</span>
                    <span style={{ fontSize: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: utm.conversionRate > 5 ? C.green : C.textMuted }}>{utm.conversionRate}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-components

function StatCard({ label, value, sub, delay = 0 }: { label: string; value: string; sub: string; delay?: number }) {
  return (
    <div className="an-card" style={{
      background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18,
      animation: `an-fadeUp 300ms ${EASE} ${delay}ms both`,
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: C.textMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.text, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 8 }}>{sub}</div>
    </div>
  );
}

function Dot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.textSec }}>
      <div style={{
        width: 16, height: 2, borderRadius: 999,
        background: dashed ? undefined : color,
        ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg,${color} 0px,${color} 3px,transparent 3px,transparent 6px)` } : {}),
      }} />{label}
    </div>
  );
}

function Panel({ title, items, renderItem, empty, delay = 0 }: { title: string; items: any[]; renderItem: (item: any, i: number) => React.ReactNode; empty: string; delay?: number }) {
  return (
    <div className="an-card" style={{ background: C.bgElevated, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, animation: `an-fadeUp 300ms ${EASE} ${delay}ms both` }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>{title}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: C.textMuted }}>{empty}</div> : items.map(renderItem)}
    </div>
  );
}

function Row({ left, right, last }: { left: React.ReactNode; right: React.ReactNode; last?: boolean }) {
  return (
    <div className="an-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: last ? "none" : `1px solid ${C.border}` }}>
      <span style={{ fontSize: 12, color: C.textSec, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontVariantNumeric: "tabular-nums" }}>{right as any}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bgElevated, border: `1px solid ${C.borderHover}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ fontWeight: 600, color: C.text, marginBottom: 6, fontSize: 11 }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: p.color }} />
          <span style={{ color: C.textMuted, fontSize: 11 }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: C.text, fontSize: 11, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.bgElevated, border: `1px solid ${C.borderHover}`, borderRadius: 10, padding: "10px 14px", fontSize: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}>
      <div style={{ fontWeight: 600, color: C.text, marginBottom: 4, fontSize: 11 }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </div>
      <div style={{ color: C.text, fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em", fontVariantNumeric: "tabular-nums" }}>
        ${((payload[0]?.value || 0) / 100).toFixed(2)}
      </div>
      <div style={{ color: C.textMuted, fontSize: 11, marginTop: 2 }}>{payload[0]?.payload?.count || 0} payments</div>
    </div>
  );
}