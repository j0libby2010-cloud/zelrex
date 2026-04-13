import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { collectDataPoint, maybeAggregate } from '@/lib/dataCollector';

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
// RATE LIMITING
// ═══════════════════════════════════════════════════════════════
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const AI_ACTIONS = new Set(['find', 'generate', 'regenerate', 'generate-followup', 'generate-linkedin-dm']);
function checkRateLimit(userId: string, action: string): boolean {
  const isAI = AI_ACTIONS.has(action);
  const windowMs = isAI ? 60_000 : 10_000;
  const maxReqs = isAI ? 5 : 30;
  const key = `${userId}:${isAI ? 'ai' : 'crud'}`;
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count++;
  return bucket.count <= maxReqs;
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
// action=stats         → Get outreach stats (includes per-template response rate)
// action=generate-linkedin-dm → Generate LinkedIn DM script for a prospect
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;
    const supabase = db();

    if (!userId || !supabase) {
      return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400 });
    }

    // Rate limit check
    if (!checkRateLimit(userId, action)) {
      console.warn(`[Outreach] Rate limited: user=${userId} action=${action}`);
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    switch (action) {
      case 'setup': return handleSetup(supabase, userId, body);
      case 'get-settings': return handleGetSettings(supabase, userId);
      case 'find': return handleFind(supabase, userId);
      case 'add-manual': return handleAddManual(supabase, userId, body);
      case 'generate': return handleGenerate(supabase, userId, body.prospectIds);
      case 'list': return handleList(supabase, userId, body.status);
      case 'approve': return handleStatusUpdate(supabase, body.emailId, 'approved');
      case 'mark-sent': return handleMarkSent(supabase, body.emailId);
      case 'mark-replied': return handleMarkReplied(supabase, body.emailId, body.prospectId);
      case 'archive': return handleArchive(supabase, body.prospectId);
      case 'regenerate': return handleRegenerate(supabase, userId, body.prospectId);
      case 'stats': return handleStats(supabase, userId);
      case 'generate-followup': return handleFollowUp(supabase, userId, body.prospectId);
      case 'generate-linkedin-dm': return handleLinkedInDM(supabase, userId, body.prospectId);
      case 'ab-generate': return handleABGenerate(supabase, userId, body.prospectId);
      case 'ab-results': return handleABResults(supabase, userId);
      case 'find-email': return handleFindEmail(supabase, userId, body.prospectId);
      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[Outreach] Error:', e?.message, e?.stack?.slice(0, 300));
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

  const chatContext = (chats?.[0]?.messages || [])
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => m.content)
    .join('\n')
    .slice(0, 3000);

  // Get existing prospects to avoid duplicates
  const { data: existing } = await supabase.from('outreach_prospects').select('name, company').eq('user_id', userId).limit(100);
  const existingNames = (existing || []).map((p: any) => `${p.name} - ${p.company || ''}`).join(', ');

  const targetDesc = settings?.target_description || '';

  // Use Claude with web search to find REAL businesses
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 3000,
    tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
    messages: [{
      role: 'user',
      content: `You are Zelrex's prospect discovery engine. Your job is to find REAL businesses that would benefit from this freelancer's services.

FREELANCER'S BUSINESS CONTEXT:
${chatContext}

TARGET AUDIENCE: ${targetDesc || 'Infer from the business context above'}

EXISTING PROSPECTS (avoid these): ${existingNames || 'none'}

INSTRUCTIONS:
1. Search the web for real businesses matching the target audience
2. Find 5 REAL businesses with verifiable online presence
3. For each prospect, include the actual source URL where you found them
4. Every name, company, and URL must be real and verifiable

After searching, respond with ONLY this JSON (no markdown, no backticks, no other text):
[{"name":"Owner/Contact Name","company":"Real Business Name","platform":"website","platform_url":"https://their-actual-website.com","source_url":"https://where-you-found-them.com","relevance_reason":"Why they need this service - be specific about what you observed","relevance_score":85}]

CRITICAL: Only include businesses you actually found via web search. Every source_url must be a real page. If you can't find enough real prospects, return fewer than 5 rather than inventing any.`
    }],
  });

  // Extract text from response (may have multiple content blocks from tool use)
  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }

  let prospects: any[] = [];
  try {
    // Find JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      prospects = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.error('[Outreach] Failed to parse prospects:', text.slice(0, 300));
    return NextResponse.json({ error: 'Failed to find real prospects. Try adjusting your target audience description.' }, { status: 500 });
  }

  if (!prospects.length) {
    return NextResponse.json({ error: 'No matching prospects found. Try broadening your target audience.' }, { status: 404 });
  }

  // Insert prospects with source URLs
  const rows = prospects.map((p: any) => ({
    user_id: userId,
    name: p.name || 'Unknown',
    company: p.company || '',
    platform: p.platform || 'website',
    platform_url: p.platform_url || '',
    source_url: p.source_url || '',
    relevance_score: Math.min(100, Math.max(0, p.relevance_score || 70)),
    relevance_reason: p.relevance_reason || '',
    status: 'discovered',
  }));

  const { data: inserted, error } = await supabase.from('outreach_prospects').insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ prospects: inserted, verified: true });
}

