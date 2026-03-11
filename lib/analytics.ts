import { SupabaseClient } from '@supabase/supabase-js';

export type TimeRange = 'today' | '7d' | '30d' | '90d' | '365d';

export interface AnalyticsSummary {
  timeRange: TimeRange;
  pageviews: number;
  uniqueVisitors: number;
  ctaClicks: number;
  checkoutStarts: number;
  conversionRate: number;        // ctaClicks / pageviews * 100
  checkoutRate: number;          // checkoutStarts / pageviews * 100
  avgTimeOnPage: number;         // seconds
  topPages: { path: string; views: number }[];
  topReferrers: { referrer: string; count: number }[];
  deviceBreakdown: { device: string; count: number; pct: number }[];
  dailyData: { date: string; pageviews: number; visitors: number; clicks: number; checkouts: number }[];
  revenue: {
    total: number;       // cents
    count: number;       // number of payments
    avgOrder: number;    // cents
    byTier: { tier: string; total: number; count: number }[];
    dailyRevenue: { date: string; amount: number; count: number }[];
  };
}

function getRangeDate(range: TimeRange): Date {
  const now = new Date();
  switch (range) {
    case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case '7d': { const d = new Date(); d.setDate(d.getDate() - 7); return d; }
    case '30d': { const d = new Date(); d.setDate(d.getDate() - 30); return d; }
    case '90d': { const d = new Date(); d.setDate(d.getDate() - 90); return d; }
    case '365d': { const d = new Date(); d.setDate(d.getDate() - 365); return d; }
  }
}

export class AnalyticsService {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async getSummary(userId: string, range: TimeRange = '30d'): Promise<AnalyticsSummary> {
    const since = getRangeDate(range).toISOString();

    // Run all queries in parallel
    const [
      pageviewsRes,
      visitorsRes,
      ctaRes,
      checkoutRes,
      timeRes,
      topPagesRes,
      topReferrersRes,
      devicesRes,
      dailyRes,
      revenueRes,
      revByTierRes,
      dailyRevRes,
    ] = await Promise.all([
      // Total pageviews
      this.supabase.from('site_analytics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('event_type', 'pageview')
        .gte('created_at', since),

      // Unique visitors
      this.supabase.rpc('count_unique_visitors', { p_user_id: userId, p_since: since })
        .single()
        .then(r => (r.data as { count?: number } | null)?.count ?? 0)
        .then(null, () => this.fallbackUniqueVisitors(userId, since)),

      // CTA clicks
      this.supabase.from('site_analytics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('event_type', 'cta_click')
        .gte('created_at', since),

      // Checkout starts
      this.supabase.from('site_analytics')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId).eq('event_type', 'checkout_start')
        .gte('created_at', since),

      // Avg time on page
      this.supabase.from('site_analytics')
        .select('metadata')
        .eq('user_id', userId).eq('event_type', 'time_on_page')
        .gte('created_at', since)
        .limit(1000),

      // Top pages
      this.supabase.from('site_analytics')
        .select('page_path')
        .eq('user_id', userId).eq('event_type', 'pageview')
        .gte('created_at', since)
        .limit(5000),

      // Top referrers
      this.supabase.from('site_analytics')
        .select('referrer')
        .eq('user_id', userId).eq('event_type', 'pageview')
        .gte('created_at', since)
        .neq('referrer', '')
        .limit(5000),

      // Device breakdown
      this.supabase.from('site_analytics')
        .select('device_type')
        .eq('user_id', userId).eq('event_type', 'pageview')
        .gte('created_at', since)
        .limit(5000),

      // Daily data for charts
      this.supabase.from('site_analytics')
        .select('event_type, created_at')
        .eq('user_id', userId)
        .in('event_type', ['pageview', 'cta_click', 'checkout_start'])
        .gte('created_at', since)
        .order('created_at')
        .limit(50000),

      // Revenue total
      this.supabase.from('site_revenue')
        .select('amount_cents')
        .eq('user_id', userId)
        .gte('created_at', since),

      // Revenue by tier
      this.supabase.from('site_revenue')
        .select('tier_name, amount_cents')
        .eq('user_id', userId)
        .gte('created_at', since),

      // Daily revenue
      this.supabase.from('site_revenue')
        .select('amount_cents, created_at')
        .eq('user_id', userId)
        .gte('created_at', since)
        .order('created_at'),
    ]);

    const pageviews = pageviewsRes.count || 0;
    const uniqueVisitors = typeof visitorsRes === 'number' ? visitorsRes : 0;
    const ctaClicks = ctaRes.count || 0;
    const checkoutStarts = checkoutRes.count || 0;

    // Avg time on page
    const times = (timeRes.data || [])
      .map((r: any) => {
        const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        return m?.seconds || 0;
      })
      .filter((s: number) => s > 0 && s < 3600);
    const avgTimeOnPage = times.length > 0 ? Math.round(times.reduce((a: number, b: number) => a + b, 0) / times.length) : 0;

    // Top pages
    const pageCounts: Record<string, number> = {};
    (topPagesRes.data || []).forEach((r: any) => { pageCounts[r.page_path || '/'] = (pageCounts[r.page_path || '/'] || 0) + 1; });
    const topPages = Object.entries(pageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }));

    // Top referrers
    const refCounts: Record<string, number> = {};
    (topReferrersRes.data || []).forEach((r: any) => {
      try { const host = new URL(r.referrer).hostname; refCounts[host] = (refCounts[host] || 0) + 1; } catch { /* skip */ }
    });
    const topReferrers = Object.entries(refCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([referrer, count]) => ({ referrer, count }));

