/**
 * ZELREX ASSISTANT INTELLIGENCE
 * 
 * The difference between a chatbot and a co-pilot:
 * 
 * A chatbot answers questions when asked.
 * A co-pilot SURFACES what you need to know BEFORE you ask.
 * 
 * This module is responsible for:
 * 1. DETECTING what's worth surfacing (not everything is)
 * 2. PRIORITIZING by actual impact on the user's goals
 * 3. TIMING — right thing, right moment (not "you have 47 notifications")
 * 4. ACTIONABILITY — every surfaced insight has a specific next step
 * 5. CALIBRATING urgency — "your invoice is 3 days overdue" vs "worth thinking about"
 */

// ─── INSIGHT CATEGORIES ──────────────────────────────────────────

export type InsightCategory = 
  | 'revenue-opportunity'    // Money on the table right now
  | 'risk-mitigation'        // Something might go wrong
  | 'time-decay'             // Window closing on an action
  | 'pattern-observation'    // Pattern in the data worth knowing
  | 'goal-progress'          // Toward the user's stated goals
  | 'client-health'          // Existing client needs attention
  | 'market-signal';         // External change relevant to user

export interface Insight {
  id: string;
  category: InsightCategory;
  urgency: 'immediate' | 'this-week' | 'this-month' | 'informational';
  title: string;
  explanation: string;
  nextAction: string; // Specific, one-sentence action
  impactEstimate?: {
    metric: 'revenue' | 'time' | 'clients';
    amount: string; // e.g. "$2,400/month" or "3-5 hours/week"
    confidence: 'high' | 'medium' | 'low';
  };
  expiresAt?: Date; // Time-sensitive insights
  dismissible: boolean;
}

// ─── INSIGHT DETECTORS ───────────────────────────────────────────

export interface UserContext {
  clients: Array<{
    id: string;
    name: string;
    totalPaid?: number;
    lastInvoiceDate?: Date;
    lastCommunication?: Date;
    status?: string;
  }>;
  invoices: Array<{
    id: string;
    client_id: string;
    amount_cents: number;
    status: string;
    due_date?: Date;
    created_at: Date;
  }>;
  outreachEmails: Array<{
    id: string;
    prospect_id: string;
    status: string;
    sent_at: Date;
    replied_at?: Date;
  }>;
  analytics?: {
    pageviews_30d: number;
    pageviews_prev_30d: number;
    cta_clicks_30d: number;
  };
  goal?: {
    target: number; // revenue target
    deadline: Date;
    progress: number; // current progress toward target
  };
  businessAge_days?: number;
}

/**
 * Detect overdue invoices that need attention.
 */
export function detectOverdueInvoices(ctx: UserContext): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();

  for (const inv of ctx.invoices) {
    if (inv.status !== 'sent' && inv.status !== 'overdue') continue;
    if (!inv.due_date) continue;

    const daysOverdue = Math.floor((now.getTime() - inv.due_date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOverdue < 0) continue; // Not yet overdue

    const client = ctx.clients.find(c => c.id === inv.client_id);
    const amount = `$${(inv.amount_cents / 100).toFixed(2)}`;

    if (daysOverdue >= 30) {
      insights.push({
        id: `overdue-${inv.id}`,
        category: 'risk-mitigation',
        urgency: 'immediate',
        title: `${client?.name || 'Client'}: ${amount} invoice is ${daysOverdue} days overdue`,
        explanation: `Invoices over 30 days late have under 70% collection rates. Every additional week drops that further.`,
        nextAction: `Send a firm but polite payment follow-up today. If no response by end of week, escalate to a formal demand letter.`,
        impactEstimate: { metric: 'revenue', amount, confidence: 'high' },
        dismissible: false,
      });
    } else if (daysOverdue >= 14) {
      insights.push({
        id: `overdue-${inv.id}`,
        category: 'risk-mitigation',
        urgency: 'this-week',
        title: `${client?.name || 'Client'}: ${amount} invoice is ${daysOverdue} days overdue`,
        explanation: `Invoices over 2 weeks late often signal deeper payment issues.`,
        nextAction: `Call or send a direct message today — email alone may not be working.`,
        impactEstimate: { metric: 'revenue', amount, confidence: 'high' },
        dismissible: false,
      });
    } else if (daysOverdue >= 3) {
      insights.push({
        id: `overdue-${inv.id}`,
        category: 'risk-mitigation',
        urgency: 'this-week',
        title: `${client?.name || 'Client'}: ${amount} invoice is ${daysOverdue} days late`,
        explanation: `Most late payments recover quickly with a gentle reminder.`,
        nextAction: `Send a friendly reminder referencing the invoice and new due date.`,
        impactEstimate: { metric: 'revenue', amount, confidence: 'high' },
        dismissible: true,
      });
    }
  }

  return insights;
}

