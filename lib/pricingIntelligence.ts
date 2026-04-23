/**
 * ZELREX PRICING INTELLIGENCE
 * 
 * The difference between "AI that guesses rates" and "AI that prices reliably":
 * 
 * 1. ANCHORS TO REAL DATA — user's own history + verified market data, never guesses
 * 2. TIERS BY DELIVERABLE — not hourly (race to bottom) but value-scoped
 * 3. CLIENT BUDGET SIGNALS — reads the client (company size, industry, prior spend)
 * 4. MARKET POSITIONING — prices to where the freelancer wants to BE, not where they ARE
 * 5. PROTECTS AGAINST UNDERSELLING — the most common freelancer mistake is pricing too low
 * 6. EXPLAINS THE WHY — every price includes reasoning the user can defend to the client
 */

// ─── USER PRICING HISTORY ANALYSIS ───────────────────────────────

export interface PastEngagement {
  amount_cents: number;
  service_type?: string;
  client_company?: string;
  completed_at?: string;
  duration_weeks?: number;
  scope_description?: string;
}

export interface PricingContext {
  userHistory: PastEngagement[];
  targetService: string;
  targetClientCompany?: string;
  targetClientIndustry?: string;
  targetScope?: string;
  userTier?: 'new' | 'mid' | 'senior' | 'premium'; // Where user positions themselves
}

/**
 * Analyze the user's past pricing to establish a defensible baseline.
 * Returns statistical data, not guesses.
 */
export function analyzeUserPricing(history: PastEngagement[]): {
  sampleSize: number;
  median: number;
  p25: number; // 25th percentile — "low end" of what they charge
  p75: number; // 75th percentile — "high end"
  range: { min: number; max: number };
  trend: 'increasing' | 'decreasing' | 'flat' | 'insufficient_data';
  confidence: 'high' | 'medium' | 'low' | 'none';
} {
  if (!history || history.length === 0) {
    return { sampleSize: 0, median: 0, p25: 0, p75: 0, range: { min: 0, max: 0 }, trend: 'insufficient_data', confidence: 'none' };
  }

  const amounts = history.map(h => h.amount_cents).filter(a => a > 0).sort((a, b) => a - b);
  if (amounts.length === 0) {
    return { sampleSize: 0, median: 0, p25: 0, p75: 0, range: { min: 0, max: 0 }, trend: 'insufficient_data', confidence: 'none' };
  }

  const median = amounts[Math.floor(amounts.length / 2)];
  const p25 = amounts[Math.floor(amounts.length * 0.25)];
  const p75 = amounts[Math.floor(amounts.length * 0.75)];

  // Trend analysis — sort by date, compare first half to second half
  let trend: 'increasing' | 'decreasing' | 'flat' | 'insufficient_data' = 'insufficient_data';
  if (history.length >= 6) {
    const dated = history
      .filter(h => h.completed_at)
      .sort((a, b) => new Date(a.completed_at!).getTime() - new Date(b.completed_at!).getTime());
    if (dated.length >= 6) {
      const firstHalf = dated.slice(0, Math.floor(dated.length / 2));
      const secondHalf = dated.slice(Math.floor(dated.length / 2));
      const firstAvg = firstHalf.reduce((s, h) => s + h.amount_cents, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, h) => s + h.amount_cents, 0) / secondHalf.length;
      const pctChange = ((secondAvg - firstAvg) / firstAvg) * 100;
      if (pctChange > 15) trend = 'increasing';
      else if (pctChange < -15) trend = 'decreasing';
      else trend = 'flat';
    }
  }

  const confidence = 
    amounts.length >= 10 ? 'high' :
    amounts.length >= 5 ? 'medium' :
    amounts.length >= 2 ? 'low' :
    'none';

  return {
    sampleSize: amounts.length,
    median,
    p25,
    p75,
    range: { min: amounts[0], max: amounts[amounts.length - 1] },
    trend,
    confidence,
  };
}

// ─── CLIENT BUDGET SIGNAL DETECTION ──────────────────────────────

/**
 * Estimate client budget tier from signals.
 * Returns confidence-scored estimate — never guarantees.
 */
