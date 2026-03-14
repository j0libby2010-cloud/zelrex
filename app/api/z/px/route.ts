import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

const EVENTS: Record<string, string> = {
  pv: 'pageview', cc: 'cta_click', cs: 'checkout_start', sd: 'scroll_depth', tp: 'time_on_page',
};

let _sb: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error('[ZPX] Missing env vars, url:', !!url, 'key:', !!key); return null; }
  _sb = createClient(url, key);
  return _sb;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('action') === 'dash') return handleDash(url);

  const userId = url.searchParams.get('u');
  const code = url.searchParams.get('t');
  const ph = { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store, no-cache, must-revalidate, private', 'Access-Control-Allow-Origin': '*' };

  if (!userId || !code || !EVENTS[code]) return new NextResponse(PIXEL, { status: 200, headers: ph });

  const supabase = db();
  if (!supabase) return new NextResponse(PIXEL, { status: 200, headers: ph });

  const eventType = EVENTS[code];
  const extra = url.searchParams.get('x') || '';
  const pagePath = url.searchParams.get('p') || '/';
  const visitorId = url.searchParams.get('v') || '';
  const referrer = url.searchParams.get('r') || '';
  const devCode = url.searchParams.get('d') || 'd';
  const devMap: Record<string, string> = { d: 'desktop', m: 'mobile', t: 'tablet' };
  const country = req.headers.get('x-vercel-ip-country') || 'unknown';

  let metadata: any = {};
  if (eventType === 'scroll_depth') metadata = { depth: parseInt(extra) || 0 };
  else if (eventType === 'time_on_page') metadata = { seconds: parseInt(extra) || 0 };
  else if (extra) metadata = { detail: extra };

  try {
    const { error } = await supabase.from('site_analytics').insert({
      user_id: userId, event_type: eventType, page_path: pagePath.slice(0, 500),
      element_id: extra.slice(0, 200), element_text: extra.slice(0, 200),
      visitor_id: visitorId.slice(0, 100), referrer: referrer.slice(0, 500),
      device_type: devMap[devCode] || 'desktop', country, metadata,
    });
    if (error) console.error('[ZPX] INSERT ERR:', error.message, error.details);
  } catch (e: any) { console.error('[ZPX] EXCEPTION:', e?.message); }

  return new NextResponse(PIXEL, { status: 200, headers: ph });
}

type TR = 'today' | '7d' | '30d' | '90d' | '365d';
function sinceDate(r: TR): string {
  const n = new Date(); const d = new Date();
  if (r === 'today') { d.setHours(0, 0, 0, 0); return d.toISOString(); }
  if (r === '7d') { d.setDate(n.getDate() - 7); return d.toISOString(); }
  if (r === '30d') { d.setDate(n.getDate() - 30); return d.toISOString(); }
  if (r === '90d') { d.setDate(n.getDate() - 90); return d.toISOString(); }
  d.setDate(n.getDate() - 365); return d.toISOString();
}

