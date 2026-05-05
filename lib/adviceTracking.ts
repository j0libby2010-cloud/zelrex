/**
 * ZELREX ADVICE OUTCOME TRACKING
 * 
 * Problem: Zelrex gives advice. Users act (or don't). Outcomes happen. 
 * None of this feeds back into the system. There's no way to know if 
 * the advice was good or bad.
 * 
 * This module provides the scaffolding to:
 * 1. LOG advice moments — when Zelrex makes a specific recommendation
 * 2. TAG recommendations with categories and stakes
 * 3. TRACK user response — did they say they'd do it? Did they follow through?
 * 4. SURFACE outcomes — user can come back and mark "this worked" / "this didn't"
 * 5. AGGREGATE patterns — over time, see which advice categories have which success rates
 * 
 * This is what separates "AI that gives advice" from "AI that learns from 
 * outcomes." Even without implementing learning yet, the data foundation 
 * has to exist.
 */

// ─── TYPES ───────────────────────────────────────────────────────

export type AdviceCategory = 
  | 'pricing-recommendation'
  | 'offer-change'
  | 'outreach-strategy'
  | 'client-decision'
  | 'business-model'
  | 'website-guidance'
  | 'positioning-shift'
  | 'time-allocation'
  | 'platform-decision'
  | 'scope-negotiation';

export type AdviceStakes = 'low' | 'medium' | 'high' | 'critical';

export interface AdviceRecord {
  id: string;
  userId: string;
  chatId?: string;
  messageId?: string;
  category: AdviceCategory;
  stakes: AdviceStakes;
  recommendation: string;        // The actual advice, short summary
  reasoning: string;             // Why Zelrex suggested it
  alternatives?: string[];       // Other options presented
  userContext: {                 // Snapshot of relevant user state at the time
    currentIncome?: string;
    targetIncome?: string;
    niche?: string;
    stage?: number;
    recentRevenue?: number;
  };
  createdAt: Date;
  outcome?: AdviceOutcome;
}

export interface AdviceOutcome {
  followedRecommendation: boolean | null;  // null = unknown
  outcome: 'worked' | 'didnt-work' | 'partial' | 'unknown';
  outcomeNote?: string;
  revenueImpact?: number;  // Dollars, positive or negative, if measurable
  reportedAt: Date;
}

// ─── DETECTION: WHEN IS CLAUDE GIVING ADVICE? ───────────────────

/**
 * Scan a Claude response to detect if it contains a specific recommendation
 * worth logging. Not every sentence is advice — we want the stakes moments.
 */
export function detectAdviceMoment(response: string): {
  isAdvice: boolean;
  category?: AdviceCategory;
  stakes?: AdviceStakes;
  recommendation?: string;
  reasoning?: string;
} {
  const lower = response.toLowerCase();

  // High-stakes signals
  const highStakesPhrases = [
    'i\'d strongly suggest',
    'i\'d recommend',
    'the strongest move',
    'what i\'d do in your position',
    'my honest take',
    'i\'d lean toward',
    'raise your price',
    'drop this client',
    'stop taking',
    'leave the platform',
    'quit your job',
    'reject this offer',
  ];
  
  const mediumStakesPhrases = [
    'you might consider',
    'worth exploring',
    'one option is',
    'another path',
    'try this',
  ];

  let stakes: AdviceStakes | undefined;
  for (const phrase of highStakesPhrases) {
    if (lower.includes(phrase)) {
      stakes = 'high';
      break;
    }
  }
  if (!stakes) {
    for (const phrase of mediumStakesPhrases) {
      if (lower.includes(phrase)) {
        stakes = 'medium';
        break;
      }
    }
  }

  if (!stakes) return { isAdvice: false };

  // Category detection from content
  let category: AdviceCategory | undefined;
  if (/\bprice|rate|charge|\$\d+/.test(lower)) category = 'pricing-recommendation';
  else if (/offer|package|tier|scope/.test(lower)) category = 'offer-change';
  else if (/outreach|cold email|linkedin dm|message prospects/.test(lower)) category = 'outreach-strategy';
  else if (/drop (?:this|that) client|fire|problematic client/.test(lower)) category = 'client-decision';
  else if (/retainer|project.based|hourly|subscription/.test(lower)) category = 'business-model';
  else if (/website|landing page|home page/.test(lower)) category = 'website-guidance';
  else if (/position|brand|niche down|specialize/.test(lower)) category = 'positioning-shift';
  else if (/hours|schedule|time (?:block|allocation)/.test(lower)) category = 'time-allocation';
  else if (/fiverr|upwork|platform|independent/.test(lower)) category = 'platform-decision';

  if (!category) return { isAdvice: false };

  // Extract the recommendation itself (first sentence with the trigger phrase)
  const sentences = response.split(/(?<=[.!?])\s+/);
  let recommendation = '';
  let reasoning = '';
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i].toLowerCase();
    if (highStakesPhrases.some(p => s.includes(p)) || mediumStakesPhrases.some(p => s.includes(p))) {
      recommendation = sentences[i];
      // Reasoning is often in the next 1-2 sentences
      if (sentences[i + 1]) reasoning = sentences[i + 1];
      break;
    }
  }

  return {
    isAdvice: true,
    category,
    stakes,
    recommendation: recommendation.slice(0, 400),
    reasoning: reasoning.slice(0, 400),
  };
}

