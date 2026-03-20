import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

let _sb: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _sb = createClient(url, key);
  return _sb;
}

let _ai: any = null;
function ai() {
  if (_ai) return _ai;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

// ═══════════════════════════════════════════════════════════════
// POST /api/z/outreach
//
// action=setup         → Save outreach settings (target audience, tone, limits)
// action=get-settings  → Get current settings
// action=find          → Discover new prospects using AI
// action=generate      → Generate personalized emails for queued prospects
// action=list          → List prospects with their emails
// action=approve       → Mark email as approved (ready to send)
// action=mark-sent     → Mark email as sent
// action=mark-replied  → Mark as replied
// action=archive       → Archive a prospect
// action=regenerate    → Regenerate email for a prospect
// action=stats         → Get outreach stats
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;
    const supabase = db();

    if (!userId || !supabase) {
      return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400 });
    }

    switch (action) {
      case 'setup': return handleSetup(supabase, userId, body);
      case 'get-settings': return handleGetSettings(supabase, userId);
      case 'find': return handleFind(supabase, userId);
      case 'generate': return handleGenerate(supabase, userId, body.prospectIds);
      case 'list': return handleList(supabase, userId, body.status);
      case 'approve': return handleStatusUpdate(supabase, body.emailId, 'approved');
      case 'mark-sent': return handleMarkSent(supabase, body.emailId);
      case 'mark-replied': return handleMarkReplied(supabase, body.emailId, body.prospectId);
      case 'archive': return handleArchive(supabase, body.prospectId);
      case 'regenerate': return handleRegenerate(supabase, userId, body.prospectId);
      case 'stats': return handleStats(supabase, userId);
      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[Outreach] Error:', e?.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── Setup ─────────────────────────────────────────────────────

async function handleSetup(supabase: SupabaseClient, userId: string, body: any) {
  const { dailyLimit, autoQueue, tone, followUpDays, targetDescription } = body;

  const { data, error } = await supabase.from('outreach_settings').upsert({
    user_id: userId,
    daily_limit: dailyLimit || 5,
    auto_queue: autoQueue ?? false,
    tone: tone || 'professional',
    follow_up_days: followUpDays || 3,
    target_description: targetDescription || '',
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

async function handleGetSettings(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('outreach_settings').select('*').eq('user_id', userId).single();
  return NextResponse.json({ settings: data || null });
}

// ─── Find Prospects ────────────────────────────────────────────

async function handleFind(supabase: SupabaseClient, userId: string) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  // Get user's business context
  const { data: settings } = await supabase.from('outreach_settings').select('*').eq('user_id', userId).single();
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);

  // Extract business info from chat history
  const chatContext = (chats?.[0]?.messages || [])
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => m.content)
    .join('\n')
    .slice(0, 3000);

  // Get existing prospects to avoid duplicates
  const { data: existing } = await supabase.from('outreach_prospects').select('name, company, email').eq('user_id', userId).limit(100);
  const existingNames = (existing || []).map((p: any) => `${p.name} - ${p.company || ''}`).join(', ');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: `You are Zelrex's outreach engine. Based on the user's business context, generate a list of realistic prospect profiles that would be ideal clients.

BUSINESS CONTEXT:
${chatContext}

TARGET AUDIENCE: ${settings?.target_description || 'Not specified — infer from business context'}
TONE PREFERENCE: ${settings?.tone || 'professional'}

EXISTING PROSPECTS (avoid duplicates): ${existingNames || 'none'}

Generate EXACTLY 5 new prospect profiles. For each, provide:
- A realistic name
- Their company/channel/brand name
- Their platform (youtube, instagram, linkedin, website)
- A plausible platform URL
- Why they'd be a good fit (1 sentence)
- A relevance score (1-100)

CRITICAL: These should be realistic TYPES of prospects, not real people. Use plausible but fictional names and companies that represent the ideal client profile.

Respond in JSON only, no markdown, no backticks:
[{"name":"...","company":"...","platform":"...","platform_url":"...","relevance_reason":"...","relevance_score":85}]`
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '[]';
  let prospects: any[] = [];
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    prospects = JSON.parse(cleaned);
  } catch {
    console.error('[Outreach] Failed to parse prospects:', text.slice(0, 200));
    return NextResponse.json({ error: 'Failed to generate prospects' }, { status: 500 });
  }

  // Insert prospects
  const rows = prospects.map((p: any) => ({
    user_id: userId,
    name: p.name,
    company: p.company || '',
    platform: p.platform || 'other',
    platform_url: p.platform_url || '',
    relevance_score: p.relevance_score || 70,
    relevance_reason: p.relevance_reason || '',
    status: 'discovered',
  }));

  const { data: inserted, error } = await supabase.from('outreach_prospects').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prospects: inserted });
}

// ─── Generate Emails ───────────────────────────────────────────