    // Device breakdown
    const devCounts: Record<string, number> = {};
    (devicesRes.data || []).forEach((r: any) => { devCounts[r.device_type || 'unknown'] = (devCounts[r.device_type || 'unknown'] || 0) + 1; });
    const totalDev = Object.values(devCounts).reduce((a, b) => a + b, 0) || 1;
    const deviceBreakdown = Object.entries(devCounts)
      .map(([device, count]) => ({ device, count, pct: Math.round((count / totalDev) * 100) }))
      .sort((a, b) => b.count - a.count);

    // Daily data for charts
    const dailyMap: Record<string, { pageviews: number; visitors: Set<string>; clicks: number; checkouts: number }> = {};
    (dailyRes.data || []).forEach((r: any) => {
      const day = r.created_at.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { pageviews: 0, visitors: new Set(), clicks: 0, checkouts: 0 };
      if (r.event_type === 'pageview') dailyMap[day].pageviews++;
      if (r.event_type === 'cta_click') dailyMap[day].clicks++;
      if (r.event_type === 'checkout_start') dailyMap[day].checkouts++;
    });
    const dailyData = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        pageviews: d.pageviews,
        visitors: d.visitors.size || d.pageviews, // fallback
        clicks: d.clicks,
        checkouts: d.checkouts,
      }));

    // Revenue
    const revData = revenueRes.data || [];
    const revTotal = revData.reduce((sum: number, r: any) => sum + (r.amount_cents || 0), 0);
    const revCount = revData.length;
    const avgOrder = revCount > 0 ? Math.round(revTotal / revCount) : 0;

    // Revenue by tier
    const tierMap: Record<string, { total: number; count: number }> = {};
    (revByTierRes.data || []).forEach((r: any) => {
      const t = r.tier_name || 'Unknown';
      if (!tierMap[t]) tierMap[t] = { total: 0, count: 0 };
      tierMap[t].total += r.amount_cents || 0;
      tierMap[t].count++;
    });
    const byTier = Object.entries(tierMap).map(([tier, d]) => ({ tier, ...d }));

    // Daily revenue
    const dailyRevMap: Record<string, { amount: number; count: number }> = {};
    (dailyRevRes.data || []).forEach((r: any) => {
      const day = r.created_at.slice(0, 10);
      if (!dailyRevMap[day]) dailyRevMap[day] = { amount: 0, count: 0 };
      dailyRevMap[day].amount += r.amount_cents || 0;
      dailyRevMap[day].count++;
    });
    const dailyRevenue = Object.entries(dailyRevMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }));

    return {
      timeRange: range,
      pageviews,
      uniqueVisitors,
      ctaClicks,
      checkoutStarts,
      conversionRate: pageviews > 0 ? Math.round((ctaClicks / pageviews) * 1000) / 10 : 0,
      checkoutRate: pageviews > 0 ? Math.round((checkoutStarts / pageviews) * 1000) / 10 : 0,
      avgTimeOnPage,
      topPages,
      topReferrers,
      deviceBreakdown,
      dailyData,
      revenue: { total: revTotal, count: revCount, avgOrder, byTier, dailyRevenue },
    };
  }

  private async fallbackUniqueVisitors(userId: string, since: string): Promise<number> {
    const { data } = await this.supabase
      .from('site_analytics')
      .select('visitor_id')
      .eq('user_id', userId).eq('event_type', 'pageview')
      .gte('created_at', since)
      .limit(10000);
    const unique = new Set((data || []).map((r: any) => r.visitor_id));
    return unique.size;
  }

  /**
   * Get a text summary for Zelrex to use in business guidance
   */
  async getTextSummary(userId: string, range: TimeRange = '7d'): Promise<string> {
    const s = await this.getSummary(userId, range);
    const lines: string[] = [];

    lines.push(`WEBSITE ANALYTICS (last ${range}):`);
    lines.push(`  Pageviews: ${s.pageviews} | Unique visitors: ${s.uniqueVisitors}`);
    lines.push(`  CTA clicks: ${s.ctaClicks} (${s.conversionRate}% of visitors)`);
    lines.push(`  Checkout starts: ${s.checkoutStarts} (${s.checkoutRate}% of visitors)`);
    lines.push(`  Avg time on page: ${s.avgTimeOnPage}s`);

    if (s.topPages.length > 0) {
      lines.push(`  Top pages: ${s.topPages.slice(0, 5).map(p => `${p.path} (${p.views})`).join(', ')}`);
    }
    if (s.topReferrers.length > 0) {
      lines.push(`  Top referrers: ${s.topReferrers.slice(0, 5).map(r => `${r.referrer} (${r.count})`).join(', ')}`);
    }
    if (s.deviceBreakdown.length > 0) {
      lines.push(`  Devices: ${s.deviceBreakdown.map(d => `${d.device} ${d.pct}%`).join(', ')}`);
    }
    if (s.revenue.total > 0) {
      lines.push(`  Revenue: $${(s.revenue.total / 100).toFixed(2)} from ${s.revenue.count} payments (avg $${(s.revenue.avgOrder / 100).toFixed(2)})`);
    } else {
      lines.push(`  Revenue: $0 (no payments recorded yet)`);
    }

    // Insights
    if (s.conversionRate < 2 && s.pageviews > 50) {
      lines.push(`  ⚠ LOW CONVERSION: ${s.conversionRate}% CTA click rate suggests the pricing section or CTAs need work.`);
    }
    if (s.pageviews > 0 && s.pageviews < 20) {
      lines.push(`  ⚠ LOW TRAFFIC: Only ${s.pageviews} pageviews — outreach volume is the bottleneck, not the site.`);
    }
    if (s.avgTimeOnPage < 15 && s.pageviews > 30) {
      lines.push(`  ⚠ LOW ENGAGEMENT: ${s.avgTimeOnPage}s avg time on page — visitors are bouncing. The hero section may not be compelling enough.`);
    }

    return lines.join('\n');
  }
}