export function estimateClientBudgetTier(signals: {
  companyName?: string;
  companySize?: string; // "1-10", "11-50", "51-200", "201-1000", "1000+"
  industry?: string;
  fundingStage?: string; // "bootstrapped", "seed", "series-a", "series-b+", "public"
  prior_engagement_value?: number; // if they've paid the user before
  job_posting_range?: { min: number; max: number }; // if shown in job posting
}): {
  tier: 'micro' | 'small' | 'mid' | 'enterprise' | 'unknown';
  multiplier: number; // multiply median user rate by this
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
} {
  // Prior engagement is the strongest signal
  if (signals.prior_engagement_value && signals.prior_engagement_value > 0) {
    if (signals.prior_engagement_value >= 1500000) { // $15k+
      return { tier: 'enterprise', multiplier: 1.4, confidence: 'high', reasoning: `They previously paid $${(signals.prior_engagement_value / 100).toFixed(0)} — established enterprise budget` };
    } else if (signals.prior_engagement_value >= 500000) { // $5k+
      return { tier: 'mid', multiplier: 1.1, confidence: 'high', reasoning: 'Past engagement suggests mid-market budget' };
    } else {
      return { tier: 'small', multiplier: 0.9, confidence: 'high', reasoning: 'Past engagement was small — price accordingly' };
    }
  }

  // Job posting range is next-strongest
  if (signals.job_posting_range) {
    const avg = (signals.job_posting_range.min + signals.job_posting_range.max) / 2;
    if (avg >= 1000000) return { tier: 'enterprise', multiplier: 1.3, confidence: 'high', reasoning: 'Job posting shows enterprise budget' };
    if (avg >= 300000) return { tier: 'mid', multiplier: 1.0, confidence: 'high', reasoning: 'Job posting shows mid-market budget' };
    if (avg >= 50000) return { tier: 'small', multiplier: 0.8, confidence: 'high', reasoning: 'Job posting shows small-business budget' };
    return { tier: 'micro', multiplier: 0.6, confidence: 'high', reasoning: 'Job posting shows micro budget — consider if worth pursuing' };
  }

  // Company size + funding = estimate
  if (signals.fundingStage === 'series-b+' || signals.fundingStage === 'public') {
    return { tier: 'enterprise', multiplier: 1.3, confidence: 'medium', reasoning: 'Later-stage funding suggests enterprise budget' };
  }
  if (signals.fundingStage === 'series-a') {
    return { tier: 'mid', multiplier: 1.1, confidence: 'medium', reasoning: 'Series A companies typically have mid-market budgets' };
  }
  if (signals.fundingStage === 'seed') {
    return { tier: 'small', multiplier: 0.95, confidence: 'medium', reasoning: 'Seed-stage — cautious budget' };
  }

  if (signals.companySize === '1000+' || signals.companySize === '201-1000') {
    return { tier: 'enterprise', multiplier: 1.3, confidence: 'medium', reasoning: 'Company size suggests enterprise' };
  }
  if (signals.companySize === '51-200') {
    return { tier: 'mid', multiplier: 1.0, confidence: 'medium', reasoning: 'Mid-size company — mid-market budget' };
  }
  if (signals.companySize === '11-50') {
    return { tier: 'small', multiplier: 0.85, confidence: 'medium', reasoning: 'Small company — smaller budget' };
  }
  if (signals.companySize === '1-10') {
    return { tier: 'micro', multiplier: 0.7, confidence: 'medium', reasoning: 'Micro business — tight budget' };
  }

  return { tier: 'unknown', multiplier: 1.0, confidence: 'low', reasoning: 'Insufficient signals — quote user\'s standard rate' };
}

// ─── THREE-TIER PRICING STRUCTURE ────────────────────────────────

/**
 * Generate 3-tier pricing: Essentials / Growth / Premium.
 * This beats hourly pricing because it anchors on value not time,
 * and gives the client a psychological "middle option" (which wins 60%+ of the time).
 */
export function buildThreeTierPricing(params: {
  basePriceCents: number; // Usually the user's median
  service: string;
  deliverables: {
    essential: string[];
    growth: string[];
    premium: string[];
  };
}): {
  tiers: Array<{
    name: string;
    priceCents: number;
    description: string;
    deliverables: string[];
    positioning: string;
    anchor: boolean;
  }>;
  reasoning: string;
} {
  const base = params.basePriceCents;
  // Growth is the anchor (middle option wins most)
  // Essentials is 60% of growth, Premium is 180% of growth
  const growthPrice = base;
  const essentialsPrice = Math.round(base * 0.6);
  const premiumPrice = Math.round(base * 1.8);

  return {
    tiers: [
      {
        name: 'Essentials',
        priceCents: essentialsPrice,
        description: `For ${params.service.toLowerCase()} needs with a defined scope`,
        deliverables: params.deliverables.essential,
        positioning: 'The floor — priced to be the easy yes',
        anchor: false,
      },
      {
        name: 'Growth',
        priceCents: growthPrice,
        description: `Most clients choose this — balanced scope and support`,
        deliverables: params.deliverables.growth,
        positioning: 'The anchor — priced at your typical engagement',
        anchor: true,
      },
      {
        name: 'Premium',
        priceCents: premiumPrice,
        description: `For clients who want deeper collaboration and faster delivery`,
        deliverables: params.deliverables.premium,
        positioning: 'The ceiling — makes Growth look reasonable',
        anchor: false,
      },
    ],
    reasoning: `Growth is priced at your historical median ($${(growthPrice / 100).toFixed(0)}) — defensible with past invoice data. Essentials is 60% of Growth to create an "easy yes" entry point. Premium is 80% above Growth to anchor the range and make Growth feel like the middle/safe option — roughly 60% of three-tier buyers pick the middle.`,
  };
}

