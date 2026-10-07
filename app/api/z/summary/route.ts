import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { validateOutput, RELIABILITY_PROMPT } from '@/lib/aiSafety';
import { createMessage } from "@/lib/models";

let supabase: any = null;
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) supabase = createClient(url, key);
} catch {}

let anthropic: any = null;
try {
  if (process.env.ANTHROPIC_API_KEY) anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} catch {}

// ═══════════════════════════════════════════════════════════════
// POST /api/z/summary
//
// action=generate  → Generate a new weekly summary
// action=list      → List all past summaries
// action=get       → Get a specific summary by ID
// action=chat      → Chat about a summary
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;

    if (!userId || !supabase) {
      return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400 });
    }

    switch (action) {
      case 'generate': return handleGenerate(userId);
      case 'list': return handleList(userId);
      case 'get': return handleGet(body.summaryId);
      case 'chat': return handleChat(userId, body.summaryId, body.message, body.history);
      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[Summary] Error:', e?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── Generate Summary ──────────────────────────────────────────

async function handleGenerate(userId: string) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  // Get this week's analytics (last 7 days)
  const now = new Date();
  const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
  const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);

  const [thisWeek, lastWeek, revenue] = await Promise.all([
    getAnalytics(userId, weekAgo.toISOString(), now.toISOString()),
    getAnalytics(userId, twoWeeksAgo.toISOString(), weekAgo.toISOString()),
    getRevenue(userId, weekAgo.toISOString(), now.toISOString()),
  ]);

  // Build analytics context for Claude
  const context = buildContext(thisWeek, lastWeek, revenue, now);

  const response = await createMessage(anthropic, "standard", {
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `${RELIABILITY_PROMPT}

You are Zelrex, an AI business co-pilot for freelancers. Write a weekly business summary from the analytics data below. Be specific and plain. Never give financial advice.

${context}

Write these sections, each with a ## heading:
## Performance Snapshot: this week's numbers next to last week's. Use ↑ ↓ → for direction only when last week was above zero.
## What's Working: 1-2 things the data actually shows.
## What Needs Attention: 1-2 issues, each with options the user could consider.
## Worth Considering This Week: ONE option for the next 7 days, framed as something to consider, not an instruction.

RULES:
- Sample size comes first. With fewer than 30 unique visitors, say plainly that the sample is too small to draw conclusions, and keep every observation tentative ("so far", "too early to tell"). Never call small numbers strong, exceptional, outstanding or proven.
- Use only the numbers in the data above. Do not cite industry averages, benchmarks or typical rates, because none were provided.
- Phrase suggestions as options ("one option is...", "you could..."). Never tell the user what to do. No financial, pricing or revenue advice, and no predictions. Business decisions are theirs.
- Do not invent metrics, client names or revenue. If a section has no data, write "No data for this period."
- Tag any projection as [ESTIMATED].
- No emoji, no hype, no filler. Under 300 words.
- End with exactly: "Based on available data and AI analysis. Verify key metrics yourself."`
    }],
  });

  const rawSummaryText = response.content[0]?.type === 'text' ? response.content[0].text : '';
  const summaryText = validateOutput(rawSummaryText, {
    checkFinancial: true,
    checkGuarantee: true,
    checkCompetitor: false,
    checkContract: false,
  });

  // Store in Supabase
  const weekStart = weekAgo.toISOString().slice(0, 10);
  const weekEnd = now.toISOString().slice(0, 10);

  const { data: saved, error } = await supabase.from('weekly_summaries').insert({
    user_id: userId,
    week_start: weekStart,
    week_end: weekEnd,
    summary_text: summaryText,
    analytics_snapshot: {
      pageviews: thisWeek.pageviews,
      visitors: thisWeek.visitors,
      ctaClicks: thisWeek.ctaClicks,
      checkoutStarts: thisWeek.checkoutStarts,
      prevPageviews: lastWeek.pageviews,
      prevVisitors: lastWeek.visitors,
      prevCtaClicks: lastWeek.ctaClicks,
      revenue: revenue.total,
    },
  }).select().single();

  if (error) {
    console.error('[Summary] Insert error:', error.message);
    return NextResponse.json({ error: 'Failed to save summary' }, { status: 500 });
  }

  return NextResponse.json({ summary: saved });
}

// ─── List Summaries ────────────────────────────────────────────

