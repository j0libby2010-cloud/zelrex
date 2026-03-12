import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { AnalyticsService, TimeRange } from '@/lib/analytics';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const analyticsService = new AnalyticsService(supabase);

/**
 * GET /api/z/dash?userId=xxx&range=7d
 * 
 * Returns aggregated analytics data for the dashboard.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('userId');
  const range = (url.searchParams.get('range') || '30d') as TimeRange;

  if (!userId) {
    return NextResponse.json({ error: 'userId required' }, { status: 400 });
  }

  const validRanges: TimeRange[] = ['today', '7d', '30d', '90d', '365d'];
  if (!validRanges.includes(range)) {
    return NextResponse.json({ error: 'Invalid range' }, { status: 400 });
  }

  try {
    const summary = await analyticsService.getSummary(userId, range);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Analytics Dashboard] Error:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