/**
 * Detect prospects who replied but haven't been followed up.
 * Replies decay fast — a reply you respond to in 1 hour converts 7x better than 24 hours.
 */
export function detectStaleReplies(ctx: UserContext): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();

  for (const email of ctx.outreachEmails) {
    if (email.status !== 'replied') continue;
    if (!email.replied_at) continue;

    const hoursSinceReply = (now.getTime() - email.replied_at.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceReply > 2 && hoursSinceReply < 48) {
      insights.push({
        id: `stale-reply-${email.id}`,
        category: 'revenue-opportunity',
        urgency: 'immediate',
        title: `Prospect replied ${Math.round(hoursSinceReply)} hours ago — still waiting on you`,
        explanation: `Reply-within-1-hour wins 7x more than reply-within-24-hours. You're past the golden window but still in a winnable zone.`,
        nextAction: `Respond right now. Keep it short — match the energy of their reply, don't over-explain.`,
        dismissible: false,
      });
    }
  }

  return insights;
}

/**
 * Detect clients who are silently churning.
 */
export function detectCoolingClients(ctx: UserContext): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();

  for (const client of ctx.clients) {
    if (client.status !== 'active') continue;
    if (!client.lastCommunication) continue;

    const daysSilent = Math.floor((now.getTime() - client.lastCommunication.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSilent >= 21 && (client.totalPaid || 0) >= 100000) { // $1k+ lifetime
      insights.push({
        id: `cooling-${client.id}`,
        category: 'client-health',
        urgency: 'this-week',
        title: `${client.name}: no contact for ${daysSilent} days`,
        explanation: `High-value clients who go silent for 3+ weeks often churn without warning. The best time to re-engage is before they realize they've drifted.`,
        nextAction: `Send a low-pressure check-in today. Share a wins update or ask about their priorities.`,
        impactEstimate: { metric: 'revenue', amount: `$${((client.totalPaid || 0) / 100).toFixed(0)} LTV at risk`, confidence: 'medium' },
        dismissible: true,
      });
    }
  }

  return insights;
}

/**
 * Detect concerning traffic trends.
 */
export function detectTrafficSignals(ctx: UserContext): Insight[] {
  const insights: Insight[] = [];
  if (!ctx.analytics) return insights;

  const { pageviews_30d, pageviews_prev_30d, cta_clicks_30d } = ctx.analytics;

  // Traffic dropped significantly
  if (pageviews_prev_30d > 50 && pageviews_30d < pageviews_prev_30d * 0.6) {
    const drop = Math.round(((pageviews_prev_30d - pageviews_30d) / pageviews_prev_30d) * 100);
    insights.push({
      id: 'traffic-drop',
      category: 'risk-mitigation',
      urgency: 'this-week',
      title: `Traffic dropped ${drop}% this month`,
      explanation: `A 40%+ month-over-month traffic drop usually has one of four causes: algorithm shift, seasonality, referrer change, or broken tracking. Worth investigating before pipeline suffers.`,
      nextAction: `Check referrer sources — if a specific referrer went to zero, something broke. Check Search Console for crawl errors.`,
      dismissible: true,
    });
  }

  // Traffic up but no conversions — copy mismatch
  if (pageviews_30d > 200 && cta_clicks_30d < pageviews_30d * 0.005) {
    insights.push({
      id: 'conversion-leak',
      category: 'revenue-opportunity',
      urgency: 'this-month',
      title: `Low conversion rate: ${cta_clicks_30d} clicks from ${pageviews_30d} views`,
      explanation: `0.5%+ CTA click rate is a baseline. You're below that, which usually means the hero copy isn't matching visitor intent.`,
      nextAction: `Review your hero headline. Does it say what you do in one sentence? Would a stranger understand in 5 seconds?`,
      dismissible: true,
    });
  }

  return insights;
}