async function handleList(userId: string) {
  const { data, error } = await supabase
    .from('weekly_summaries')
    .select('id, week_start, week_end, analytics_snapshot, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(52); // Up to a year of weeklies

  if (error) {
    console.error('[Summary] List error:', error.message);
    return NextResponse.json({ summaries: [] });
  }

  return NextResponse.json({ summaries: data || [] });
}

// ─── Get Specific Summary ──────────────────────────────────────

async function handleGet(summaryId: string) {
  if (!summaryId) return NextResponse.json({ error: 'Missing summaryId' }, { status: 400 });

  const { data, error } = await supabase
    .from('weekly_summaries')
    .select('*')
    .eq('id', summaryId)
    .single();

  if (error) return NextResponse.json({ error: 'Summary not found' }, { status: 404 });
  return NextResponse.json({ summary: data });
}

// ─── Chat About Summary ────────────────────────────────────────

async function handleChat(userId: string, summaryId: string, message: string, history: any[]) {
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const text = typeof message === 'string' ? message.trim().slice(0, 4000) : '';
  if (!text) return NextResponse.json({ error: 'Missing message' }, { status: 400 });

  try {
    // Only this user's own summary is used as context.
    const { data: summary } = await supabase
      .from('weekly_summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('user_id', userId)
      .single();

    const systemPrompt = `You are Zelrex, an AI business co-pilot for freelancers. The user is asking about their weekly business summary below.

Week: ${summary?.week_start} to ${summary?.week_end}
Analytics: ${JSON.stringify(summary?.analytics_snapshot || {})}
Summary: ${summary?.summary_text || 'No summary available'}

Rules:
- Answer from this data. Be concise and plain, with no hype and no emoji.
- If the sample is small (under 30 unique visitors), say so before drawing any conclusion.
- Do not cite industry averages or benchmarks you were not given.
- Offer options, not instructions. Never give financial advice, predict results or guarantee outcomes.
- If the data does not answer the question, say so.`;

    // Keep only well-formed turns, cap the length, and make sure the first turn is the user's.
    const prior = (Array.isArray(history) ? history : [])
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).slice(0, 4000) }));
    while (prior.length && prior[0].role !== 'user') prior.shift();

    const response = await createMessage(anthropic, "standard", {
      max_tokens: 800,
      system: systemPrompt,
      messages: [...prior, { role: 'user' as const, content: text }],
    });

    const reply = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    if (!reply) return NextResponse.json({ error: 'Empty reply' }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (e: any) {
    // The status and message land in the Vercel logs so a model or key problem is visible.
    console.error('[Summary] Chat error:', e?.status, e?.message);
    return NextResponse.json({ error: 'Chat failed' }, { status: 502 });
  }
}

// ─── Helpers ───────────────────────────────────────────────────

async function getAnalytics(userId: string, since: string, until: string) {
  const [pvR, ccR, csR] = await Promise.all([
    supabase.from('site_analytics').select('visitor_id').eq('user_id', userId).eq('event_type', 'pageview').gte('created_at', since).lt('created_at', until).limit(10000),
    supabase.from('site_analytics').select('element_text').eq('user_id', userId).eq('event_type', 'cta_click').gte('created_at', since).lt('created_at', until).limit(10000),
    supabase.from('site_analytics').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('event_type', 'checkout_start').gte('created_at', since).lt('created_at', until),
  ]);

  const pvData = pvR.data || [];
  return {
    pageviews: pvData.length,
    visitors: new Set(pvData.map((r: any) => r.visitor_id)).size,
    ctaClicks: (ccR.data || []).length,
    checkoutStarts: csR.count || 0,
    topCtas: Object.entries((ccR.data || []).reduce((acc: any, r: any) => { const k = r.element_text || 'unknown'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).sort(([, a]: any, [, b]: any) => b - a).slice(0, 5),
  };
}

async function getRevenue(userId: string, since: string, until: string) {
  const { data } = await supabase.from('site_revenue').select('amount_cents, tier_name').eq('user_id', userId).gte('created_at', since).lt('created_at', until);
  const rows = data || [];
  return {
    total: rows.reduce((s: number, r: any) => s + (r.amount_cents || 0), 0),
    count: rows.length,
  };
}

function buildContext(thisWeek: any, lastWeek: any, revenue: any, now: Date): string {
  const pctChange = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 'no baseline, last week was 0' : '0%';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct > 0 ? `+${pct}%` : `${pct}%`;
  };

  return `ANALYTICS DATA (Week of ${now.toISOString().slice(0, 10)}):

THIS WEEK:
- Pageviews: ${thisWeek.pageviews} (${pctChange(thisWeek.pageviews, lastWeek.pageviews)} vs last week)
- Unique visitors: ${thisWeek.visitors} (${pctChange(thisWeek.visitors, lastWeek.visitors)} vs last week)${thisWeek.visitors < 30 ? ' [SMALL SAMPLE: under 30 visitors]' : ''}
- CTA clicks: ${thisWeek.ctaClicks} (${pctChange(thisWeek.ctaClicks, lastWeek.ctaClicks)} vs last week)
- Checkout starts: ${thisWeek.checkoutStarts}
- Click rate: ${thisWeek.pageviews > 0 ? ((thisWeek.ctaClicks / thisWeek.pageviews) * 100).toFixed(1) : 0}%
- Top CTAs clicked: ${thisWeek.topCtas.map(([k, v]: any) => `${k} (${v})`).join(', ') || 'none'}

LAST WEEK:
- Pageviews: ${lastWeek.pageviews}
- Unique visitors: ${lastWeek.visitors}
- CTA clicks: ${lastWeek.ctaClicks}

REVENUE THIS WEEK: $${(revenue.total / 100).toFixed(2)} from ${revenue.count} payments

${thisWeek.pageviews === 0 ? 'NOTE: No traffic this week. The user may not be actively driving traffic yet. Focus suggestions on outreach and sharing.' : ''}
${thisWeek.ctaClicks === 0 && thisWeek.pageviews > 10 ? 'NOTE: Traffic but zero CTA clicks suggests the site copy or CTA placement needs work.' : ''}`;
}