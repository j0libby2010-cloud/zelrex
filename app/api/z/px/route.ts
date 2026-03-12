import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 1x1 transparent GIF
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

// Map short event codes to full names
const EVENT_MAP: Record<string, string> = {
  pv: 'pageview',
  cc: 'cta_click',
  cs: 'checkout_start',
  sd: 'scroll_depth',
  tp: 'time_on_page',
};

/**
 * GET /api/z/px?u=userId&t=pv&v=visitorId&p=/&r=referrer&d=d&x=extra
 * 
 * Tracking pixel endpoint. Returns a 1x1 transparent GIF.
 * Uses GET + Image() requests which are NEVER blocked by ad blockers,
 * privacy shields, or Brave browser.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get('u');
  const eventCode = url.searchParams.get('t');
  const visitorId = url.searchParams.get('v') || '';
  const pagePath = url.searchParams.get('p') || '/';
  const referrer = url.searchParams.get('r') || '';
  const deviceCode = url.searchParams.get('d') || 'd';
  const extra = url.searchParams.get('x') || '';

  const headers = {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Access-Control-Allow-Origin': '*',
  };

  // Always return the pixel, even if params are invalid
  if (!userId || !eventCode) {
    return new NextResponse(PIXEL, { status: 200, headers });
  }

  const eventType = EVENT_MAP[eventCode];
  if (!eventType) {
    return new NextResponse(PIXEL, { status: 200, headers });
  }

  const deviceMap: Record<string, string> = { d: 'desktop', m: 'mobile', t: 'tablet' };
  const country = req.headers.get('x-vercel-ip-country') ||
                  req.headers.get('cf-ipcountry') ||
                  'unknown';

  // Build metadata from extra param
  let metadata: Record<string, any> = {};
  if (eventType === 'scroll_depth' && extra) {
    metadata = { depth: parseInt(extra) || 0 };
  } else if (eventType === 'time_on_page' && extra) {
    metadata = { seconds: parseInt(extra) || 0 };
  } else if (extra) {
    metadata = { detail: extra };
  }

  // Fire and forget — don't await, return pixel immediately
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
  }).then(({ error }) => {
    if (error) console.error('[Pixel] Insert failed:', error);
  });

  return new NextResponse(PIXEL, { status: 200, headers });
}