/**
 * Detect positive signals worth celebrating + doubling down on.
 */
export function detectWins(ctx: UserContext): Insight[] {
  const insights: Insight[] = [];
  const now = new Date();

  // Revenue spike
  if (ctx.invoices.length > 0) {
    const paidThisMonth = ctx.invoices
      .filter(i => {
        if (i.status !== 'paid') return false;
        const daysAgo = (now.getTime() - i.created_at.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
      })
      .reduce((sum, i) => sum + i.amount_cents, 0);

    const paidPrevMonth = ctx.invoices
      .filter(i => {
        if (i.status !== 'paid') return false;
        const daysAgo = (now.getTime() - i.created_at.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo > 30 && daysAgo <= 60;
      })
      .reduce((sum, i) => sum + i.amount_cents, 0);

    if (paidThisMonth > paidPrevMonth * 1.3 && paidPrevMonth > 100000) {
      const pct = Math.round(((paidThisMonth - paidPrevMonth) / paidPrevMonth) * 100);
      insights.push({
        id: 'revenue-win',
        category: 'pattern-observation',
        urgency: 'informational',
        title: `Revenue up ${pct}% month-over-month`,
        explanation: `Something is working. This is worth understanding so you can replicate it.`,
        nextAction: `Look at the clients paying you this month vs last. What changed? How did you get them? Double down there.`,
        dismissible: true,
      });
    }
  }

  // High outreach reply rate
  const recentOutreach = ctx.outreachEmails.filter(e => {
    const daysAgo = (now.getTime() - e.sent_at.getTime()) / (1000 * 60 * 60 * 24);
    return daysAgo <= 14;
  });
  const replies = recentOutreach.filter(e => e.status === 'replied').length;
  if (recentOutreach.length >= 10 && replies / recentOutreach.length > 0.10) {
    const rate = Math.round((replies / recentOutreach.length) * 100);
    insights.push({
      id: 'outreach-win',
      category: 'pattern-observation',
      urgency: 'informational',
      title: `Outreach reply rate is ${rate}% — well above average`,
      explanation: `Average cold outreach reply rates are 2-5%. You're at ${rate}%, which means your current message and targeting are working.`,
      nextAction: `Scale this. Send 2-3x more outreach at the same quality bar before the approach gets saturated.`,
      dismissible: true,
    });
  }

  return insights;
}

// ─── PRIORITIZATION ──────────────────────────────────────────────

/**
 * Take all detected insights, rank them by impact, return the top N.
 * Zelrex should surface 3-5 at most. More than that = noise.
 */
export function prioritizeInsights(insights: Insight[], maxCount = 5): Insight[] {
  const urgencyWeight: Record<Insight['urgency'], number> = {
    'immediate': 100,
    'this-week': 60,
    'this-month': 30,
    'informational': 10,
  };

  const categoryWeight: Record<InsightCategory, number> = {
    'revenue-opportunity': 30,
    'risk-mitigation': 25,
    'time-decay': 20,
    'client-health': 15,
    'goal-progress': 10,
    'pattern-observation': 8,
    'market-signal': 5,
  };

  const scored = insights.map(i => {
    let score = urgencyWeight[i.urgency] + categoryWeight[i.category];
    // Bonus if dollar amount is large
    if (i.impactEstimate?.metric === 'revenue') {
      const amountMatch = i.impactEstimate.amount.match(/\$([0-9,]+)/);
      if (amountMatch) {
        const dollars = parseInt(amountMatch[1].replace(/,/g, ''));
        if (dollars > 5000) score += 20;
        else if (dollars > 1000) score += 10;
      }
    }
    return { insight: i, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map(s => s.insight);
}

// ─── MAIN ENTRY POINT ────────────────────────────────────────────

/**
 * Generate the full prioritized list of insights for a user.
 * Call this on dashboard load, before chat, and on a schedule.
 */
export function generateInsights(ctx: UserContext): Insight[] {
  const all: Insight[] = [
    ...detectOverdueInvoices(ctx),
    ...detectStaleReplies(ctx),
    ...detectCoolingClients(ctx),
    ...detectTrafficSignals(ctx),
    ...detectWins(ctx),
  ];

  return prioritizeInsights(all, 5);
}