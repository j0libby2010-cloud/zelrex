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
  revenue: {
    total: number;
    count: number;
    avgOrder: number;
    byTier: { tier: string; total: number; count: number }[];
    dailyRevenue: { date: string; amount: number; count: number }[];
  };
}

/* ─── Apple-grade design tokens ───────────────────────────────── */
const G = {
  bg: "#050709",
  glass: "rgba(255,255,255,0.025)",
  glassBorder: "rgba(255,255,255,0.055)",
  glassHighlight: "rgba(255,255,255,0.07)",
  text: "rgba(255,255,255,0.92)",
  textSec: "rgba(255,255,255,0.52)",
  textMuted: "rgba(255,255,255,0.26)",
  accent: "#3B82F6",
  accentSoft: "#5B9BF7",
  accentGlow: "rgba(59,130,246,0.12)",
  green: "#34D399",
  greenGlow: "rgba(52,211,153,0.10)",
  amber: "#FBBF24",
  amberGlow: "rgba(251,191,36,0.10)",
  purple: "#A78BFA",
  purpleGlow: "rgba(167,139,250,0.10)",
  chartLine1: "#5B9BF7",
  chartLine2: "#34D399",
  chartLine3: "#FBBF24",
};

const PIE_COLORS = ["#5B9BF7", "#34D399", "#FBBF24", "#A78BFA", "#F87171"];

/* Apple Liquid Glass — layered depth, luminous edge, soft refraction */
const liquidGlass: React.CSSProperties = {
  background: "linear-gradient(165deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 50%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  WebkitBackdropFilter: "blur(64px) saturate(1.6) brightness(1.04)",
  border: `0.5px solid ${G.glassBorder}`,
  boxShadow: `
    0 0.5px 0 0 rgba(255,255,255,0.06) inset,
    0 -0.5px 0 0 rgba(255,255,255,0.02) inset,
    0 1px 3px rgba(0,0,0,0.12),
    0 8px 40px rgba(0,0,0,0.22)
  `,
  borderRadius: 22,
};

const liquidPill: React.CSSProperties = {
  ...liquidGlass,
  borderRadius: 999,
  boxShadow: `
    0 0.5px 0 0 rgba(255,255,255,0.06) inset,
    0 1px 2px rgba(0,0,0,0.10),
    0 4px 16px rgba(0,0,0,0.14)
  `,
};

/* Smooth Apple-style spring easing */
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const EASE_SMOOTH = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

/* ─── Sliding Glass Bubble ─────────────────────────────────── */
function SlidingGlassPill<T extends string>({
  items,
  active,
  onChange,
  renderLabel,
  pillStyle,
  containerStyle,
  itemStyle,
  activeColor = G.accentSoft,
  inactiveColor = G.textMuted,
}: {
  items: T[];
  active: T;
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
  pillStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  itemStyle?: React.CSSProperties;
  activeColor?: string;
  inactiveColor?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [bubble, setBubble] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const el = itemRefs.current.get(active);
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setBubble({ left: er.left - cr.left, width: er.width });
    if (!ready) setReady(true);
  }, [active, ready]);

  useEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={containerRef} style={{ display: "flex", position: "relative", gap: 2, padding: 3, ...containerStyle }}>
      {/* Sliding liquid glass bubble */}
      <div
        style={{
          position: "absolute",
          top: 3, left: bubble.left, width: bubble.width,
          height: "calc(100% - 6px)",
          borderRadius: 999,
          background: "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.025) 25%, rgba(255,255,255,0.015) 60%, rgba(255,255,255,0.04) 100%)",
          backdropFilter: "blur(20px) brightness(1.15) saturate(1.5)",
          WebkitBackdropFilter: "blur(20px) brightness(1.15) saturate(1.5)",
          boxShadow: `
            0 0.5px 0 0 rgba(255,255,255,0.12) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 0 0 0.5px rgba(255,255,255,0.10),
            0 2px 8px rgba(0,0,0,0.10),
            0 4px 16px rgba(0,0,0,0.08)
          `,
          transition: ready
            ? `left 500ms cubic-bezier(0.32, 0.72, 0, 1), width 500ms cubic-bezier(0.32, 0.72, 0, 1)`
            : "none",
          pointerEvents: "none",
          zIndex: 0,
          ...pillStyle,
        }}
      />
      {items.map(item => (
        <button
          key={item}
          ref={el => { if (el) itemRefs.current.set(item, el); }}
          className="z-glass-tab"
          onClick={() => onChange(item)}
          style={{
            position: "relative", zIndex: 1,
            padding: "7px 15px", borderRadius: 999,
            border: "none", cursor: "pointer",
            background: "transparent",
            color: active === item ? activeColor : inactiveColor,
            fontSize: 12, fontWeight: 550, letterSpacing: "0.005em",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
            transition: `color 350ms cubic-bezier(0.32, 0.72, 0, 1)`,
            ...itemStyle,
          }}
        >
          {renderLabel(item)}
        </button>
      ))}
    </div>
  );
}