// ─── Add Manual Prospect ───────────────────────────────────────

async function handleAddManual(supabase: SupabaseClient, userId: string, body: any) {
  const { name, company, email, platform_url, notes } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  const { data, error } = await supabase.from('outreach_prospects').insert({
    user_id: userId,
    name: name.trim(),
    company: company?.trim() || '',
    email: email?.trim() || '',
    platform: 'website',
    platform_url: platform_url?.trim() || '',
    source_url: 'manual',
    relevance_score: 100,
    relevance_reason: notes?.trim() || 'Manually added prospect',
    status: 'discovered',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prospect: data });
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

    // Track outreach sent for data collection
    const { data: prospect } = await supabase.from('outreach_prospects').select('user_id').eq('id', email.prospect_id).single();
    if (prospect?.user_id) {
      collectDataPoint(supabase, prospect.user_id, 'outreach_sent', null, {
        prospect_id: email.prospect_id,
      }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}

async function handleMarkReplied(supabase: SupabaseClient, emailId: string, prospectId: string) {
  if (emailId) {
    await supabase.from('outreach_emails').update({ status: 'replied', replied_at: new Date().toISOString() }).eq('id', emailId);
  }
  if (prospectId) {
    await supabase.from('outreach_prospects').update({ status: 'replied' }).eq('id', prospectId);

    // Track outreach reply for data collection
    const { data: prospect } = await supabase.from('outreach_prospects').select('user_id').eq('id', prospectId).single();
    if (prospect?.user_id) {
      collectDataPoint(supabase, prospect.user_id, 'outreach_replied', null, {
        prospect_id: prospectId,
      }).then(() => maybeAggregate(supabase, null)).catch(() => {});
    }
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
    // Per-tone response rate tracking
    templateStats: await getTemplateStats(supabase, userId),
  });
}

async function getTemplateStats(supabase: SupabaseClient, userId: string) {
  // Get all emails with their prospect data to calculate per-tone stats
  const { data: emails } = await supabase.from('outreach_emails')
    .select('status, follow_up_number')
    .eq('user_id', userId)
    .in('status', ['sent', 'replied']);

  const { data: settings } = await supabase.from('outreach_settings')
    .select('tone')
    .eq('user_id', userId)
    .single();

  const currentTone = settings?.tone || 'professional';

  // Count sent/replied for initial emails vs follow-ups
  const initial = { sent: 0, replied: 0 };
  const followUp = { sent: 0, replied: 0 };

  for (const e of emails || []) {
    const isFollowUp = (e.follow_up_number || 1) > 1;
    const bucket = isFollowUp ? followUp : initial;
    bucket.sent++;
    if (e.status === 'replied') bucket.replied++;
  }

  return {
    currentTone,
    initialEmails: {
      sent: initial.sent,
      replied: initial.replied,
      replyRate: initial.sent > 0 ? Math.round((initial.replied / initial.sent) * 100) : 0,
    },
    followUps: {
      sent: followUp.sent,
      replied: followUp.replied,
      replyRate: followUp.sent > 0 ? Math.round((followUp.replied / followUp.sent) * 100) : 0,
    },
  };
}

// ─── LinkedIn DM Script Generation ──────────────────────────────

async function handleLinkedInDM(supabase: SupabaseClient, userId: string, prospectId?: string) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  if (!prospectId) return NextResponse.json({ error: 'Missing prospectId' }, { status: 400 });

  const { data: prospect } = await supabase.from('outreach_prospects')
    .select('*')
    .eq('id', prospectId)
    .single();

  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  const { data: settings } = await supabase.from('outreach_settings').select('tone').eq('user_id', userId).single();
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  const chatContext = (chats?.[0]?.messages || [])
    .filter((m: any) => m.role === 'assistant')
    .map((m: any) => m.content)
    .join('\n')
    .slice(0, 2000);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: `Write a LinkedIn direct message script for a freelancer reaching out to a prospect. This is NOT an email — it's a DM, so it should feel conversational and brief.

FREELANCER'S BUSINESS:
${chatContext}

PROSPECT:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Platform URL: ${prospect.platform_url}
- Why they're a fit: ${prospect.relevance_reason}

TONE: ${settings?.tone || 'professional'}

LINKEDIN DM RULES:
- Keep it under 80 words (LinkedIn DMs should be SHORT)
- Open with something specific about their company or recent activity
- One clear value proposition — what you can do for them
- Soft CTA — ask a question, don't push a call
- No attachments, no links in first message
- Sound like a human, not a sales bot
- NO fake urgency, NO "I noticed you might need..."
- End with a simple question they can easily answer

Also write a follow-up DM (sent 5 days later if no reply) — under 40 words, very casual.

Respond JSON only, no markdown:
{
  "opening_dm": "...",
  "follow_up_dm": "...",
  "connection_note": "Short note to include with connection request (under 30 words)",
  "profile_tip": "One tip about what to check on their LinkedIn before reaching out"
}`
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);
    return NextResponse.json({ linkedinDm: result, prospect });
  } catch {
    console.error('[Outreach] LinkedIn DM generation failed for:', prospect.name);
    return NextResponse.json({ error: 'Failed to generate LinkedIn DM script' }, { status: 500 });
  }
}


