// @ts-nocheck
import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { validateOutput, RELIABILITY_PROMPT, CONTRACT_PROMPT } from '@/lib/aiSafety';
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
// RATE LIMITING (in-memory, resets on cold start — fine for v1)
// ═══════════════════════════════════════════════════════════════
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const AI_ACTIONS = new Set(['invoices-generate', 'contracts-generate', 'followups-generate', 'screen-client', 'outcome-check']);
function checkRateLimit(userId: string, action: string): boolean {
  const isAI = AI_ACTIONS.has(action);
  const windowMs = isAI ? 60_000 : 10_000; // AI: 60s window, CRUD: 10s window
  const maxReqs = isAI ? 5 : 30; // AI: 5/min, CRUD: 30/10s
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
// POST /api/z/crm
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;
    const supabase = db();
    if (!userId || !supabase) return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400 });

    // Rate limit check
    if (!checkRateLimit(userId, action)) {
      console.warn(`[CRM] Rate limited: user=${userId} action=${action}`);
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    switch (action) {
      // ─── Clients ───
      case 'clients-list': return clientsList(supabase, userId, body);
      case 'clients-create': return clientsCreate(supabase, userId, body);
      case 'clients-update': return clientsUpdate(supabase, body);
      case 'clients-delete': return clientsDelete(supabase, body);
      case 'clients-get': return clientsGet(supabase, body);

      // ─── Invoices ───
      case 'invoices-list': return invoicesList(supabase, userId, body);
      case 'invoices-create': return invoicesCreate(supabase, userId, body);
      case 'invoices-update': return invoicesUpdate(supabase, body);
      case 'invoices-send': return invoicesSend(supabase, body);
      case 'invoices-generate': return invoicesGenerate(supabase, userId, body);
      case 'invoices-create-recurring': return invoicesCreateRecurring(supabase, userId, body);
      case 'invoices-process-recurring': return invoicesProcessRecurring(supabase, userId);

      // ─── Contracts ───
      case 'contracts-list': return contractsList(supabase, userId, body);
      case 'contracts-create': return contractsCreate(supabase, userId, body);
      case 'contracts-generate': return contractsGenerate(supabase, userId, body);
      case 'contracts-update': return contractsUpdate(supabase, body);

      // ─── Follow-ups ───
      case 'followups-list': return followupsList(supabase, userId, body);
      case 'followups-create': return followupsCreate(supabase, userId, body);
      case 'followups-generate': return followupsGenerate(supabase, userId, body);
      case 'followups-mark-sent': return followupsMarkSent(supabase, body);

      // ─── Projects ───
      case 'projects-list': return handleProjectsList(supabase, userId);
      case 'projects-create': return handleProjectsCreate(supabase, userId, body);
      case 'projects-update': return handleProjectsUpdate(supabase, body);
      case 'projects-delete': return handleProjectsDelete(supabase, body);

      // ─── Dashboard / Stats ───
      case 'dashboard': return dashboard(supabase, userId);
      case 'revenue-trend': return revenueTrend(supabase, userId, body);
      case 'screen-client': return screenClient(supabase, userId, body);
      case 'auto-mark-overdue': return handleAutoMarkOverdue(supabase, userId);

      // ─── Outcome Tracking (30/60/90 day check-ins) ───
      case 'outcome-create': return outcomeCreate(supabase, userId, body);
      case 'outcome-list': return outcomeList(supabase, userId);
      case 'outcome-check': return outcomeCheck(supabase, userId, body);

      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[CRM] Error:', e?.message, e?.stack?.slice(0, 300));
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// CLIENTS
// ═══════════════════════════════════════════════════════════════

async function clientsList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_clients').select(`*, crm_invoices(id, status, amount_cents), crm_contracts(id, status)`).eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
  if (body.status && body.status !== 'all') q = q.eq('status', body.status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clients: data || [] });
}