async function handleGenerate(supabase: SupabaseClient, userId: string, prospectIds?: string[]) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  // Get settings
  const { data: settings } = await supabase.from('outreach_settings').select('*').eq('user_id', userId).single();

  // Get prospects to write emails for
  let query = supabase.from('outreach_prospects').select('*').eq('user_id', userId);
  if (prospectIds?.length) {
    query = query.in('id', prospectIds);
  } else {
    query = query.eq('status', 'discovered').limit(settings?.daily_limit || 5);
  }
  const { data: prospects } = await query;

  if (!prospects?.length) return NextResponse.json({ emails: [], message: 'No prospects to write for' });

  // Get business context from chat
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  const chatContext = (chats?.[0]?.messages || [])
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => m.content)
    .join('\n')
    .slice(0, 2000);

  const emails: any[] = [];

  for (const prospect of prospects) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: `You are writing a cold outreach email for a freelancer. Write ONE personalized cold email.

FREELANCER'S BUSINESS:
${chatContext}

PROSPECT:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Platform: ${prospect.platform}
- URL: ${prospect.platform_url}
- Why they're a fit: ${prospect.relevance_reason}

TONE: ${settings?.tone || 'professional'}

RULES:
- Keep it under 120 words
- Reference something specific about their business
- One clear CTA (reply to book a call, see portfolio, etc.)
- No fake urgency or manipulation
- Sound human, not like a template
- Include a simple opt-out line at the bottom: "Not interested? Just reply 'pass' and I won't reach out again."

Respond in JSON only, no markdown:
{"subject":"...","body":"..."}`
      }],
    });

    const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
    try {
      const cleaned = text.replace(/```json|```/g, '').trim();
      const email = JSON.parse(cleaned);

      const { data: saved } = await supabase.from('outreach_emails').insert({
        user_id: userId,
        prospect_id: prospect.id,
        subject: email.subject,
        body: email.body,
        email_to: prospect.email || '',
        status: 'draft',
      }).select().single();

      // Update prospect status
      await supabase.from('outreach_prospects').update({ status: 'queued' }).eq('id', prospect.id);

      if (saved) emails.push({ ...saved, prospect });
    } catch (e) {
      console.error('[Outreach] Email generation failed for prospect:', prospect.name);
    }
  }

  return NextResponse.json({ emails });
}

// ─── List ──────────────────────────────────────────────────────

async function handleList(supabase: SupabaseClient, userId: string, status?: string) {
  let query = supabase.from('outreach_prospects').select(`
    *,
    outreach_emails (*)
  `).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospects: data || [] });
}

// ─── Status Updates ────────────────────────────────────────────

async function handleStatusUpdate(supabase: SupabaseClient, emailId: string, status: string) {
  if (!emailId) return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });
  const { error } = await supabase.from('outreach_emails').update({ status }).eq('id', emailId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function handleMarkSent(supabase: SupabaseClient, emailId: string) {
  if (!emailId) return NextResponse.json({ error: 'Missing emailId' }, { status: 400 });
  const { data: email } = await supabase.from('outreach_emails').update({
    status: 'sent', sent_at: new Date().toISOString(),
  }).eq('id', emailId).select().single();

  if (email?.prospect_id) {
    await supabase.from('outreach_prospects').update({ status: 'sent' }).eq('id', email.prospect_id);
  }
  return NextResponse.json({ ok: true });
}

async function handleMarkReplied(supabase: SupabaseClient, emailId: string, prospectId: string) {
  if (emailId) {
    await supabase.from('outreach_emails').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('id', emailId);
  }
  if (prospectId) {
    await supabase.from('outreach_prospects').update({ status: 'replied' }).eq('id', prospectId);
  }
  return NextResponse.json({ ok: true });
}

async function handleArchive(supabase: SupabaseClient, prospectId: string) {
  if (!prospectId) return NextResponse.json({ error: 'Missing prospectId' }, { status: 400 });
  await supabase.from('outreach_prospects').update({ status: 'archived' }).eq('id', prospectId);
  return NextResponse.json({ ok: true });
}

// ─── Regenerate ────────────────────────────────────────────────

async function handleRegenerate(supabase: SupabaseClient, userId: string, prospectId: string) {
  if (!prospectId) return NextResponse.json({ error: 'Missing prospectId' }, { status: 400 });

  // Delete existing emails for this prospect
  await supabase.from('outreach_emails').delete().eq('prospect_id', prospectId);

  // Reset prospect status
  await supabase.from('outreach_prospects').update({ status: 'discovered' }).eq('id', prospectId);

  // Generate new email
  return handleGenerate(supabase, userId, [prospectId]);
}

// ─── Stats ─────────────────────────────────────────────────────

async function handleStats(supabase: SupabaseClient, userId: string) {
  const [discovered, queued, sent, replied, archived] = await Promise.all([
    supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'discovered'),
    supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'queued'),
    supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'sent'),
    supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'replied'),
    supabase.from('outreach_prospects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'archived'),
  ]);

  const totalSent = sent.count || 0;
  const totalReplied = replied.count || 0;

  return NextResponse.json({
    discovered: discovered.count || 0,
    queued: queued.count || 0,
    sent: totalSent,
    replied: totalReplied,
    archived: archived.count || 0,
    replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
  });
}
