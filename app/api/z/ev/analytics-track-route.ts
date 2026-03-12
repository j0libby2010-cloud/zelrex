import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_EVENTS = ['pageview', 'cta_click', 'checkout_start', 'scroll_depth', 'time_on_page'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * POST /api/analytics/track
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body.user_id || !body.event_type) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: CORS_HEADERS });
    }

    if (!VALID_EVENTS.includes(body.event_type)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400, headers: CORS_HEADERS });
    }

    let metadata = body.metadata || {};
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata); } catch { metadata = {}; }
    }

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
      return NextResponse.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
  } catch (e) {
    console.error('[Analytics] Error:', e);
    return NextResponse.json({ ok: false }, { status: 500, headers: CORS_HEADERS });
  }
}

/**
 * OPTIONS — CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}