async function handleDash(url: URL) {
  const userId = url.searchParams.get('userId');
  const range = (url.searchParams.get('range') || '30d') as TR;
  const jh = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const supabase = db();
  if (!userId || !supabase) return NextResponse.json({ pageviews: 0 }, { headers: jh });

  try {
    const since = sinceDate(range);
    const q = (et: string) => supabase.from('site_analytics').select('*').eq('user_id', userId).eq('event_type', et).gte('created_at', since).limit(10000);
    const [pvR, ccR, csR, tpR, allR, revR] = await Promise.all([
      q('pageview'), q('cta_click'), q('checkout_start'), q('time_on_page'),
      supabase.from('site_analytics').select('event_type,created_at,visitor_id,page_path').eq('user_id', userId).in('event_type', ['pageview', 'cta_click', 'checkout_start']).gte('created_at', since).order('created_at').limit(50000),
      supabase.from('site_revenue').select('*').eq('user_id', userId).gte('created_at', since),
    ]);
    const pvData = pvR.data || []; const ccData = ccR.data || []; const csData = csR.data || [];
    const tpData = tpR.data || []; const allData = allR.data || []; const revData = revR.data || [];
    const pageviews = pvData.length;
    const uniqueVisitors = new Set(pvData.map((r: any) => r.visitor_id)).size;
    const ctaClicks = ccData.length; const checkoutStarts = csData.length;
    const times = tpData.map((r: any) => { const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || {}); return m.seconds || 0; }).filter((s: number) => s > 0 && s < 3600);
    const avgTimeOnPage = times.length ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0;
    const pc: Record<string, number> = {}; pvData.forEach((r: any) => { const p = r.page_path || '/'; pc[p] = (pc[p] || 0) + 1; });
    const topPages = Object.entries(pc).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([path, views]) => ({ path, views }));
    const rc: Record<string, number> = {}; pvData.forEach((r: any) => { if (!r.referrer) return; try { const h = new URL(r.referrer).hostname; if (h) rc[h] = (rc[h] || 0) + 1; } catch {} });
    const topReferrers = Object.entries(rc).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 10).map(([referrer, count]) => ({ referrer, count }));
    const dc: Record<string, number> = {}; pvData.forEach((r: any) => { const d = r.device_type || 'unknown'; dc[d] = (dc[d] || 0) + 1; });
    const totalDev = Object.values(dc).reduce((a, b) => a + b, 0) || 1;
    const deviceBreakdown = Object.entries(dc).map(([device, count]) => ({ device, count, pct: Math.round(((count as number) / totalDev) * 100) })).sort((a, b) => b.count - a.count);
    const dm: Record<string, { pageviews: number; visitors: Set<string>; clicks: number; checkouts: number }> = {};
    allData.forEach((r: any) => { const day = r.created_at?.slice(0, 10); if (!day) return; if (!dm[day]) dm[day] = { pageviews: 0, visitors: new Set(), clicks: 0, checkouts: 0 }; if (r.event_type === 'pageview') { dm[day].pageviews++; dm[day].visitors.add(r.visitor_id || ''); } if (r.event_type === 'cta_click') dm[day].clicks++; if (r.event_type === 'checkout_start') dm[day].checkouts++; });
    const dailyData = Object.entries(dm).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, pageviews: d.pageviews, visitors: d.visitors.size, clicks: d.clicks, checkouts: d.checkouts }));
    const revTotal = revData.reduce((s: number, r: any) => s + (r.amount_cents || 0), 0); const revCount = revData.length;
    const avgOrder = revCount > 0 ? Math.round(revTotal / revCount) : 0;
    const tierMap: Record<string, { total: number; count: number }> = {}; revData.forEach((r: any) => { const t = r.tier_name || 'Unknown'; if (!tierMap[t]) tierMap[t] = { total: 0, count: 0 }; tierMap[t].total += r.amount_cents || 0; tierMap[t].count++; });
    const byTier = Object.entries(tierMap).map(([tier, d]) => ({ tier, ...d }));
    const dRevMap: Record<string, { amount: number; count: number }> = {}; revData.forEach((r: any) => { const day = r.created_at?.slice(0, 10); if (!day) return; if (!dRevMap[day]) dRevMap[day] = { amount: 0, count: 0 }; dRevMap[day].amount += r.amount_cents || 0; dRevMap[day].count++; });
    const dailyRevenue = Object.entries(dRevMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, d]) => ({ date, ...d }));
    return NextResponse.json({ timeRange: range, pageviews, uniqueVisitors, ctaClicks, checkoutStarts, conversionRate: pageviews > 0 ? Math.round((ctaClicks / pageviews) * 1000) / 10 : 0, checkoutRate: pageviews > 0 ? Math.round((checkoutStarts / pageviews) * 1000) / 10 : 0, avgTimeOnPage, topPages, topReferrers, deviceBreakdown, dailyData, revenue: { total: revTotal, count: revCount, avgOrder, byTier, dailyRevenue } }, { headers: jh });
  } catch (e: any) { console.error('[ZPX] DASH ERR:', e?.message); return NextResponse.json({ pageviews: 0 }, { headers: jh }); }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': '*' } });
}