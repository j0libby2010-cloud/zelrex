/**
 * EMAIL SEND API ROUTE
 * POST /api/z/email
 * 
 * Sends transactional emails to users who have enabled them in settings.
 * 
 * SECURITY: This endpoint is sensitive — it sends real emails to real users.
 * Must be protected by CRON_SECRET for automated sends, or admin user ID for manual sends.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  sendWeeklyReport,
  sendMilestoneEmail,
  sendMarketAlertEmail,
  sendProductUpdateEmail,
} from '@/lib/resend';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const VALID_TYPES = ['weekly_report', 'milestone', 'market_alert', 'product_update'] as const;
type EmailType = typeof VALID_TYPES[number];

// Per-type cooldowns prevent spamming users
const EMAIL_COOLDOWNS: Record<EmailType, number> = {
  weekly_report: 6 * 24 * 3600 * 1000,
  milestone: 1 * 3600 * 1000,
  market_alert: 2 * 24 * 3600 * 1000,
  product_update: 7 * 24 * 3600 * 1000,
};

function validateUserId(userId: any): string | null {
  if (!userId || typeof userId !== 'string') return null;
  if (!/^user_[a-zA-Z0-9]{10,50}$/.test(userId)) return null;
  return userId;
}

export async function POST(req: Request) {
  try {
    // AUTH: Require cron secret OR admin user ID
    const authHeader = req.headers.get('authorization');
    const isCronAuthed = authHeader === `Bearer ${process.env.CRON_SECRET}`;

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const isAdmin = body.adminUserId && body.adminUserId === process.env.ADMIN_USER_ID;

    if (!isCronAuthed && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, userId: rawUserId, data } = body;

    const userId = validateUserId(rawUserId);
    if (!userId) return NextResponse.json({ error: 'Invalid userId' }, { status: 400 });

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid email type' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'Invalid data payload' }, { status: 400 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, email_preferences, full_name')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('[Email] User fetch error:', userError.message);
      return NextResponse.json({ error: 'User lookup failed' }, { status: 500 });
    }

    if (!user?.email) {
      return NextResponse.json({ error: 'User has no email on file' }, { status: 400 });
    }

    // Validate email format (defense against bad DB data)
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(user.email)) {
      return NextResponse.json({ error: 'Invalid user email format' }, { status: 400 });
    }

    const prefs = user.email_preferences || {};
    const userName = (user.full_name || '').split(' ')[0]?.slice(0, 50) || 'there';

    const prefKey = typeToPrefKey(type);
    if (prefKey && prefs[prefKey] === false) {
      return NextResponse.json({ skipped: 'User has this email type disabled' });
    }

    // DEDUP: Check cooldown
    const cooldownMs = EMAIL_COOLDOWNS[type as EmailType];
    if (cooldownMs) {
      const cutoff = new Date(Date.now() - cooldownMs).toISOString();
      const { data: recent } = await supabase
        .from('email_log')
        .select('id, sent_at')
        .eq('user_id', userId)
        .eq('type', type)
        .gte('sent_at', cutoff)
        .limit(1);

      if (recent && recent.length > 0) {
        console.log(`[Email] Cooldown active: ${type} to ${userId}`);
        return NextResponse.json({ skipped: 'Cooldown active', lastSent: recent[0].sent_at });
      }
    }

    let result;
    try {
      switch (type) {
        case 'weekly_report':
          result = await sendWeeklyReport(user.email, { userName, ...data });
          break;
        case 'milestone':
          if (!data.milestone || !data.nextMilestone) {
            return NextResponse.json({ error: 'Missing milestone data' }, { status: 400 });
          }
          result = await sendMilestoneEmail(
            user.email,
            userName,
            String(data.milestone).slice(0, 200),
            String(data.nextMilestone).slice(0, 500)
          );
          break;
        case 'market_alert':
          if (!data.niche || !data.alert) {
            return NextResponse.json({ error: 'Missing alert data' }, { status: 400 });
          }
          result = await sendMarketAlertEmail(
            user.email,
            userName,
            String(data.niche).slice(0, 100),
            String(data.alert).slice(0, 1000),
            String(data.opportunity || '').slice(0, 1000)
          );
          break;
        case 'product_update':
          if (!Array.isArray(data.features) || data.features.length === 0) {
            return NextResponse.json({ error: 'Missing features array' }, { status: 400 });
          }
          const safeFeatures = data.features.slice(0, 10).map((f: any) => ({
            title: String(f.title || '').slice(0, 200),
            description: String(f.description || '').slice(0, 500),
          }));
          result = await sendProductUpdateEmail(user.email, userName, safeFeatures);
          break;
      }
    } catch (sendErr: any) {
      console.error('[Email] Send failed:', sendErr?.message);
      return NextResponse.json({ error: 'Email send failed', details: sendErr?.message }, { status: 500 });
    }

    if (!result || !result.success) {
      console.error('[Email] Resend returned failure:', result?.error);
      return NextResponse.json({ error: result?.error || 'Unknown send error' }, { status: 500 });
    }

    supabase.from('email_log').insert({
      user_id: userId,
      type,
      to_email: user.email,
      resend_id: result.id,
      sent_at: new Date().toISOString(),
      status: 'sent',
    }).then(({ error }) => {
      if (error) console.warn('[Email] Audit log insert failed:', error.message);
    });

    return NextResponse.json({ success: true, id: result.id });
  } catch (err: any) {
    console.error('[Email Send] Unexpected error:', err?.message);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

function typeToPrefKey(type: string): string | null {
  switch (type) {
    case 'weekly_report': return 'emailWeeklyReport';
    case 'milestone': return 'emailGoalMilestones';
    case 'market_alert': return 'emailMarketAlerts';
    case 'product_update': return 'emailProductUpdates';
    default: return null;
  }
}