// ─── Follow-Up Email Generation ───────────────────────────────

async function handleFollowUp(supabase: SupabaseClient, userId: string, prospectId?: string) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  // Find prospects that were sent an email but never replied (5+ days ago)
  let query = supabase.from('outreach_prospects').select(`
    *,
    outreach_emails (*)
  `).eq('user_id', userId).eq('status', 'sent');

  if (prospectId) {
    query = query.eq('id', prospectId);
  }

  const { data: prospects } = await query;
  if (!prospects?.length) return NextResponse.json({ emails: [], message: 'No prospects need follow-up' });

  // Filter to those where original email was sent 5+ days ago
  const needsFollowUp = prospects.filter((p: any) => {
    const emails = p.outreach_emails || [];
    const lastEmail = emails.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (!lastEmail) return false;
    const daysSince = (Date.now() - new Date(lastEmail.created_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 5 && (lastEmail.follow_up_number || 1) <= 2; // Max 2 follow-ups
  });

  if (!needsFollowUp.length) return NextResponse.json({ emails: [], message: 'No prospects need follow-up yet (wait 5 days after last email)' });

  const emails: any[] = [];

  for (const prospect of needsFollowUp.slice(0, 5)) {
    const originalEmail = (prospect.outreach_emails || []).find((e: any) => (e.follow_up_number || 1) === 1);
    const lastEmail = (prospect.outreach_emails || []).sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const followUpNumber = (lastEmail?.follow_up_number || 1) + 1;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Write a follow-up email (follow-up #${followUpNumber}) for a prospect who didn't reply to the original email.

PROSPECT:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Original email subject: "${originalEmail?.subject || 'N/A'}"
- Days since last email: ${Math.floor((Date.now() - new Date(lastEmail.created_at).getTime()) / (1000 * 60 * 60 * 24))}

FOLLOW-UP RULES:
- ${followUpNumber === 2 ? "This is the first follow-up. Keep it SHORT (under 60 words). Reference the original email briefly. Add one new value point or question." : "This is the final follow-up. Make it very brief (under 40 words). Give them an easy out: 'If this isn't relevant, no worries — just let me know and I won't follow up again.'"}
- DO NOT be pushy, guilt-trippy, or fake-urgent
- Sound human and respectful of their time
- Include opt-out: "Not interested? Just reply 'pass'."

JSON only, no markdown:
{"subject":"Re: ${originalEmail?.subject || ''}","body":"..."}`
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
        follow_up_number: followUpNumber,
        original_email_id: originalEmail?.id || null,
      }).select().single();

      if (saved) emails.push({ ...saved, prospect });
    } catch (e) {
      console.error('[Outreach] Follow-up generation failed for:', prospect.name);
    }
  }

  return NextResponse.json({ emails, followUp: true });
}
// ─── A/B Test Email Variants ──────────────────────────────────────

async function handleABGenerate(supabase: SupabaseClient, userId: string, prospectId?: string) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  if (!prospectId) return NextResponse.json({ error: 'Missing prospectId' }, { status: 400 });

  const { data: prospect } = await supabase.from('outreach_prospects').select('*').eq('id', prospectId).single();
  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  const { data: settings } = await supabase.from('outreach_settings').select('tone').eq('user_id', userId).single();
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  const chatContext = (chats?.[0]?.messages || []).filter((m: any) => m.role === 'assistant').map((m: any) => m.content).join('\n').slice(0, 2000);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `Write TWO completely different cold email variants for A/B testing. Each should take a different angle to reach the same prospect.

FREELANCER'S BUSINESS:
${chatContext}

PROSPECT:
- Name: ${prospect.name}
- Company: ${prospect.company}
- Why they're a fit: ${prospect.relevance_reason}

VARIANT A: "${settings?.tone || 'professional'}" approach — lead with credibility and results
VARIANT B: "curiosity" approach — lead with a question or observation about their business

Both must:
- Be under 120 words each
- Have different subject lines
- Reference something specific about the prospect
- Include opt-out line
- Sound human, not templated

Respond JSON only, no markdown:
{
  "variant_a": { "subject": "...", "body": "...", "approach": "credibility" },
  "variant_b": { "subject": "...", "body": "...", "approach": "curiosity" }
}`
    }],
  });

  const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    const result = JSON.parse(cleaned);

    // Save both variants
    const variants = [];
    for (const [key, variant] of Object.entries(result) as any[]) {
      const { data: saved } = await supabase.from('outreach_emails').insert({
        user_id: userId,
        prospect_id: prospectId,
        subject: variant.subject,
        body: variant.body,
        email_to: prospect.email || '',
        status: 'draft',
        ab_variant: key === 'variant_a' ? 'A' : 'B',
        ab_approach: variant.approach,
      }).select().single();
      if (saved) variants.push({ ...saved, prospect });
    }

    // Update prospect status
    await supabase.from('outreach_prospects').update({ status: 'queued' }).eq('id', prospectId);

    return NextResponse.json({ variants, abTest: true });
  } catch {
    console.error('[Outreach] A/B generation failed for:', prospect.name);
    return NextResponse.json({ error: 'Failed to generate A/B variants' }, { status: 500 });
  }
}

async function handleABResults(supabase: SupabaseClient, userId: string) {
  // Get all A/B tested emails with their outcomes
  const { data: emails } = await supabase.from('outreach_emails')
    .select('ab_variant, ab_approach, status')
    .eq('user_id', userId)
    .not('ab_variant', 'is', null)
    .in('status', ['sent', 'replied']);

  if (!emails?.length) return NextResponse.json({ results: null, message: 'No A/B test data yet' });

  const stats: Record<string, { sent: number; replied: number; approach: string }> = {};
  for (const e of emails) {
    const key = e.ab_variant || 'unknown';
    if (!stats[key]) stats[key] = { sent: 0, replied: 0, approach: e.ab_approach || '' };
    stats[key].sent++;
    if (e.status === 'replied') stats[key].replied++;
  }

  const results = Object.entries(stats).map(([variant, data]) => ({
    variant,
    approach: data.approach,
    sent: data.sent,
    replied: data.replied,
    replyRate: data.sent > 0 ? Math.round((data.replied / data.sent) * 100) : 0,
  }));

  const winner = results.length >= 2 ? results.sort((a, b) => b.replyRate - a.replyRate)[0] : null;

  return NextResponse.json({
    results,
    winner: winner ? { variant: winner.variant, approach: winner.approach, replyRate: winner.replyRate } : null,
    totalTests: emails.length,
  });
}

// ─── Email Address Finder ─────────────────────────────────────────

async function handleFindEmail(supabase: SupabaseClient, userId: string, prospectId?: string) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  if (!prospectId) return NextResponse.json({ error: 'Missing prospectId' }, { status: 400 });

  const { data: prospect } = await supabase.from('outreach_prospects')
    .select('*').eq('id', prospectId).single();
  if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

  // Use Claude with web search to find contact info
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 800,
    tools: [{ type: "web_search_20250305" as any, name: "web_search" }],
    messages: [{
      role: 'user',
      content: `Find the business email address for this person/company. Search their website and any public profiles.

NAME: ${prospect.name}
COMPANY: ${prospect.company}
WEBSITE: ${prospect.platform_url}

SEARCH STRATEGY:
1. Check their website's contact page, about page, or footer
2. Look for "mailto:" links on their site
3. Check their LinkedIn or other public profiles
4. Look for the company's general contact email
5. If you find a personal email pattern (like firstname@company.com), note the pattern

RESPOND WITH JSON ONLY, no markdown:
{
  "found": true/false,
  "email": "their@email.com or null",
  "confidence": "high/medium/low",
  "source": "where you found it (e.g., 'company website contact page')",
  "alternatives": ["other possible emails"],
  "email_pattern": "pattern if detected (e.g., 'firstname@company.com')",
  "contact_page_url": "URL of their contact page if found"
}

If you cannot find any email, set found: false and suggest the best approach to find it.`
    }],
  });

  let text = '';
  for (const block of response.content) {
    if (block.type === 'text') text += block.text;
  }

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse email search results' }, { status: 500 });
    const result = JSON.parse(jsonMatch[0]);

    // If found, update the prospect's email
    if (result.found && result.email) {
      await supabase.from('outreach_prospects')
        .update({ email: result.email })
        .eq('id', prospectId);
    }

    return NextResponse.json({
      ...result,
      prospect: { name: prospect.name, company: prospect.company },
    });
  } catch {
    console.error('[Outreach] Email finder parse failed');
    return NextResponse.json({ error: 'Failed to find email address' }, { status: 500 });
  }
}