/* ─── Sliding Glass Tab Bar ────────────────────────────────── */
function SlidingGlassTabBar<T extends string>({
  items,
  active,
  onChange,
  renderLabel,
}: {
  items: T[];
  active: T;
  onChange: (v: T) => void;
  renderLabel: (v: T) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<T, HTMLDivElement>>(new Map());
  const [bubble, setBubble] = useState({ left: 0, width: 0 });
  const [ready, setReady] = useState(false);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const el = itemRefs.current.get(active);
    if (!container || !el) return;
    const cr = container.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setBubble({ left: er.left - cr.left, width: er.width });
    if (!ready) setReady(true);
  }, [active, ready]);

  useEffect(() => { measure(); }, [measure]);
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div ref={containerRef} style={{
      display: "flex", position: "relative",
      borderBottom: `0.5px solid ${G.glassBorder}`, padding: "0 24px",
      background: "linear-gradient(180deg, rgba(255,255,255,0.012) 0%, transparent 100%)",
    }}>
      {/* Sliding liquid glass bubble behind active tab */}
      <div style={{
        position: "absolute",
        bottom: -0.5, left: bubble.left, width: bubble.width,
        height: 2,
        borderRadius: 999,
        background: `linear-gradient(90deg, transparent, ${G.accent}, transparent)`,
        boxShadow: `0 0 8px ${G.accent}30, 0 0 16px ${G.accent}10`,
        transition: ready
          ? `left 500ms cubic-bezier(0.32, 0.72, 0, 1), width 400ms cubic-bezier(0.32, 0.72, 0, 1)`
          : "none",
        pointerEvents: "none",
        zIndex: 2,
      }}/>
      {/* Glass highlight behind active tab */}
      <div style={{
        position: "absolute",
        top: 4, left: bubble.left, width: bubble.width,
        height: "calc(100% - 8px)",
        borderRadius: 10,
        background: "linear-gradient(160deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.01) 40%, transparent 70%)",
        backdropFilter: "blur(12px) brightness(1.08)",
        WebkitBackdropFilter: "blur(12px) brightness(1.08)",
        boxShadow: `0 0.5px 0 0 rgba(255,255,255,0.06) inset`,
        transition: ready
          ? `left 500ms cubic-bezier(0.32, 0.72, 0, 1), width 400ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease`
          : "none",
        pointerEvents: "none",
        zIndex: 0,
      }}/>
      {items.map(item => (
        <div
          key={item}
          ref={el => { if (el) itemRefs.current.set(item, el); }}
          onClick={() => onChange(item)}
          style={{
            position: "relative", zIndex: 1,
            padding: "15px 22px", fontSize: 13, fontWeight: 550,
            textTransform: "capitalize", cursor: "pointer",
            color: active === item ? G.accentSoft : G.textMuted,
            letterSpacing: "0.005em",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
            transition: `color 350ms cubic-bezier(0.32, 0.72, 0, 1)`,
            userSelect: "none",
          }}
        >
          {renderLabel(item)}
        </div>
      ))}
    </div>
  );
}

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
      // Generate empty dates for the selected range
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
      background: "rgba(2,3,5,0.82)",
      backdropFilter: "blur(72px) saturate(1.3) brightness(0.92)",
      WebkitBackdropFilter: "blur(72px) saturate(1.3) brightness(0.92)",
      display: "flex", flexDirection: "column", overflow: "hidden",
      opacity: mounted ? 1 : 0,
      transition: `opacity 450ms ${EASE}`,
    }}>
      <style>{`
        @keyframes z-spin { to { transform: rotate(360deg) } }
        @keyframes z-fadeUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes z-fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes z-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes z-pulse {
          0%, 100% { opacity: 0.4; }
          50%      { opacity: 1; }
        }
        .z-stat {
          transition: transform 500ms ${EASE}, box-shadow 500ms ${EASE}, border-color 500ms ${EASE};
          will-change: transform;
        }
        .z-stat:hover {
          transform: translateY(-1px) scale(1.005) !important;
          box-shadow:
            0 0.5px 0 0 rgba(255,255,255,0.09) inset,
            0 -0.5px 0 0 rgba(255,255,255,0.03) inset,
            0 2px 8px rgba(0,0,0,0.15),
            0 16px 48px rgba(0,0,0,0.28) !important;
          border-color: rgba(255,255,255,0.08) !important;
        }
        .z-rb {
          transition: all 300ms ${EASE};
          position: relative;
        }
        .z-rb:hover { background: rgba(255,255,255,0.05) !important; }
        .z-rb:active { transform: scale(0.97); }
        /* Liquid glass tab buttons (inside sliding pill) */
        .z-glass-tab {
          position: relative;
          overflow: hidden;
          transition: all 500ms cubic-bezier(0.32,0.72,0,1);
        }
        .z-glass-tab::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.10) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -0.5px 0 rgba(255,255,255,0.03);
          transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
          pointer-events: none;
          z-index: 0;
        }
        .z-glass-tab:hover::before { opacity: 1; }
        .z-glass-tab::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
          pointer-events: none;
          z-index: 0;
        }
        .z-glass-tab:hover::after { opacity: 1; }
        .z-glass-tab:hover {
          background: rgba(255,255,255,0.04) !important;
        }
        .z-glass-tab:active { transform: scale(0.95); transition-duration: 120ms; }
        .z-glass-tab > * { position: relative; z-index: 1; }
        /* Apple liquid glass hover for close button */
        .z-close {
          position: relative;
          overflow: hidden;
          transition: all 500ms cubic-bezier(0.32,0.72,0,1) !important;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
        }
        .z-close::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: inherit;
          opacity: 0;
          background: linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 15%, transparent 42%, transparent 58%, rgba(255,255,255,0.03) 80%, rgba(255,255,255,0.12) 100%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -0.5px 0 rgba(255,255,255,0.04);
          transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
          pointer-events: none;
        }
        .z-close::after {
          content: '';
          position: absolute;
          top: -50%; left: 5%; width: 90%; height: 80%;
          border-radius: 50%;
          background: radial-gradient(ellipse at 40% 25%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.02) 35%, transparent 70%);
          opacity: 0;
          transition: opacity 500ms cubic-bezier(0.32,0.72,0,1);
          pointer-events: none;
        }
        .z-close:hover::before, .z-close:hover::after { opacity: 1; }
        .z-ct {
          transition: all 300ms ${EASE};
          cursor: pointer;
          position: relative;
        }
        .z-ct:hover { background: rgba(255,255,255,0.03) !important; }
        .z-close:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.12) !important;
          backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          -webkit-backdrop-filter: blur(20px) brightness(1.22) saturate(1.6) !important;
          box-shadow: 0 0 0 0.5px rgba(255,255,255,0.18), 0 2px 8px rgba(0,0,0,0.08), 0 8px 32px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.45) !important;
          transform: translateY(-0.5px);
        }
        .z-close:active { transform: scale(0.92) translateY(0); transition-duration: 120ms; }
        .z-bar-glow {
          transition: height 300ms ${EASE}, opacity 300ms ${EASE};
        }
        .z-gs::-webkit-scrollbar { width: 5px; }
        .z-gs::-webkit-scrollbar-track { background: transparent; }
        .z-gs::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.06);
          border-radius: 999px;
          transition: background 300ms ease;
        }
        .z-gs::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
        .z-row {
          transition: background 250ms ${EASE};
          border-radius: 8px;
          margin: 0 -8px;
          padding-left: 8px !important;
          padding-right: 8px !important;
        }
        .z-row:hover { background: rgba(255,255,255,0.025); }
        .z-device-bar {
          transition: width 800ms ${EASE};
        }

        /* ─── Mobile Responsive ─── */
        @media (max-width: 768px) {
          .z-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .z-bottom-grid { grid-template-columns: 1fr !important; }
          .z-engagement-grid { grid-template-columns: 1fr !important; }
          .z-tier-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .z-header-inner { flex-direction: column !important; gap: 12px !important; }
          .z-range-pills { order: 0 !important; }
          .z-gs { padding: 14px !important; }
        }
        @media (max-width: 480px) {
          .z-stats-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }
          .z-tier-grid { grid-template-columns: 1fr !important; }
          .z-chart-container { height: 220px !important; }
        }
      `}</style>

      {/* ─── Header ──────────────────────────────── */}
      <div className="z-header-inner" style={{
        padding: "18px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `0.5px solid ${G.glassBorder}`,
        background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)",
        animation: "z-fadeIn 600ms ease both",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 12,
            background: `linear-gradient(135deg, ${G.accentGlow}, rgba(59,130,246,0.04))`,
            border: `0.5px solid rgba(59,130,246,0.15)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 20px rgba(59,130,246,0.06)`,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.2" opacity="0.6"/>
              <path d="M8 14l2.5-3 2.5 1.5L16 9" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="16" cy="9" r="1.5" fill={G.accent} opacity="0.8"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: G.text, letterSpacing: "-0.025em", fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif" }}>Analytics</div>
            <div style={{ fontSize: 11.5, color: G.textMuted, marginTop: 1, letterSpacing: "0.01em" }}>Real-time performance</div>
          </div>
        </div>
        <SlidingGlassPill
          items={ranges.map(r => r.key)}
          active={range}
          onChange={setRange}
          renderLabel={v => ranges.find(r => r.key === v)?.label || v}
          containerStyle={{ ...liquidPill }}
        />
        <button className="z-close" onClick={onClose} style={{
          width: 34, height: 34, borderRadius: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: G.textMuted, cursor: "pointer",
          border: `0.5px solid ${G.glassBorder}`,
          background: G.glass,
          fontSize: 15, fontWeight: 300,
          backdropFilter: "blur(20px)",
        }}>✕</button>
      </div>

      {/* ─── Content ─────────────────────────────── */}
      <div ref={scrollRef} className="z-gs" style={{ flex: 1, overflow: "auto", padding: 24 }}>
        {!deployed ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec, animation: "z-fadeUp 700ms ease both" }}>
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{
                width: 68, height: 68, borderRadius: 22, margin: "0 auto 24px",
                background: `linear-gradient(135deg, ${G.purpleGlow}, rgba(167,139,250,0.03))`,
                border: `0.5px solid rgba(167,139,250,0.12)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px rgba(167,139,250,0.06)`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.purple} strokeWidth="1.2" opacity="0.6"/><path d="M8 14l2.5-3 2.5 1.5L16 9" stroke={G.purple} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ fontSize: 19, fontWeight: 600, color: G.text, marginBottom: 10, letterSpacing: "-0.025em" }}>No business deployed yet</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: G.textSec }}>Build and deploy your website first. Once it's live, analytics will start tracking visitors, clicks, and revenue automatically.</div>
            </div>
          </div>
        ) : loading && !data ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec, animation: "z-fadeIn 500ms ease both" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{
                width: 44, height: 44, borderRadius: 999,
                border: `1.5px solid ${G.glassBorder}`, borderTopColor: G.accent,
                animation: "z-spin 0.9s cubic-bezier(0.4, 0, 0.2, 1) infinite",
                margin: "0 auto 16px",
                boxShadow: `0 0 16px rgba(59,130,246,0.06)`,
              }}/>
              <div style={{ fontSize: 13, color: G.textMuted, letterSpacing: "0.01em" }}>Loading analytics...</div>
            </div>
          </div>
        ) : !data ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: G.textSec, animation: "z-fadeUp 700ms ease both" }}>
            <div style={{ textAlign: "center", maxWidth: 400 }}>
              <div style={{
                width: 68, height: 68, borderRadius: 22, margin: "0 auto 24px",
                background: `linear-gradient(135deg, ${G.accentGlow}, rgba(59,130,246,0.03))`,
                border: `0.5px solid rgba(59,130,246,0.12)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 32px rgba(59,130,246,0.06)`,
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.2" opacity="0.6"/><path d="M12 8v4M12 16h.01" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <div style={{ fontSize: 19, fontWeight: 600, color: G.text, marginBottom: 10, letterSpacing: "-0.025em" }}>No analytics data yet</div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: G.textSec }}>Your site is deployed but hasn't received any visitors yet. Share your URL to start collecting data.</div>
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {/* Stat Cards */}
            <div className="z-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "Visitors", value: fmt(data.uniqueVisitors), sub: `${fmt(data.pageviews)} pageviews`, color: G.accent },
                { label: "CTA Clicks", value: fmt(data.ctaClicks), sub: `${data.conversionRate}% click rate`, color: G.green },
                { label: "Checkouts", value: fmt(data.checkoutStarts), sub: `${data.checkoutRate}% checkout rate`, color: G.amber },
                { label: "Revenue", value: fmtMoney(data.revenue.total), sub: `${data.revenue.count} payments`, color: G.purple },
              ].map((card, idx) => (
                <StatCard key={card.label} {...card} delay={idx * 60} />
              ))}
            </div>

            {/* Chart */}
            <div className="z-stat" style={{
              ...liquidGlass, padding: 0, marginBottom: 24,
              animation: `z-fadeUp 600ms ${EASE} ${280}ms both`,
              overflow: "hidden",
            }}>
              <SlidingGlassTabBar
                items={["traffic", "revenue"] as ("traffic" | "revenue")[]}
                active={activeChart}
                onChange={setActiveChart}
                renderLabel={v => v}
              />
              <div style={{ padding: "24px 24px 14px", height: 310 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {activeChart === "traffic" ? (
                    <AreaChart data={chartDailyData}>
                      <defs>
                        <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={G.chartLine1} stopOpacity={0.2}/>
                          <stop offset="50%" stopColor={G.chartLine1} stopOpacity={0.06}/>
                          <stop offset="100%" stopColor={G.chartLine1} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={G.chartLine2} stopOpacity={0.14}/>
                          <stop offset="50%" stopColor={G.chartLine2} stopOpacity={0.04}/>
                          <stop offset="100%" stopColor={G.chartLine2} stopOpacity={0}/>
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="blur"/>
                          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: G.textMuted, fontSize: 10.5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }}/>
                      <YAxis tick={{ fill: G.textMuted, fontSize: 10.5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }} tickLine={false} axisLine={false} width={40}/>
                      <Tooltip content={<ChartTooltip/>} cursor={{ stroke: "rgba(255,255,255,0.04)", strokeWidth: 1 }}/>
                      <Area type="monotone" dataKey="pageviews" stroke={G.chartLine1} strokeWidth={1.8} fill="url(#gV)" name="Pageviews" dot={false} animationDuration={1200} animationEasing="ease-out"/>
                      <Area type="monotone" dataKey="clicks" stroke={G.chartLine2} strokeWidth={1.8} fill="url(#gC)" name="CTA Clicks" dot={false} animationDuration={1200} animationEasing="ease-out"/>
                      <Line type="monotone" dataKey="checkouts" stroke={G.chartLine3} strokeWidth={1.8} name="Checkouts" dot={false} strokeDasharray="5 5" strokeOpacity={0.7} animationDuration={1200} animationEasing="ease-out"/>
                    </AreaChart>
                  ) : (
                    <BarChart data={chartRevenueData}>
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={G.purple} stopOpacity={0.7}/>
                          <stop offset="100%" stopColor={G.purple} stopOpacity={0.25}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" tick={{ fill: G.textMuted, fontSize: 10.5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }} tickLine={false} axisLine={false} tickFormatter={v => { const d = new Date(v); return `${d.getMonth()+1}/${d.getDate()}`; }}/>
                      <YAxis tick={{ fill: G.textMuted, fontSize: 10.5, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif" }} tickLine={false} axisLine={false} width={50} tickFormatter={v => `$${(v/100).toFixed(0)}`}/>
                      <Tooltip content={<RevTooltip/>} cursor={{ fill: "rgba(255,255,255,0.02)", radius: 6 }}/>
                      <Bar dataKey="amount" fill="url(#barGrad)" radius={[8,8,0,0]} animationDuration={1000} animationEasing="ease-out"/>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
              {activeChart === "traffic" && (
                <div style={{
                  display: "flex", gap: 24, padding: "0 24px 16px", justifyContent: "center",
                  borderTop: `0.5px solid rgba(255,255,255,0.025)`, paddingTop: 14,
                }}>
                  <Dot color={G.chartLine1} label="Pageviews"/><Dot color={G.chartLine2} label="CTA Clicks"/><Dot color={G.chartLine3} label="Checkouts" dashed/>
                </div>
              )}
            </div>

            {/* Bottom Grid */}
            <div className="z-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <Panel title="Top Pages" items={data.topPages.slice(0,6)} delay={360} renderItem={(p:any,i:number) => (
                <Row key={i} left={<span style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace", fontSize: 12, letterSpacing: "-0.01em" }}>{p.path}</span>} right={p.views} last={i===Math.min(data.topPages.length,6)-1}/>
              )} empty="No page data yet"/>
              <Panel title="Top Referrers" items={data.topReferrers.slice(0,6)} delay={420} renderItem={(r:any,i:number) => (
                <Row key={i} left={r.referrer} right={r.count} last={i===Math.min(data.topReferrers.length,6)-1}/>
              )} empty="No referrer data yet"/>
              <div className="z-stat" style={{
                ...liquidGlass, padding: 22,
                animation: `z-fadeUp 600ms ${EASE} 480ms both`,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: G.text, marginBottom: 16, letterSpacing: "0.01em" }}>Devices</div>
                {data.deviceBreakdown.length === 0 ? <div style={{ fontSize: 12, color: G.textMuted }}>No device data yet</div> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {data.deviceBreakdown.map((d,i) => (
                      <div key={i}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, color: G.textSec, textTransform: "capitalize", fontWeight: 450 }}>{d.device}</span>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: G.text, fontVariantNumeric: "tabular-nums" }}>{d.pct}%</span>
                        </div>
                        <div style={{ height: 3, borderRadius: 999, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div className="z-device-bar" style={{
                            height: "100%", borderRadius: 999,
                            width: `${d.pct}%`,
                            background: `linear-gradient(90deg, ${PIE_COLORS[i % PIE_COLORS.length]}, ${PIE_COLORS[i % PIE_COLORS.length]}88)`,
                            boxShadow: `0 0 8px ${PIE_COLORS[i % PIE_COLORS.length]}20`,
                          }}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revenue by Tier */}
            {data.revenue.byTier.length > 0 && (
              <div className="z-stat" style={{
                ...liquidGlass, padding: 22, marginTop: 16,
                animation: `z-fadeUp 600ms ${EASE} 540ms both`,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: G.text, marginBottom: 16, letterSpacing: "0.01em" }}>Revenue by Tier</div>
                <div className="z-tier-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(data.revenue.byTier.length, 4)}, 1fr)`, gap: 14 }}>
                  {data.revenue.byTier.map((t,i) => (
                    <div key={i} style={{
                      padding: 18, borderRadius: 16,
                      background: `linear-gradient(145deg, ${PIE_COLORS[i%PIE_COLORS.length]}0C, transparent)`,
                      border: `0.5px solid ${PIE_COLORS[i%PIE_COLORS.length]}18`,
                      transition: `all 400ms ${EASE}`,
                    }}>
                      <div style={{ fontSize: 11.5, color: G.textSec, marginBottom: 8, fontWeight: 500 }}>{t.tier}</div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: G.text, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtMoney(t.total)}</div>
                      <div style={{ fontSize: 11, color: G.textMuted, marginTop: 6 }}>{t.count} payments</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement */}
            <div className="z-engagement-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
              <div className="z-stat" style={{
                ...liquidGlass, padding: 22, display: "flex", alignItems: "center", gap: 18,
                animation: `z-fadeUp 600ms ${EASE} 600ms both`,
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 16,
                  background: `linear-gradient(135deg, ${G.accentGlow}, rgba(59,130,246,0.04))`,
                  border: `0.5px solid rgba(59,130,246,0.12)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 20px rgba(59,130,246,0.05)`,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke={G.accent} strokeWidth="1.2" opacity="0.6"/><path d="M12 6v6l4 2" stroke={G.accent} strokeWidth="1.5" strokeLinecap="round"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: G.textSec, marginBottom: 4, fontWeight: 500 }}>Avg. Time on Page</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: G.text, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{fmtTime(data.avgTimeOnPage)}</div>
                </div>
              </div>
              <div className="z-stat" style={{
                ...liquidGlass, padding: 22, display: "flex", alignItems: "center", gap: 18,
                animation: `z-fadeUp 600ms ${EASE} 660ms both`,
              }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 16,
                  background: `linear-gradient(135deg, ${data.revenue.count > 0 ? G.greenGlow : G.amberGlow}, transparent)`,
                  border: `0.5px solid ${data.revenue.count > 0 ? "rgba(52,211,153,0.12)" : "rgba(251,191,36,0.12)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: `0 0 20px ${data.revenue.count > 0 ? "rgba(52,211,153,0.05)" : "rgba(251,191,36,0.05)"}`,
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2.5" stroke={data.revenue.count > 0 ? G.green : G.amber} strokeWidth="1.2" opacity="0.6"/><path d="M2 10h20" stroke={data.revenue.count > 0 ? G.green : G.amber} strokeWidth="1.2" opacity="0.6"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: G.textSec, marginBottom: 4, fontWeight: 500 }}>Avg. Order Value</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: G.text, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{data.revenue.count > 0 ? fmtMoney(data.revenue.avgOrder) : "—"}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────

function StatCard({ label, value, sub, color, delay = 0 }: { label: string; value: string; sub: string; color: string; delay?: number }) {
  return (
    <div className="z-stat" style={{
      ...liquidGlass, padding: 22,
      animation: `z-fadeUp 600ms ${EASE} ${delay}ms both`,
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle luminous edge shimmer */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "1px",
        background: `linear-gradient(90deg, transparent 0%, ${color}18 30%, ${color}10 70%, transparent 100%)`,
      }}/>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 7, height: 7, borderRadius: 999, background: color,
          boxShadow: `0 0 6px ${color}40, 0 0 12px ${color}15`,
        }}/>
        <span style={{
          fontSize: 11.5, fontWeight: 550, color: G.textSec,
          letterSpacing: "0.06em", textTransform: "uppercase",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', sans-serif",
        }}>{label}</span>
      </div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: G.text,
        letterSpacing: "-0.035em", lineHeight: 1,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        fontVariantNumeric: "tabular-nums",
      }}>{value}</div>
      <div style={{ fontSize: 12, color: G.textMuted, marginTop: 8, fontWeight: 450 }}>{sub}</div>
    </div>
  );
}

function Dot({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      fontSize: 11.5, color: G.textSec, fontWeight: 450,
    }}>
      <div style={{
        width: 18, height: 2, borderRadius: 999,
        background: dashed ? undefined : color,
        opacity: dashed ? 0.7 : 0.8,
        ...(dashed ? { backgroundImage: `repeating-linear-gradient(90deg,${color} 0px,${color} 4px,transparent 4px,transparent 8px)` } : {}),
      }}/>{label}
    </div>
  );
}

function Panel({ title, items, renderItem, empty, delay = 0 }: { title: string; items: any[]; renderItem: (item: any, i: number) => React.ReactNode; empty: string; delay?: number }) {
  return (
    <div className="z-stat" style={{
      ...liquidGlass, padding: 22,
      animation: `z-fadeUp 600ms ${EASE} ${delay}ms both`,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: G.text, marginBottom: 14, letterSpacing: "0.01em" }}>{title}</div>
      {items.length === 0 ? <div style={{ fontSize: 12, color: G.textMuted }}>{empty}</div> : items.map(renderItem)}
    </div>
  );
}

function Row({ left, right, last }: { left: React.ReactNode; right: React.ReactNode; last?: boolean }) {
  return (
    <div className="z-row" style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "9px 0",
      borderBottom: last ? "none" : `0.5px solid rgba(255,255,255,0.035)`,
    }}>
      <span style={{ fontSize: 12.5, color: G.textSec, fontWeight: 450, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{left}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: G.text, fontVariantNumeric: "tabular-nums" }}>{right as any}</span>
    </div>
  );
}

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      ...liquidGlass, padding: "12px 16px", fontSize: 12, borderRadius: 14,
      boxShadow: `
        0 0.5px 0 0 rgba(255,255,255,0.08) inset,
        0 4px 24px rgba(0,0,0,0.35),
        0 1px 4px rgba(0,0,0,0.15)
      `,
    }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 8, fontSize: 11.5, letterSpacing: "0.01em" }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
          <div style={{ width: 5, height: 5, borderRadius: 999, background: p.color, boxShadow: `0 0 4px ${p.color}40` }}/>
          <span style={{ color: G.textMuted, fontSize: 11.5, fontWeight: 450 }}>{p.name}</span>
          <span style={{ fontWeight: 600, color: G.text, fontSize: 11.5, marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      ...liquidGlass, padding: "12px 16px", fontSize: 12, borderRadius: 14,
      boxShadow: `
        0 0.5px 0 0 rgba(255,255,255,0.08) inset,
        0 4px 24px rgba(0,0,0,0.35),
        0 1px 4px rgba(0,0,0,0.15)
      `,
    }}>
      <div style={{ fontWeight: 600, color: G.text, marginBottom: 6, fontSize: 11.5 }}>
        {label ? new Date(label).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}
      </div>
      <div style={{ color: G.text, fontWeight: 700, fontSize: 17, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        ${((payload[0]?.value||0)/100).toFixed(2)}
      </div>
      <div style={{ color: G.textMuted, fontSize: 11, marginTop: 3, fontWeight: 450 }}>{payload[0]?.payload?.count||0} payments</div>
    </div>
  );
}