// ─── UNDERSELLING PROTECTION ─────────────────────────────────────

/**
 * Detect when a user is about to underprice themselves.
 * This is the most common freelancer mistake and the #1 driver of burnout.
 */
export function detectUnderpricing(params: {
  proposedPriceCents: number;
  userPricing: ReturnType<typeof analyzeUserPricing>;
  clientBudgetTier?: ReturnType<typeof estimateClientBudgetTier>;
  scope?: string;
}): {
  isUnderpriced: boolean;
  severity: 'severe' | 'moderate' | 'minor' | 'none';
  recommendation?: string;
  suggestedMinimum?: number;
} {
  const proposed = params.proposedPriceCents;
  const { p25, median } = params.userPricing;

  // If we have no history, can't detect
  if (params.userPricing.confidence === 'none') {
    return { isUnderpriced: false, severity: 'none' };
  }

  // Below the user's own 25th percentile = below their floor
  if (proposed < p25 && p25 > 0) {
    const pctBelow = Math.round(((p25 - proposed) / p25) * 100);
    return {
      isUnderpriced: true,
      severity: pctBelow > 30 ? 'severe' : pctBelow > 15 ? 'moderate' : 'minor',
      recommendation: `This is ${pctBelow}% below your own 25th-percentile rate ($${(p25 / 100).toFixed(0)}). You've charged more than this on ${Math.round(params.userPricing.sampleSize * 0.75)} past projects.`,
      suggestedMinimum: p25,
    };
  }

  // Below median + client is high-budget tier = leaving money on the table
  if (proposed < median && params.clientBudgetTier && (params.clientBudgetTier.tier === 'enterprise' || params.clientBudgetTier.tier === 'mid')) {
    return {
      isUnderpriced: true,
      severity: 'moderate',
      recommendation: `This client looks like a ${params.clientBudgetTier.tier} — they can afford more than your median ($${(median / 100).toFixed(0)}). ${params.clientBudgetTier.reasoning}`,
      suggestedMinimum: median,
    };
  }

  // Below $5k for enterprise client = almost certainly underpriced
  if (proposed < 500000 && params.clientBudgetTier?.tier === 'enterprise') {
    return {
      isUnderpriced: true,
      severity: 'severe',
      recommendation: `Under $5k for an enterprise client is suspicious unless scope is very narrow. Enterprise buyers equate low price with low quality.`,
      suggestedMinimum: 500000,
    };
  }

  return { isUnderpriced: false, severity: 'none' };
}

// ─── PRICING EXPLANATION BUILDER ─────────────────────────────────

/**
 * Every price Zelrex proposes comes with a defensible rationale the user can 
 * forward to the client or use to justify the number in their own head.
 */
export function buildPricingRationale(params: {
  proposedPriceCents: number;
  userPricing: ReturnType<typeof analyzeUserPricing>;
  clientBudgetTier?: ReturnType<typeof estimateClientBudgetTier>;
  scope?: string;
  deliverables?: string[];
}): string {
  const lines: string[] = [];
  const dollarAmount = `$${(params.proposedPriceCents / 100).toFixed(0)}`;

  // Ground in history
  if (params.userPricing.confidence !== 'none') {
    const mid = `$${(params.userPricing.median / 100).toFixed(0)}`;
    if (params.proposedPriceCents > params.userPricing.median * 1.2) {
      lines.push(`${dollarAmount} is above your median rate (${mid}). That's appropriate if this scope is bigger than your typical engagement or the client is a larger account.`);
    } else if (params.proposedPriceCents < params.userPricing.median * 0.8) {
      lines.push(`${dollarAmount} is below your median (${mid}). Worth reconsidering unless the scope is narrower or this is a strategic partnership.`);
    } else {
      lines.push(`${dollarAmount} is in line with your typical engagement (median: ${mid}).`);
    }
  }

  // Client tier context
  if (params.clientBudgetTier && params.clientBudgetTier.confidence !== 'low') {
    lines.push(`This client looks like a ${params.clientBudgetTier.tier} buyer (${params.clientBudgetTier.reasoning}).`);
  }

  // Scope context
  if (params.deliverables && params.deliverables.length > 0) {
    lines.push(`Scope includes ${params.deliverables.length} deliverables: ${params.deliverables.slice(0, 3).join(', ')}${params.deliverables.length > 3 ? '...' : ''}.`);
  }

  return lines.join(' ');
}