async function clientsCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { name, email, company, phone, source, status, notes, tags } = body;
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { data, error } = await supabase.from('crm_clients').insert({
    user_id: userId, name, email: email || '', company: company || '', phone: phone || '',
    source: source || 'manual', status: status || 'lead', notes: notes || '', tags: tags || [],
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Track client acquisition
  collectDataPoint(supabase, userId, 'client_acquired', null, {
    channel: source || 'manual',
    price_charged: null,
  }).then(() => maybeAggregate(supabase, null)).catch(() => {});

  return NextResponse.json({ client: data });
}

async function clientsUpdate(supabase: SupabaseClient, body: any) {
  const { clientId, ...updates } = body;
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  const { name, email, company, phone, status, notes, tags, value_cents } = updates;
  const { error } = await supabase.from('crm_clients').update({
    ...(name !== undefined ? { name } : {}),
    ...(email !== undefined ? { email } : {}),
    ...(company !== undefined ? { company } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(tags !== undefined ? { tags } : {}),
    ...(value_cents !== undefined ? { value_cents } : {}),
    updated_at: new Date().toISOString(),
  }).eq('id', clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function clientsDelete(supabase: SupabaseClient, body: any) {
  if (!body.clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  await supabase.from('crm_clients').delete().eq('id', body.clientId);
  return NextResponse.json({ ok: true });
}

async function clientsGet(supabase: SupabaseClient, body: any) {
  if (!body.clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  
  // Validate clientId format (prevent injection)
  if (typeof body.clientId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.clientId)) {
    return NextResponse.json({ error: 'Invalid clientId format' }, { status: 400 });
  }
  
  const { data, error } = await supabase.from('crm_clients').select(`*, crm_invoices(*), crm_contracts(*), crm_followups(*)`).eq('id', body.clientId).single();
  
  if (error) {
    console.error('[CRM clientsGet] Query error:', error.message);
    return NextResponse.json({ error: 'Client not found or query failed' }, { status: 404 });
  }
  
  return NextResponse.json({ client: data });
}

// ═══════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════

async function invoicesList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_invoices').select(`*, crm_clients(name, email, company)`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (body.status && body.status !== 'all') {
    // Whitelist status values
    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
    if (validStatuses.includes(body.status)) q = q.eq('status', body.status);
  }
  if (body.clientId && /^[a-f0-9-]{36}$/i.test(body.clientId)) q = q.eq('client_id', body.clientId);
  const { data, error } = await q;
  if (error) {
    console.error('[CRM invoicesList] Query error:', error.message);
    return NextResponse.json({ invoices: [], error: 'Failed to load invoices' }, { status: 500 });
  }
  return NextResponse.json({ invoices: data || [] });
}

async function invoicesCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { clientId, items, dueDate, notes, currency } = body;
  if (!clientId || !items?.length) return NextResponse.json({ error: 'Client and items required' }, { status: 400 });

  // Get next invoice number
  const { count } = await supabase.from('crm_invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId);
  const num = (count || 0) + 1;
  const invoiceNumber = `INV-${String(num).padStart(3, '0')}`;
  const totalCents = items.reduce((s: number, i: any) => s + (i.amount_cents || i.qty * i.rate_cents || 0), 0);

  const { data, error } = await supabase.from('crm_invoices').insert({
    user_id: userId, client_id: clientId, invoice_number: invoiceNumber,
    amount_cents: totalCents, items, due_date: dueDate || null,
    notes: notes || '', currency: currency || 'USD',
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update client lifetime value (non-blocking but log failures for investigation)
  try { 
    await supabase.rpc('increment_client_value', { cid: clientId, amount: totalCents }); 
  } catch (e: any) {
    console.warn('[CRM invoicesCreate] increment_client_value RPC failed:', e?.message || 'unknown');
    // Don't fail the whole invoice creation — the invoice is saved, LTV update is secondary
  }

  return NextResponse.json({ invoice: data });
}

async function invoicesUpdate(supabase: SupabaseClient, body: any) {
  const { invoiceId, status, paid_date, items, amount_cents, due_date, notes } = body;
  if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
  const updates: any = {};
  if (status !== undefined) updates.status = status;
  if (paid_date !== undefined) updates.paid_date = paid_date;
  if (items !== undefined) updates.items = items;
  if (amount_cents !== undefined) updates.amount_cents = amount_cents;
  if (due_date !== undefined) updates.due_date = due_date;
  if (notes !== undefined) updates.notes = notes;
  const { error } = await supabase.from('crm_invoices').update(updates).eq('id', invoiceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Track invoice paid event for data collection
  if (status === 'paid') {
    const { data: inv } = await supabase.from('crm_invoices').select('user_id, amount_cents, client_id').eq('id', invoiceId).single();
    if (inv) {
      collectDataPoint(supabase, inv.user_id, 'invoice_paid', null, {
        amount_cents: inv.amount_cents,
        client_id: inv.client_id,
      }).then(() => maybeAggregate(supabase, null)).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true });
}

async function invoicesSend(supabase: SupabaseClient, body: any) {
  const { invoiceId } = body;
  if (!invoiceId) return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 });
  await supabase.from('crm_invoices').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', invoiceId);
  return NextResponse.json({ ok: true });
}

async function invoicesGenerate(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const { clientId, description } = body;

  const { data: client } = await supabase.from('crm_clients').select('*').eq('id', clientId).single();
  
  // Pull full context: recent chats + past invoices to learn real pricing patterns
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(3);
  const allMsgs = (chats || []).flatMap((c: any) => c.messages || []);
  const ctx = allMsgs.filter((m: any) => m.role === 'assistant').map((m: any) => m.content).join('\n').slice(0, 2000);
  
  // Pull past invoice amounts to anchor pricing in reality
  const { data: pastInvoices } = await supabase
    .from('crm_invoices')
    .select('total_cents, items')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  
  const pastPricingContext = pastInvoices && pastInvoices.length > 0
    ? `\nUSER'S ACTUAL PAST PRICING (anchor new estimates to these real rates):\n${pastInvoices.map((inv: any) => `- $${(inv.total_cents / 100).toFixed(2)} total`).join('\n')}`
    : '\nNo past invoices on file. Do NOT invent rates — leave rate_cents at 0 and write "Confirm rate with client" in the description so the user fills it in.';

  const res = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Generate invoice line items for a freelancer.

CLIENT: ${client?.name} (${client?.company || 'Individual'})
FREELANCER BUSINESS CONTEXT: ${ctx}
WORK DESCRIPTION: ${description || 'General freelance work'}
${pastPricingContext}

CRITICAL RULES:
- If you have past invoice data above, anchor new line items to those real rates. Do not invent rates that don't match the user's actual pricing pattern.
- If you have no pricing data, set rate_cents to 0 and include "Confirm rate" in the description — do NOT guess rates.
- Keep descriptions specific to what was actually described, not generic.
- Only generate line items that match the described work.

Generate 1-4 invoice line items. Respond JSON only:
[{"description":"...","qty":1,"rate_cents":5000,"amount_cents":5000}]
No markdown, no backticks.` }],
  });

  const text = res.content[0]?.type === 'text' ? res.content[0].text : '[]';
  try {
    const items = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [{ description: description || 'Confirm rate with client', qty: 1, rate_cents: 0, amount_cents: 0 }] });
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTRACTS
// ═══════════════════════════════════════════════════════════════

async function contractsList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_contracts').select(`*, crm_clients(name, email)`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (body.clientId && /^[a-f0-9-]{36}$/i.test(body.clientId)) q = q.eq('client_id', body.clientId);
  const { data, error } = await q;
  if (error) {
    console.error('[CRM contractsList] Query error:', error.message);
    return NextResponse.json({ contracts: [], error: 'Failed to load contracts' }, { status: 500 });
  }
  return NextResponse.json({ contracts: data || [] });
}

async function contractsCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { clientId, title, content, type, amount_cents, start_date, end_date } = body;
  if (!clientId || !title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { data, error } = await supabase.from('crm_contracts').insert({
    user_id: userId, client_id: clientId, title, content, type: type || 'contract',
    amount_cents: amount_cents || 0, start_date, end_date,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data });
}

async function contractsGenerate(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const { clientId, type, description } = body;

  const { data: client } = await supabase.from('crm_clients').select('*').eq('id', clientId).single();
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(3);
  const allMsgs = (chats || []).flatMap((c: any) => c.messages || []);
  const ctx = allMsgs.filter((m: any) => m.role === 'assistant').map((m: any) => m.content).join('\n').slice(0, 2000);

  // Pull past contracts/invoices to anchor pricing to the user's reality
  const [pastContracts, pastInvoices] = await Promise.all([
    supabase.from('crm_contracts').select('amount_cents, title').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
    supabase.from('crm_invoices').select('total_cents').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);
  
  const pricingAnchor = (pastContracts.data && pastContracts.data.length > 0) || (pastInvoices.data && pastInvoices.data.length > 0)
    ? `\nUSER'S ACTUAL PAST PRICING (use these as anchor — don't invent numbers outside this range):
${(pastContracts.data || []).map((c: any) => `- Contract: "${c.title}" — $${(c.amount_cents / 100).toFixed(2)}`).join('\n')}
${(pastInvoices.data || []).map((inv: any) => `- Invoice: $${(inv.total_cents / 100).toFixed(2)}`).join('\n')}`
    : '\nNo past pricing data. Do NOT invent specific dollar amounts. Use "[Amount to be confirmed]" placeholders instead.';

  const isProposal = type === 'proposal';

  const res = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-20250514', max_tokens: 2000,
    messages: [{ role: 'user', content: `${RELIABILITY_PROMPT}
${CONTRACT_PROMPT}

Generate a professional freelance ${isProposal ? 'proposal' : 'contract'} in markdown.

CLIENT: ${client?.name} (${client?.company || 'Individual'}, ${client?.email || 'no email'})
FREELANCER BUSINESS: ${ctx}
DESCRIPTION: ${description || 'General freelance services'}
${pricingAnchor}

CRITICAL PRICING RULE:
- If past pricing data is provided above, stay within that range. Do NOT invent dollar amounts wildly outside the user's actual pricing history.
- If no past data, use "[Amount to be confirmed]" as a placeholder rather than inventing specific numbers.
- Specific dollar amounts in contracts are legally binding — err on the side of placeholders over invented numbers.

${isProposal ? `PROPOSAL should include:
- Executive summary (what you'll do and why)
- Scope of work (specific deliverables)
- Timeline with milestones
- Investment (pricing with clear breakdown — use real or placeholder amounts per rule above)
- Terms (payment schedule, revision policy)
- Next steps (how to accept)` : `CONTRACT should include:
- Parties (freelancer and client — use placeholder names)
- Scope of work (specific deliverables)
- Timeline and milestones
- Payment terms (amount, schedule, late fees — use real or placeholder amounts per rule above)
- Revision policy (number of included revisions)
- Intellectual property (client owns final deliverables)
- Confidentiality clause
- Termination clause (30-day notice)
- Limitation of liability`}

IMPORTANT DISCLAIMER AT THE BOTTOM: "This ${isProposal ? 'proposal' : 'contract'} was generated by Zelrex AI as a starting template. It is NOT legal advice. Both parties should review with a qualified attorney before signing. Zelrex is not responsible for the terms, enforcement, or outcomes of this agreement."

Write in professional, clear language. Use markdown headers and formatting.` }],
  });

  const rawContent = res.content[0]?.type === 'text' ? res.content[0].text : '';
  const content = validateOutput(rawContent, {
    forceContractDisclaimer: true,
    checkFinancial: true,
    checkGuarantee: true,
  });
  return NextResponse.json({ content, title: `${isProposal ? 'Proposal' : 'Contract'} for ${client?.name || 'Client'}` });
}

async function contractsUpdate(supabase: SupabaseClient, body: any) {
  const { contractId, status, content, title, sent_at, accepted_at } = body;
  if (!contractId) return NextResponse.json({ error: 'Missing contractId' }, { status: 400 });
  const updates: any = {};
  if (status !== undefined) updates.status = status;
  if (content !== undefined) updates.content = content;
  if (title !== undefined) updates.title = title;
  if (sent_at !== undefined) updates.sent_at = sent_at;
  if (accepted_at !== undefined) updates.accepted_at = accepted_at;
  const { error } = await supabase.from('crm_contracts').update(updates).eq('id', contractId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// FOLLOW-UPS
// ═══════════════════════════════════════════════════════════════

async function followupsList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_followups').select(`*, crm_clients(name, email), crm_invoices(invoice_number, amount_cents)`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (body.status && body.status !== 'all') {
    const validStatuses = ['pending', 'sent', 'completed', 'cancelled'];
    if (validStatuses.includes(body.status)) q = q.eq('status', body.status);
  }
  if (body.clientId && /^[a-f0-9-]{36}$/i.test(body.clientId)) q = q.eq('client_id', body.clientId);
  const { data, error } = await q;
  if (error) {
    console.error('[CRM followupsList] Query error:', error.message);
    return NextResponse.json({ followups: [], error: 'Failed to load followups' }, { status: 500 });
  }
  return NextResponse.json({ followups: data || [] });
}

async function followupsCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { clientId, invoiceId, type, subject, bodyText, scheduledFor } = body;
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
  const { data, error } = await supabase.from('crm_followups').insert({
    user_id: userId, client_id: clientId, invoice_id: invoiceId || null,
    type: type || 'general', subject: subject || '', body: bodyText || '',
    scheduled_for: scheduledFor || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ followup: data });
}

async function followupsGenerate(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const { clientId, invoiceId, type } = body;

  const { data: client } = await supabase.from('crm_clients').select('*').eq('id', clientId).single();
  let invoiceCtx = '';
  if (invoiceId) {
    const { data: inv } = await supabase.from('crm_invoices').select('*').eq('id', invoiceId).single();
    if (inv) invoiceCtx = `UNPAID INVOICE: ${inv.invoice_number} for $${(inv.amount_cents / 100).toFixed(2)}, due ${inv.due_date || 'no due date'}, sent ${inv.sent_at || 'not yet sent'}, reminders sent: ${inv.reminder_count}`;
  }

  const typeInstr = type === 'payment'
    ? 'Write a polite but firm payment reminder. Reference the specific invoice. Be professional — never threatening.'
    : type === 'proposal'
    ? 'Write a follow-up checking if they reviewed the proposal. Keep it brief and helpful.'
    : 'Write a friendly check-in message. Ask if they need anything or have upcoming projects.';

  const res = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-20250514', max_tokens: 400,
    messages: [{ role: 'user', content: `Write a follow-up email for a freelancer.

CLIENT: ${client?.name} (${client?.email || ''})
${invoiceCtx}
TYPE: ${type || 'general'}

${typeInstr}

Keep it under 100 words. Sound human, not robotic. No fake urgency.

Respond JSON only: {"subject":"...","body":"..."}
No markdown, no backticks.` }],
  });

  const text = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
  try {
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ subject: 'Following up', body: `Hi ${client?.name},\n\nJust checking in. Let me know if you need anything.\n\nBest` });
  }
}

async function followupsMarkSent(supabase: SupabaseClient, body: any) {
  const { followupId } = body;
  if (!followupId) return NextResponse.json({ error: 'Missing followupId' }, { status: 400 });

  // Get followup to update invoice reminder count
  const { data: fu } = await supabase.from('crm_followups').select('invoice_id').eq('id', followupId).single();
  await supabase.from('crm_followups').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', followupId);

  if (fu?.invoice_id) {
    const { data: inv } = await supabase.from('crm_invoices').select('reminder_count').eq('id', fu.invoice_id).single();
    await supabase.from('crm_invoices').update({
      reminder_count: (inv?.reminder_count || 0) + 1,
      last_reminder_at: new Date().toISOString(),
    }).eq('id', fu.invoice_id);
  }

  // Update client last_contacted_at
  const { data: fu2 } = await supabase.from('crm_followups').select('client_id').eq('id', followupId).single();
  if (fu2?.client_id) {
    await supabase.from('crm_clients').update({ last_contacted_at: new Date().toISOString() }).eq('id', fu2.client_id);
  }

  return NextResponse.json({ ok: true });
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD / STATS
// ═══════════════════════════════════════════════════════════════

async function dashboard(supabase: SupabaseClient, userId: string) {
  const [clientsR, activeR, invoicesR, paidR, overdueR, contractsR, activeProjectsR, recentPaidInvoicesR] = await Promise.all([
    supabase.from('crm_clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('crm_clients').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.from('crm_invoices').select('amount_cents, status').eq('user_id', userId),
    supabase.from('crm_invoices').select('amount_cents').eq('user_id', userId).eq('status', 'paid'),
    supabase.from('crm_invoices').select('amount_cents').eq('user_id', userId).eq('status', 'overdue'),
    supabase.from('crm_contracts').select('id, status').eq('user_id', userId),
    supabase.from('crm_projects').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.from('crm_invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'paid').gte('paid_date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)),
  ]);

  const allInvoices = invoicesR.data || [];
  const paidInvoices = paidR.data || [];
  const overdueInvoices = overdueR.data || [];
  const totalRevenue = paidInvoices.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const totalOutstanding = overdueInvoices.reduce((s, i) => s + (i.amount_cents || 0), 0);
  const pendingInvoices = allInvoices.filter(i => i.status === 'sent');
  const totalPending = pendingInvoices.reduce((s, i) => s + (i.amount_cents || 0), 0);

  // Monthly recurring revenue (clients with 'active' status and invoices in last 60 days)
  const sixtyAgo = new Date(); sixtyAgo.setDate(sixtyAgo.getDate() - 60);
  const { data: recentPaid } = await supabase.from('crm_invoices').select('amount_cents, client_id')
    .eq('user_id', userId).eq('status', 'paid').gte('paid_date', sixtyAgo.toISOString().slice(0, 10));
  const clientRevMap = new Map<string, number>();
  (recentPaid || []).forEach(i => { clientRevMap.set(i.client_id, (clientRevMap.get(i.client_id) || 0) + i.amount_cents); });
  const estimatedMRR = Math.round([...clientRevMap.values()].reduce((s, v) => s + v, 0) / 2); // divide by 2 months

  return NextResponse.json({
    totalClients: clientsR.count || 0,
    activeClients: activeR.count || 0,
    totalRevenue,
    totalOutstanding,
    totalPending,
    totalInvoices: allInvoices.length,
    paidInvoices: paidInvoices.length,
    overdueInvoices: overdueInvoices.length,
    activeContracts: (contractsR.data || []).filter(c => c.status === 'accepted').length,
    estimatedMRR,
    activeProjects: activeProjectsR.count || 0,
    recentPaidInvoices: recentPaidInvoicesR.count || 0,

    // Revenue milestone tracking
    revenueMilestones: (() => {
      const thresholds = [
        { amount: 100_00, label: '$100' },
        { amount: 500_00, label: '$500' },
        { amount: 1_000_00, label: '$1,000' },
        { amount: 5_000_00, label: '$5,000' },
        { amount: 10_000_00, label: '$10,000' },
        { amount: 25_000_00, label: '$25,000' },
        { amount: 50_000_00, label: '$50,000' },
        { amount: 100_000_00, label: '$100,000' },
      ];
      const reached = thresholds.filter(t => totalRevenue >= t.amount).map(t => t.label);
      const next = thresholds.find(t => totalRevenue < t.amount);
      return {
        reached,
        next: next ? { label: next.label, progress: Math.round((totalRevenue / next.amount) * 100) } : null,
      };
    })(),

    // Client lifetime value (average revenue per client)
    avgClientValue: (clientsR.count || 0) > 0 ? Math.round(totalRevenue / (clientsR.count || 1)) : 0,

    // Pricing benchmark alert (avg invoice size)
    avgInvoiceSize: paidInvoices.length > 0 ? Math.round(totalRevenue / paidInvoices.length) : 0,
  });
}

// ═══════════════════════════════════════════════════════════════
// AI CLIENT SCREENING
// ═══════════════════════════════════════════════════════════════

async function screenClient(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const { description, userNiche } = body;
  if (!description) return NextResponse.json({ error: 'Missing description' }, { status: 400 });

  const res = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-5-20250929', max_tokens: 2000,
    tools: [{ type: 'web_search_20250305' as any, name: 'web_search' }],
    messages: [{ role: 'user', content: `You are an expert freelancer protection system. A freelancer${userNiche ? ` in ${userNiche}` : ""} is considering working with a potential client. Analyze the client's message/project description for risks.

STEP 1: First, search the web to verify any company or person mentioned in the description. Look for:
- Does the company exist?
- Do they have a real website?
- Any reviews or complaints from freelancers?
- Any red flags in their online presence?

STEP 2: Then analyze the message itself.

CLIENT MESSAGE OR PROJECT DESCRIPTION:
"${description}"

Analyze across these 8 dimensions and score each 0-10 (10 = safest):

1. BUDGET SIGNALS — Do they mention a specific budget? Is it reasonable for the work described? Red flags: "budget is flexible" (often means low), no budget mentioned, asking for free samples, comparing to Fiverr prices
2. SCOPE CLARITY — Is the project well-defined? Red flags: vague deliverables, "we'll figure it out as we go", scope that keeps expanding in the description itself
3. TIMELINE REALITY — Is the deadline realistic? Red flags: "need it by tomorrow", "ASAP", unrealistic expectations for the complexity described
4. PAYMENT SIGNALS — Any indication of payment reliability? Red flags: "we'll pay after launch", "revenue share", "exposure", no mention of payment terms, asking to work before contract
5. COMMUNICATION QUALITY — How professional is their communication? Red flags: all caps, aggressive tone, poor grammar suggesting overseas scammer, overly flattering/too good to be true
6. RESPECT SIGNALS — Do they respect the freelancer's expertise? Red flags: "it should be easy/quick", "my nephew could do this but...", micromanagement hints, asking to replicate someone else's exact work
7. DECISION MAKER — Is this person the actual decision maker? Red flags: "I'll need to check with my boss/partner/team", committee-based approval, multiple stakeholders mentioned
8. RED FLAG PATTERNS — Known freelancer exploitation patterns: spec work requests, "quick test project" that's actually the real project, NDA before any discussion, asking for source files before payment, wanting to own all rights for a tiny fee

SCORING:
- 80-100: Low risk — proceed with standard contract
- 60-79: Medium risk — proceed with caution, get payment upfront
- 40-59: High risk — require 50-100% upfront, strict contract, or decline
- 0-39: Critical risk — strongly recommend declining

Respond with ONLY valid JSON, no markdown, no backticks:
{
  "score": <0-100 weighted average>,
  "verdict": "<1 sentence summary>",
  "risk_level": "<low|medium|high|critical>",
  "flags": ["<specific red flag 1>", "<specific red flag 2>"],
  "green_lights": ["<positive signal 1>", "<positive signal 2>"],
  "recommendation": "<2-3 sentence specific advice for this situation>",
  "suggested_questions": ["<question to ask the client to clarify risk 1>", "<question 2>", "<question 3>"],
  "pricing_advice": "<specific pricing strategy based on the risk level — e.g., require deposit, milestone payments, etc.>",
  "contract_warnings": ["<specific clause to include in contract for this client>", "<clause 2>"],
  "company_verified": <true if you found the company online and it looks real, false if not found or suspicious>,
  "company_info": "<1-2 sentence summary of what you found about the company online, or 'No online presence found' if nothing>"
}
DISCLAIMER: This is AI-generated analysis for informational purposes only. It should not replace your professional judgment.` }],
  });

  const rawText = res.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  try {
    const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);
    if (result.recommendation) {
      result.recommendation = validateOutput(result.recommendation, {
        checkFinancial: false,
        checkGuarantee: true,
      });
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      score: 50,
      verdict: 'Unable to fully analyze — review manually',
      risk_level: 'medium',
      flags: ['Analysis could not be completed — review the project details carefully'],
      green_lights: [],
      recommendation: "The screening system couldn't fully analyze this description. Review it carefully and ask clarifying questions before committing.",
      suggested_questions: ['What is your specific budget for this project?', 'What is your expected timeline?', 'How will payment be structured?'],
      pricing_advice: 'Require at least 50% deposit before starting work.',
      contract_warnings: ['Include a detailed scope of work', 'Specify revision limits'],
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-MARK OVERDUE INVOICES
// ═══════════════════════════════════════════════════════════════

async function handleAutoMarkOverdue(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const { data: overdue, error } = await supabase
    .from('crm_invoices')
    .update({ status: 'overdue' })
    .eq('user_id', userId)
    .eq('status', 'sent')
    .lt('due_date', today)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ marked: overdue?.length ?? 0 });
}

// ═══════════════════════════════════════════════════════════════
// PROJECTS
// ═══════════════════════════════════════════════════════════════

async function handleProjectsList(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('crm_projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ projects: data || [], error: error?.message });
}

async function handleProjectsCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { name, description, clientId, totalValueCents, dueDate, milestones } = body;

  const { data, error } = await supabase.from('crm_projects').insert({
    user_id: userId,
    client_id: clientId || null,
    name,
    description: description || '',
    status: 'active',
    progress_percent: 0,
    total_value_cents: totalValueCents || 0,
    due_date: dueDate || null,
    start_date: new Date().toISOString().slice(0, 10),
    milestones: milestones || [],
  }).select().single();

  return NextResponse.json({ project: data, error: error?.message });
}

async function handleProjectsUpdate(supabase: SupabaseClient, body: any) {
  const { projectId, ...updates } = body;
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });

  const updateData: any = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.progressPercent !== undefined) updateData.progress_percent = updates.progressPercent;
  if (updates.milestones !== undefined) updateData.milestones = updates.milestones;
  if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;

  const { error } = await supabase.from('crm_projects').update(updateData).eq('id', projectId);
  return NextResponse.json({ ok: !error, error: error?.message });
}

async function handleProjectsDelete(supabase: SupabaseClient, body: any) {
  const { projectId } = body;
  if (!projectId) return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });

  const { error } = await supabase.from('crm_projects').delete().eq('id', projectId);
  return NextResponse.json({ ok: !error, error: error?.message });
}

// ═══════════════════════════════════════════════════════════════
// REVENUE TREND CHART (monthly breakdown, last 12 months)
// ═══════════════════════════════════════════════════════════════

async function revenueTrend(supabase: SupabaseClient, userId: string, body: any) {
  const months = body.months || 12;
  const now = new Date();

  // Get all paid invoices in the date range
  const startDate = new Date(now);
  startDate.setMonth(startDate.getMonth() - months);

  const { data: invoices, error } = await supabase
    .from('crm_invoices')
    .select('amount_cents, paid_date, client_id')
    .eq('user_id', userId)
    .eq('status', 'paid')
    .gte('paid_date', startDate.toISOString().slice(0, 10))
    .order('paid_date', { ascending: true });

  if (error) {
    console.error('[CRM] Revenue trend error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Group by month
  const monthlyMap = new Map<string, { revenue: number; invoiceCount: number; uniqueClients: Set<string> }>();

  // Initialize all months (even empty ones)
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    const key = d.toISOString().slice(0, 7); // YYYY-MM
    monthlyMap.set(key, { revenue: 0, invoiceCount: 0, uniqueClients: new Set() });
  }

  for (const inv of invoices || []) {
    if (!inv.paid_date) continue;
    const key = inv.paid_date.slice(0, 7);
    const bucket = monthlyMap.get(key);
    if (bucket) {
      bucket.revenue += inv.amount_cents || 0;
      bucket.invoiceCount++;
      if (inv.client_id) bucket.uniqueClients.add(inv.client_id);
    }
  }

  const trend = Array.from(monthlyMap.entries()).map(([month, data]) => ({
    month,
    label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    revenue: data.revenue,
    invoiceCount: data.invoiceCount,
    uniqueClients: data.uniqueClients.size,
  }));

  // Calculate growth rate
  const currentMonth = trend[trend.length - 1];
  const prevMonth = trend[trend.length - 2];
  const growthRate = prevMonth && prevMonth.revenue > 0
    ? Math.round(((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100)
    : null;

  // Average monthly revenue
  const totalRev = trend.reduce((s, t) => s + t.revenue, 0);
  const avgMonthly = Math.round(totalRev / months);

  // Best month
  const bestMonth = trend.reduce((best, t) => t.revenue > best.revenue ? t : best, trend[0]);

  // Revenue milestones
  const milestones = [];
  const totalEver = totalRev; // Could query all-time, but this is close enough for v1
  if (totalEver >= 100_00) milestones.push({ amount: '$100', reached: true });
  if (totalEver >= 500_00) milestones.push({ amount: '$500', reached: true });
  if (totalEver >= 1_000_00) milestones.push({ amount: '$1,000', reached: true });
  if (totalEver >= 5_000_00) milestones.push({ amount: '$5,000', reached: true });
  if (totalEver >= 10_000_00) milestones.push({ amount: '$10,000', reached: true });
  if (totalEver >= 25_000_00) milestones.push({ amount: '$25,000', reached: true });
  if (totalEver >= 50_000_00) milestones.push({ amount: '$50,000', reached: true });
  if (totalEver >= 100_000_00) milestones.push({ amount: '$100,000', reached: true });

  // Next milestone
  const thresholds = [100_00, 500_00, 1_000_00, 5_000_00, 10_000_00, 25_000_00, 50_000_00, 100_000_00];
  const nextThreshold = thresholds.find(t => totalEver < t);
  const nextMilestone = nextThreshold ? `$${(nextThreshold / 100).toLocaleString()}` : null;
  const progressToNext = nextThreshold ? Math.round((totalEver / nextThreshold) * 100) : 100;

  return NextResponse.json({
    trend,
    summary: {
      totalRevenue: totalRev,
      avgMonthly,
      growthRate,
      bestMonth: bestMonth ? { month: bestMonth.label, revenue: bestMonth.revenue } : null,
      currentMonth: currentMonth.revenue,
      milestones,
      nextMilestone,
      progressToNext,
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// RECURRING INVOICE AUTOMATION
// ═══════════════════════════════════════════════════════════════

async function invoicesCreateRecurring(supabase: SupabaseClient, userId: string, body: any) {
  const { clientId, items, frequency, startDate, notes, currency } = body;
  if (!clientId || !items?.length || !frequency) {
    return NextResponse.json({ error: 'Client, items, and frequency required' }, { status: 400 });
  }

  if (!['weekly', 'biweekly', 'monthly', 'quarterly'].includes(frequency)) {
    return NextResponse.json({ error: 'Frequency must be weekly, biweekly, monthly, or quarterly' }, { status: 400 });
  }

  const totalCents = items.reduce((s: number, i: any) => s + (i.amount_cents || i.qty * i.rate_cents || 0), 0);

  const { data, error } = await supabase.from('crm_recurring_invoices').insert({
    user_id: userId,
    client_id: clientId,
    items,
    amount_cents: totalCents,
    frequency,
    next_date: startDate || new Date().toISOString().slice(0, 10),
    notes: notes || '',
    currency: currency || 'USD',
    active: true,
  }).select().single();

  if (error) {
    console.error('[CRM] Recurring invoice create error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  collectDataPoint(supabase, userId, 'recurring_invoice_created', null, {
    frequency, amount_cents: totalCents,
  }).catch(() => {});

  return NextResponse.json({ recurring: data });
}

async function invoicesProcessRecurring(supabase: SupabaseClient, userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  // Find all active recurring invoices that are due today or earlier
  const { data: due, error } = await supabase
    .from('crm_recurring_invoices')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('next_date', today);

  if (error) {
    console.error('[CRM] Process recurring error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!due?.length) return NextResponse.json({ created: 0, message: 'No recurring invoices due' });

  const created: any[] = [];

  for (const rec of due) {
    // Create the invoice
    const { count } = await supabase.from('crm_invoices').select('id', { count: 'exact', head: true }).eq('user_id', userId);
    const num = (count || 0) + 1;
    const invoiceNumber = `INV-${String(num).padStart(3, '0')}`;

    // Calculate due date (14 days from creation)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    const { data: invoice } = await supabase.from('crm_invoices').insert({
      user_id: userId,
      client_id: rec.client_id,
      invoice_number: invoiceNumber,
      amount_cents: rec.amount_cents,
      items: rec.items,
      due_date: dueDate.toISOString().slice(0, 10),
      notes: `${rec.notes || ''}\n[Auto-generated from recurring invoice]`.trim(),
      currency: rec.currency || 'USD',
    }).select().single();

    if (invoice) created.push(invoice);

    // Calculate next date
    const nextDate = new Date(rec.next_date);
    switch (rec.frequency) {
      case 'weekly': nextDate.setDate(nextDate.getDate() + 7); break;
      case 'biweekly': nextDate.setDate(nextDate.getDate() + 14); break;
      case 'monthly': nextDate.setMonth(nextDate.getMonth() + 1); break;
      case 'quarterly': nextDate.setMonth(nextDate.getMonth() + 3); break;
    }

    await supabase.from('crm_recurring_invoices').update({
      next_date: nextDate.toISOString().slice(0, 10),
      last_generated_at: new Date().toISOString(),
    }).eq('id', rec.id);
  }

  return NextResponse.json({ created: created.length, invoices: created });
}

// ═══════════════════════════════════════════════════════════════
// OUTCOME TRACKING (30/60/90 DAY CHECK-INS)
// ═══════════════════════════════════════════════════════════════

async function outcomeCreate(supabase: SupabaseClient, userId: string, body: any) {
  const { clientId, projectId, goalDescription, targetDate, targetRevenue, checkpoints } = body;
  if (!goalDescription) return NextResponse.json({ error: 'Goal description required' }, { status: 400 });

  // Default checkpoints at 30, 60, 90 days
  const startDate = new Date();
  const defaultCheckpoints = [30, 60, 90].map(days => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + days);
    return {
      day: days,
      date: d.toISOString().slice(0, 10),
      status: 'pending',
      notes: '',
      metrics: {},
    };
  });

  const { data, error } = await supabase.from('crm_outcomes').insert({
    user_id: userId,
    client_id: clientId || null,
    project_id: projectId || null,
    goal_description: goalDescription,
    target_date: targetDate || null,
    target_revenue_cents: targetRevenue || null,
    start_date: startDate.toISOString().slice(0, 10),
    checkpoints: checkpoints || defaultCheckpoints,
    status: 'active',
  }).select().single();

  if (error) {
    console.error('[CRM] Outcome create error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ outcome: data });
}

async function outcomeList(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('crm_outcomes')
    .select('*, crm_clients(name), crm_projects(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[CRM] Outcome list error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check which outcomes have upcoming checkpoints
  const today = new Date().toISOString().slice(0, 10);
  const outcomes = (data || []).map((o: any) => {
    const checkpoints = o.checkpoints || [];
    const nextCheckpoint = checkpoints.find((cp: any) => cp.status === 'pending' && cp.date <= today);
    const upcomingCheckpoint = checkpoints.find((cp: any) => cp.status === 'pending');
    return {
      ...o,
      needsCheckIn: !!nextCheckpoint,
      nextCheckpoint: nextCheckpoint || upcomingCheckpoint || null,
    };
  });

  return NextResponse.json({ outcomes });
}

async function outcomeCheck(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });

  const { outcomeId, checkpointDay, notes, metricsUpdate } = body;
  if (!outcomeId || !checkpointDay) return NextResponse.json({ error: 'Missing outcomeId or checkpointDay' }, { status: 400 });

  // Get the outcome
  const { data: outcome } = await supabase.from('crm_outcomes')
    .select('*, crm_clients(name, company), crm_projects(name, status, progress_percent)')
    .eq('id', outcomeId).single();

  if (!outcome) return NextResponse.json({ error: 'Outcome not found' }, { status: 404 });

  // Update the checkpoint
  const checkpoints = outcome.checkpoints || [];
  const cpIndex = checkpoints.findIndex((cp: any) => cp.day === checkpointDay);
  if (cpIndex === -1) return NextResponse.json({ error: 'Checkpoint not found' }, { status: 404 });

  checkpoints[cpIndex] = {
    ...checkpoints[cpIndex],
    status: 'completed',
    notes: notes || '',
    metrics: metricsUpdate || {},
    completed_at: new Date().toISOString(),
  };

  // Get revenue data for context
  let revContext = '';
  if (outcome.client_id) {
    const { data: invoices } = await supabase.from('crm_invoices')
      .select('amount_cents, status, paid_date')
      .eq('client_id', outcome.client_id)
      .gte('created_at', outcome.start_date);
    const paid = (invoices || []).filter(i => i.status === 'paid');
    const totalPaid = paid.reduce((s, i) => s + (i.amount_cents || 0), 0);
    revContext = `Revenue from this client since goal started: $${(totalPaid / 100).toFixed(2)} (${paid.length} paid invoices)`;
  }

  // AI analysis of progress
  const res = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-20250514', max_tokens: 500,
    messages: [{ role: 'user', content: `You are analyzing a freelancer's progress at their ${checkpointDay}-day check-in.

GOAL: ${outcome.goal_description}
TARGET DATE: ${outcome.target_date || 'No specific deadline'}
TARGET REVENUE: ${outcome.target_revenue_cents ? `$${(outcome.target_revenue_cents / 100).toFixed(2)}` : 'Not specified'}
${revContext}

USER'S CHECK-IN NOTES: ${notes || 'No notes provided'}

PREVIOUS CHECKPOINTS:
${checkpoints.filter((cp: any) => cp.status === 'completed' && cp.day < checkpointDay).map((cp: any) => `Day ${cp.day}: ${cp.notes || 'No notes'}`).join('\n') || 'None yet'}

Analyze their progress and give actionable feedback. Be specific and honest — no vague encouragement.

Respond JSON only, no markdown:
{
  "progress_rating": "on_track|behind|ahead|at_risk",
  "analysis": "2-3 sentence honest assessment",
  "wins": ["specific win 1", "win 2"],
  "concerns": ["specific concern if any"],
  "next_actions": ["concrete action 1", "action 2", "action 3"],
  "adjusted_confidence": 0-100
}` }],
  });

  const text = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
  let analysis: any = {};
  try {
    analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (analysis.analysis) {
      analysis.analysis = validateOutput(analysis.analysis, { checkFinancial: false, checkGuarantee: true });
    }
  } catch {
    analysis = {
      progress_rating: 'unknown',
      analysis: 'Could not fully analyze progress. Review your goals and update manually.',
      wins: [], concerns: [], next_actions: ['Review your original goal', 'Update your metrics'],
      adjusted_confidence: 50,
    };
  }

  // Save updated checkpoints
  await supabase.from('crm_outcomes').update({
    checkpoints,
    last_check_in: new Date().toISOString(),
  }).eq('id', outcomeId);

  // Track data point
  collectDataPoint(supabase, userId, 'outcome_checkin', null, {
    day: checkpointDay,
    rating: analysis.progress_rating,
    confidence: analysis.adjusted_confidence,
  }).catch(() => {});

  return NextResponse.json({ analysis, checkpoint: checkpoints[cpIndex] });
}