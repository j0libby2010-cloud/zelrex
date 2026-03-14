import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════
// ZELREX ANALYTICS — SINGLE BULLETPROOF ENDPOINT
// 
// This ONE file handles everything:
//   GET /api/z/px?u=...&t=pv  → tracking pixel (returns 1x1 GIF)
//   GET /api/z/px?action=dash&userId=...&range=30d → dashboard data
//
// Deploy to: app/api/z/px/route.ts
// That's it. One file. One path. Nothing else needed.
// ═══════════════════════════════════════════════════════════════════

// ─── Supabase client (with fallback so build never crashes) ──────
let supabase: any = null;
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    supabase = createClient(url, key);
  }
} catch (e) {
  console.error('[ZPX] Supabase init failed:', e);
}

// ─── 1x1 transparent GIF ────────────────────────────────────────
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

const PIXEL_HEADERS = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// ─── Event type mapping (short codes → full names) ──────────────
const EVENTS: Record<string, string> = {
  pv: 'pageview',
  cc: 'cta_click',
  cs: 'checkout_start',
  sd: 'scroll_depth',
  tp: 'time_on_page',
};

// ═══════════════════════════════════════════════════════════════════
// GET HANDLER — routes between pixel tracking and dashboard
// ═══════════════════════════════════════════════════════════════════
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // ─── DASHBOARD MODE ──────────────────────────────────────
  if (action === 'dash') {
    return handleDashboard(url);
  }

  // ─── PIXEL TRACKING MODE (default) ───────────────────────
  return handlePixel(url, req);
}

// ═══════════════════════════════════════════════════════════════════
// PIXEL TRACKING
// ═══════════════════════════════════════════════════════════════════
async function handlePixel(url: URL, req: Request) {
  const userId = url.searchParams.get('u');
  const eventCode = url.searchParams.get('t');
  const visitorId = url.searchParams.get('v') || '';
  const pagePath = url.searchParams.get('p') || '/';
  const referrer = url.searchParams.get('r') || '';
  const deviceCode = url.searchParams.get('d') || 'd';
  const extra = url.searchParams.get('x') || '';

  // Always return the pixel — never error out
  if (!userId || !eventCode || !supabase) {
    return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
  }

  const eventType = EVENTS[eventCode];
  if (!eventType) {
    return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
  }

  const deviceMap: Record<string, string> = { d: 'desktop', m: 'mobile', t: 'tablet' };
  const country = req.headers.get('x-vercel-ip-country') ||
                  req.headers.get('cf-ipcountry') || 'unknown';

  // Build metadata
  let metadata: Record<string, any> = {};
  if (eventType === 'scroll_depth') metadata = { depth: parseInt(extra) || 0 };
  else if (eventType === 'time_on_page') metadata = { seconds: parseInt(extra) || 0 };
  else if (extra) metadata = { detail: extra };

  // Fire and forget — return pixel immediately, insert in background
  supabase.from('site_analytics').insert({
    user_id: userId,
    event_type: eventType,
    page_path: pagePath.slice(0, 500),
    element_id: (eventType === 'cta_click' || eventType === 'checkout_start') ? extra.slice(0, 200) : '',
    element_text: (eventType === 'cta_click' || eventType === 'checkout_start') ? extra.slice(0, 200) : '',
    visitor_id: visitorId.slice(0, 100),
    referrer: referrer.slice(0, 500),
    device_type: deviceMap[deviceCode] || 'desktop',
    country,
    metadata,
  }).then(({ error }: any) => {
    if (error) console.error('[ZPX] Insert error:', error.message);
  });

  return new NextResponse(PIXEL, { status: 200, headers: PIXEL_HEADERS });
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD DATA
// ═══════════════════════════════════════════════════════════════════
type TimeRange = 'today' | '7d' | '30d' | '90d' | '365d';

function getRangeDate(range: TimeRange): string {
  const now = new Date();
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case '7d': { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString(); }
    case '30d': { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString(); }
    case '90d': { const d = new Date(); d.setDate(d.getDate() - 90); return d.toISOString(); }
    case '365d': { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString(); }
  }
}