// ─── SQL SCHEMA (for reference) ─────────────────────────────────

export const ADVICE_RECORDS_SQL_SCHEMA = `
-- Advice tracking table
-- Run this migration if you want to enable advice outcome tracking

CREATE TABLE IF NOT EXISTS advice_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  chat_id TEXT,
  message_id TEXT,
  category TEXT NOT NULL,
  stakes TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  reasoning TEXT,
  alternatives JSONB,
  user_context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Outcome fields (filled in later)
  followed_recommendation BOOLEAN,
  outcome TEXT,
  outcome_note TEXT,
  revenue_impact NUMERIC,
  outcome_reported_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_advice_records_user_id ON advice_records(user_id);
CREATE INDEX IF NOT EXISTS idx_advice_records_category ON advice_records(category);
CREATE INDEX IF NOT EXISTS idx_advice_records_outcome ON advice_records(outcome) WHERE outcome IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_advice_records_created_at ON advice_records(created_at DESC);
`;

// ─── AGGREGATE ANALYSIS ─────────────────────────────────────────

/**
 * Given a set of advice records with known outcomes, compute success rates
 * by category. Useful for dashboards and for surfacing "what works" patterns.
 */
export function analyzeAdvicePatterns(records: AdviceRecord[]): {
  totalRecords: number;
  withKnownOutcome: number;
  successRateOverall: number;
  byCategory: Record<AdviceCategory, { count: number; successRate: number; avgRevenueImpact: number }>;
} {
  const withOutcome = records.filter(r => r.outcome && r.outcome.outcome !== 'unknown');
  const succeeded = withOutcome.filter(r => r.outcome?.outcome === 'worked').length;
  const successRateOverall = withOutcome.length > 0 ? succeeded / withOutcome.length : 0;

  const byCategory: Record<string, any> = {};
  const categories = [...new Set(records.map(r => r.category))];
  
  for (const cat of categories) {
    const catRecords = withOutcome.filter(r => r.category === cat);
    const catSucceeded = catRecords.filter(r => r.outcome?.outcome === 'worked').length;
    const impactRecords = catRecords.filter(r => r.outcome?.revenueImpact !== undefined && r.outcome.revenueImpact !== null);
    const totalImpact = impactRecords.reduce((sum, r) => sum + (r.outcome!.revenueImpact || 0), 0);
    
    byCategory[cat] = {
      count: catRecords.length,
      successRate: catRecords.length > 0 ? catSucceeded / catRecords.length : 0,
      avgRevenueImpact: impactRecords.length > 0 ? totalImpact / impactRecords.length : 0,
    };
  }

  return {
    totalRecords: records.length,
    withKnownOutcome: withOutcome.length,
    successRateOverall,
    byCategory: byCategory as any,
  };
}

// ─── USER-FACING PROMPT (for outcome follow-up) ──────────────────

/**
 * Generate a gentle follow-up message asking the user about an outcome.
 * Should be surfaced 1-2 weeks after the advice was given.
 */
export function buildOutcomeFollowupMessage(record: AdviceRecord): string {
  const daysSince = Math.floor((Date.now() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  return `Quick check-in — about ${daysSince} days ago I suggested ${record.recommendation.slice(0, 120)}...

Did you end up trying that? And if so, how's it going? This helps me give better advice — both to you and to others in similar situations.`;
}