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
// POST /api/z/crm
// ═══════════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId } = body;
    const supabase = db();
    if (!userId || !supabase) return NextResponse.json({ error: 'Missing userId or DB' }, { status: 400 });

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

      // ─── Dashboard / Stats ───
      case 'dashboard': return dashboard(supabase, userId);
      case 'screen-client': return screenClient(supabase, userId, body);

      default: return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('[CRM] Error:', e?.message);
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
  const { data } = await supabase.from('crm_clients').select(`*, crm_invoices(*), crm_contracts(*), crm_followups(*)`).eq('id', body.clientId).single();
  return NextResponse.json({ client: data });
}

// ═══════════════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════════════

async function invoicesList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_invoices').select(`*, crm_clients(name, email, company)`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (body.status && body.status !== 'all') q = q.eq('status', body.status);
  if (body.clientId) q = q.eq('client_id', body.clientId);
  const { data } = await q;
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

  // Update client lifetime value
  try { await supabase.rpc('increment_client_value', { cid: clientId, amount: totalCents }); } catch {}

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
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  const ctx = (chats?.[0]?.messages || []).filter((m: any) => m.role === 'assistant').map((m: any) => m.content).join('\n').slice(0, 2000);

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 800,
    messages: [{ role: 'user', content: `Generate invoice line items for a freelancer.

CLIENT: ${client?.name} (${client?.company || 'Individual'})
FREELANCER BUSINESS CONTEXT: ${ctx}
WORK DESCRIPTION: ${description || 'General freelance work'}

Generate 1-4 invoice line items. Respond JSON only:
[{"description":"...","qty":1,"rate_cents":5000,"amount_cents":5000}]
No markdown, no backticks.` }],
  });

  const text = res.content[0]?.type === 'text' ? res.content[0].text : '[]';
  try {
    const items = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [{ description: description || 'Freelance work', qty: 1, rate_cents: 0, amount_cents: 0 }] });
  }
}

// ═══════════════════════════════════════════════════════════════
// CONTRACTS
// ═══════════════════════════════════════════════════════════════

async function contractsList(supabase: SupabaseClient, userId: string, body: any) {
  let q = supabase.from('crm_contracts').select(`*, crm_clients(name, email)`).eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (body.clientId) q = q.eq('client_id', body.clientId);
  const { data } = await q;
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
  const { data: chats } = await supabase.from('chats').select('messages').eq('user_id', userId).order('updated_at', { ascending: false }).limit(1);
  const ctx = (chats?.[0]?.messages || []).filter((m: any) => m.role === 'assistant').map((m: any) => m.content).join('\n').slice(0, 2000);

  const isProposal = type === 'proposal';

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 2000,
    messages: [{ role: 'user', content: `Generate a professional freelance ${isProposal ? 'proposal' : 'contract'} in markdown.

CLIENT: ${client?.name} (${client?.company || 'Individual'}, ${client?.email || 'no email'})
FREELANCER BUSINESS: ${ctx}
DESCRIPTION: ${description || 'General freelance services'}

${isProposal ? `PROPOSAL should include:
- Executive summary (what you'll do and why)
- Scope of work (specific deliverables)
- Timeline with milestones
- Investment (pricing with clear breakdown)
- Terms (payment schedule, revision policy)
- Next steps (how to accept)` : `CONTRACT should include:
- Parties (freelancer and client — use placeholder names)
- Scope of work (specific deliverables)
- Timeline and milestones
- Payment terms (amount, schedule, late fees)
- Revision policy (number of included revisions)
- Intellectual property (client owns final deliverables)
- Confidentiality clause
- Termination clause (30-day notice)
- Limitation of liability`}

IMPORTANT DISCLAIMER AT THE BOTTOM: "This ${isProposal ? 'proposal' : 'contract'} was generated by Zelrex AI as a starting template. It is NOT legal advice. Both parties should review with a qualified attorney before signing. Zelrex is not responsible for the terms, enforcement, or outcomes of this agreement."

Write in professional, clear language. Use markdown headers and formatting.` }],
  });

  const content = res.content[0]?.type === 'text' ? res.content[0].text : '';
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
  if (body.status && body.status !== 'all') q = q.eq('status', body.status);
  if (body.clientId) q = q.eq('client_id', body.clientId);
  const { data } = await q;
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
    model: 'claude-sonnet-4-20250514', max_tokens: 400,
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
  const [clientsR, activeR, invoicesR, paidR, overdueR, contractsR] = await Promise.all([
    supabase.from('crm_clients').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('crm_clients').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
    supabase.from('crm_invoices').select('amount_cents, status').eq('user_id', userId),
    supabase.from('crm_invoices').select('amount_cents').eq('user_id', userId).eq('status', 'paid'),
    supabase.from('crm_invoices').select('amount_cents').eq('user_id', userId).eq('status', 'overdue'),
    supabase.from('crm_contracts').select('id, status').eq('user_id', userId),
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
  });
}

// ═══════════════════════════════════════════════════════════════
// AI CLIENT SCREENING
// ═══════════════════════════════════════════════════════════════

async function screenClient(supabase: SupabaseClient, userId: string, body: any) {
  const anthropic = ai();
  if (!anthropic) return NextResponse.json({ error: 'AI not configured' }, { status: 500 });
  const { description } = body;
  if (!description) return NextResponse.json({ error: 'Missing description' }, { status: 400 });

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', max_tokens: 600,
    messages: [{ role: 'user', content: `You are a freelancer's business advisor. Analyze this potential client/project for red flags.

CLIENT/PROJECT DESCRIPTION:
${description}

Evaluate for these common freelancer red flags:
1. Scope creep risk (vague requirements, "we'll figure it out")
2. Payment risk (no budget mentioned, asking for free work first)
3. Communication issues (too many stakeholders, micromanagement signals)
4. Unrealistic expectations (impossible timelines, "quick simple job")
5. Value mismatch (client doesn't understand the work's value)

Respond JSON only:
{
  "score": 75,
  "verdict": "Proceed with caution",
  "flags": ["Vague scope - get specific deliverables in writing", "No budget mentioned - clarify before starting"],
  "green_lights": ["Long-term project potential", "Professional communication"],
  "recommendation": "Take this project but get a detailed scope document and 50% deposit before starting."
}

Score 0-100 (100 = perfect client, 0 = run away). Be honest and specific.
DISCLAIMER: This is AI-generated analysis for informational purposes only. It should not replace your professional judgment.` }],
  });

  const text = res.content[0]?.type === 'text' ? res.content[0].text : '{}';
  try {
    const result = JSON.parse(text.replace(/```json|```/g, '').trim());
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ score: 50, verdict: 'Unable to analyze', flags: [], green_lights: [], recommendation: 'Provide more details for a thorough analysis.' });
  }
}