async function handleDashboard(url: URL) {
  const userId = url.searchParams.get('userId');
  const range = (url.searchParams.get('range') || '30d') as TimeRange;

  if (!userId || !supabase) {
    return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400, headers: JSON_HEADERS });
  }

  const validRanges: TimeRange[] = ['today', '7d', '30d', '90d', '365d'];
  if (!validRanges.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400, headers: JSON_HEADERS });
  }

  try {
    const since = getRangeDate(range);

    // Run all queries in parallel for speed
    const [pvRes, ctaRes, csRes, timeRes, pagesRes, refRes, devRes, dailyRes, revRes, revTierRes, revDailyRes] = await Promise.all([
      // Pageviews
      supabase.from('site_analytics').select('visitor_id', { count: 'exact' })
        .eq('user_id', userId).eq('event_type', 'pageview').gte('created_at', since),
      // CTA clicks
      supabase.from('site_analytics').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('event_type', 'cta_click').gte('created_at', since),
      // Checkout starts
      supabase.from('site_analytics').select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('event_type', 'checkout_start').gte('created_at', since),
      // Time on page
      supabase.from('site_analytics').select('metadata')
        .eq('user_id', userId).eq('event_type', 'time_on_page').gte('created_at', since).limit(500),
      // Pages (for top pages)
      supabase.from('site_analytics').select('page_path')
        .eq('user_id', userId).eq('event_type', 'pageview').gte('created_at', since).limit(5000),
      // Referrers
      supabase.from('site_analytics').select('referrer')
        .eq('user_id', userId).eq('event_type', 'pageview').gte('created_at', since).neq('referrer', '').limit(5000),
      // Devices
      supabase.from('site_analytics').select('device_type')
        .eq('user_id', userId).eq('event_type', 'pageview').gte('created_at', since).limit(5000),
      // Daily breakdown
      supabase.from('site_analytics').select('event_type, created_at, visitor_id')
        .eq('user_id', userId).in('event_type', ['pageview', 'cta_click', 'checkout_start'])
        .gte('created_at', since).order('created_at').limit(50000),
      // Revenue total
      supabase.from('site_revenue').select('amount_cents').eq('user_id', userId).gte('created_at', since),
      // Revenue by tier
      supabase.from('site_revenue').select('tier_name, amount_cents').eq('user_id', userId).gte('created_at', since),
      // Revenue daily
      supabase.from('site_revenue').select('amount_cents, created_at').eq('user_id', userId).gte('created_at', since).order('created_at'),
    ]);

    // ─── Process results ──────────────────────────────────
    const pageviews = pvRes.count || 0;
    const uniqueVisitors = new Set((pvRes.data || []).map((r: any) => r.visitor_id)).size;
    const ctaClicks = ctaRes.count || 0;
    const checkoutStarts = csRes.count || 0;

    // Avg time on page
    const times = (timeRes.data || [])
      .map((r: any) => { const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata; return m?.seconds || 0; })
      .filter((s: number) => s > 0 && s < 3600);
    const avgTimeOnPage = times.length > 0 ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0;

    // Top pages
    const pc: Record<string, number> = {};
    (pagesRes.data || []).forEach((r: any) => { pc[r.page_path || '/'] = (pc[r.page_path || '/'] || 0) + 1; });
    const topPages = Object.entries(pc).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([path, views]) => ({ path, views }));

    // Top referrers
    const rc: Record<string, number> = {};
    (refRes.data || []).forEach((r: any) => { try { const h = new URL(r.referrer).hostname; rc[h] = (rc[h] || 0) + 1; } catch {} });
    const topReferrers = Object.entries(rc).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([referrer, count]) => ({ referrer, count }));

    // Devices
    const dc: Record<string, number> = {};
    (devRes.data || []).forEach((r: any) => { dc[r.device_type || 'unknown'] = (dc[r.device_type || 'unknown'] || 0) + 1; });
    const totalDev = Object.values(dc).reduce((a, b) => a + b, 0) || 1;
    const deviceBreakdown = Object.entries(dc).map(([device, count]) => ({ device, count, pct: Math.round(((count as number) / totalDev) * 100) })).sort((a, b) => b.count - a.count);

    // Daily chart data
    const dm: Record<string, { pageviews: number; visitors: Set<string>; clicks: number; checkouts: number }> = {};
    (dailyRes.data || []).forEach((r: any) => {
      const day = r.created_at?.slice(0, 10);
      if (!day) return;
      if (!dm[day]) dm[day] = { pageviews: 0, visitors: new Set(), clicks: 0, checkouts: 0 };
      if (r.event_type === 'pageview') { dm[day].pageviews++; dm[day].visitors.add(r.visitor_id || ''); }
      if (r.event_type === 'cta_click') dm[day].clicks++;
      if (r.event_type === 'checkout_start') dm[day].checkouts++;
    });
    const dailyData = Object.entries(dm).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, pageviews: d.pageviews, visitors: d.visitors.size, clicks: d.clicks, checkouts: d.checkouts }));

    // Revenue
    const revData = revRes.data || [];
    const revTotal = revData.reduce((s: number, r: any) => s + (r.amount_cents || 0), 0);
    const revCount = revData.length;
    const avgOrder = revCount > 0 ? Math.round(revTotal / revCount) : 0;

    const tierMap: Record<string, { total: number; count: number }> = {};
    (revTierRes.data || []).forEach((r: any) => {
      const t = r.tier_name || 'Unknown';
      if (!tierMap[t]) tierMap[t] = { total: 0, count: 0 };
      tierMap[t].total += r.amount_cents || 0;
      tierMap[t].count++;
    });
    const byTier = Object.entries(tierMap).map(([tier, d]) => ({ tier, ...d }));

    const dRevMap: Record<string, { amount: number; count: number }> = {};
    (revDailyRes.data || []).forEach((r: any) => {
      const day = r.created_at?.slice(0, 10);
      if (!day) return;
      if (!dRevMap[day]) dRevMap[day] = { amount: 0, count: 0 };
      dRevMap[day].amount += r.amount_cents || 0;
      dRevMap[day].count++;
    });
    const dailyRevenue = Object.entries(dRevMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }));

    const conversionRate = pageviews > 0 ? Math.round((ctaClicks / pageviews) * 1000) / 10 : 0;
    const checkoutRate = pageviews > 0 ? Math.round((checkoutStarts / pageviews) * 1000) / 10 : 0;

    return NextResponse.json({
      timeRange: range,
      pageviews, uniqueVisitors, ctaClicks, checkoutStarts,
      conversionRate, checkoutRate, avgTimeOnPage,
      topPages, topReferrers, deviceBreakdown, dailyData,
      revenue: { total: revTotal, count: revCount, avgOrder, byTier, dailyRevenue },
    }, { headers: JSON_HEADERS });

  } catch (error: any) {
    console.error('[ZPX] Dashboard error:', error?.message || error);
    return NextResponse.json({ error: 'Analytics query failed' }, { status: 500, headers: JSON_HEADERS });
  }
}

// ═══════════════════════════════════════════════════════════════════
// OPTIONS (CORS preflight)
// ═══════════════════════════════════════════════════════════════════
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: PIXEL_HEADERS });
}