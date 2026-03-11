import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_EVENTS = ['pageview', 'cta_click', 'checkout_start', 'scroll_depth', 'time_on_page'];

/**
 * POST /api/analytics/track
 * 
 * Receives tracking events from deployed freelancer websites.
 * Called by the injected tracker script via sendBeacon or XHR.
 * 
 * CORS is open since this needs to be called from any deployed domain.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.user_id || !body.event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!VALID_EVENTS.includes(body.event_type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Rate limit: max 100 events per visitor per session (prevent abuse)
    // For v1, we'll just insert. Add rate limiting later if needed.

    // Parse metadata if it's a string
    let metadata = body.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

    // Get approximate country from headers (Vercel provides this)
    const country = req.headers.get('x-vercel-ip-country') || 
                    req.headers.get('cf-ipcountry') || 
                    'unknown';

    const { error } = await supabase.from('site_analytics').insert({
      user_id: body.user_id,
      site_id: body.site_id || null,
      event_type: body.event_type,
      page_path: (body.page_path || '/').slice(0, 500),
      element_id: (body.element_id || '').slice(0, 200),
      element_text: (body.element_text || '').slice(0, 200),
      visitor_id: (body.visitor_id || '').slice(0, 100),
      referrer: (body.referrer || '').slice(0, 500),
      device_type: body.device_type || 'unknown',
      country,
      metadata,
    });

    if (error) {
      console.error('[Analytics] Insert failed:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[Analytics] Error:', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * OPTIONS — CORS preflight for cross-origin requests from deployed sites
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
