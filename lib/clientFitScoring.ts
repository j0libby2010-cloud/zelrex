/**
 * ZELREX CLIENT FIT SCORING
 * 
 * Not every prospect is worth pursuing. Not every client is worth keeping.
 * This module scores prospects and clients on multiple dimensions so the 
 * freelancer focuses time on the highest-leverage relationships.
 * 
 * Dimensions scored:
 * - BUY_PROBABILITY: likelihood they'll actually convert to paying work
 * - BUDGET_FIT: can they pay rates you want to charge
 * - SCOPE_FIT: does what they need match what you do
 * - EFFORT_FIT: will this client be high-maintenance or easy
 * - STRATEGIC_VALUE: case-study-worthy? referral source? long-term?
 */

export interface ProspectSignals {
  // Basic
  companyName?: string;
  website?: string;
  industry?: string;
  
  // Company scale
  companySize?: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  fundingStage?: 'bootstrapped' | 'seed' | 'series-a' | 'series-b+' | 'public';
  yearsInBusiness?: number;
  
  // Discovery context
  foundVia?: 'job-posting' | 'referral' | 'inbound' | 'cold-outreach' | 'community' | 'social';
  source_url?: string;
  
  // Behavioral signals
  responded_to_outreach?: boolean;
  response_speed_hours?: number; // how fast they replied
  initial_question_specificity?: 'vague' | 'specific' | 'very-specific';
  mentioned_budget?: boolean;
  mentioned_timeline?: boolean;
  mentioned_decision_maker?: boolean;
  
  // Red flags
  requestedFreeTrial?: boolean;
  requestedSpec?: boolean;
  negotiatedBefore_starting?: boolean;
  vague_scope?: boolean;
  
  // Positive signals
  has_paid_freelancers_before?: boolean;
  clear_deliverables?: boolean;
  mentioned_similar_work_done?: boolean;
}

export interface ClientFitScore {
  overall: number; // 0-100
  tier: 'dream' | 'great' | 'good' | 'mediocre' | 'avoid';
  dimensions: {
    buyProbability: number;
    budgetFit: number;
    scopeFit: number;
    effortFit: number;
    strategicValue: number;
  };
  redFlags: string[];
  greenFlags: string[];
  recommendation: string;
}

export function scoreProspectFit(
  signals: ProspectSignals,
  freelancerProfile: {
    targetIndustries?: string[];
    minBudgetCents?: number;
    avoidIndustries?: string[];
    targetCompanySize?: ProspectSignals['companySize'][];
  }
): ClientFitScore {
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  // ─── BUY PROBABILITY ───────────────────────────────────
  let buyProbability = 40; // baseline
  
  if (signals.responded_to_outreach) {
    buyProbability += 20;
    greenFlags.push('already responded');
  }
  if (signals.response_speed_hours !== undefined && signals.response_speed_hours < 24) {
    buyProbability += 15;
    greenFlags.push('responded quickly');
  }
  if (signals.initial_question_specificity === 'very-specific') {
    buyProbability += 15;
    greenFlags.push('specific questions suggest serious intent');
  } else if (signals.initial_question_specificity === 'vague') {
    buyProbability -= 10;
    redFlags.push('vague questions — may be tire-kicking');
  }
  if (signals.mentioned_budget) {
    buyProbability += 10;
    greenFlags.push('mentioned budget');
  }
  if (signals.mentioned_timeline) {
    buyProbability += 10;
    greenFlags.push('has timeline');
  }
  if (signals.mentioned_decision_maker) {
    buyProbability += 10;
    greenFlags.push('has decision authority');
  }
  if (signals.foundVia === 'referral' || signals.foundVia === 'inbound') {
    buyProbability += 15;
    greenFlags.push(`came via ${signals.foundVia}`);
  }
  if (signals.has_paid_freelancers_before) {
    buyProbability += 10;
    greenFlags.push('paid freelancers before');
  }

  // ─── BUDGET FIT ─────────────────────────────────────────
  let budgetFit = 50;
  
  if (signals.companySize === '201-1000' || signals.companySize === '1000+') {
    budgetFit += 25;
    greenFlags.push('large company — budget likely available');
  } else if (signals.companySize === '51-200') {
    budgetFit += 15;
  } else if (signals.companySize === '11-50') {
    budgetFit += 5;
  } else if (signals.companySize === '1-10') {
    budgetFit -= 10;
    redFlags.push('micro-business — budget may be tight');
  }
  
  if (signals.fundingStage === 'series-b+' || signals.fundingStage === 'public') {
    budgetFit += 20;
    greenFlags.push('well-funded');
  } else if (signals.fundingStage === 'bootstrapped' && signals.yearsInBusiness && signals.yearsInBusiness > 3) {
    budgetFit += 10;
    greenFlags.push('profitable bootstrapped business');
  }

  // ─── SCOPE FIT ──────────────────────────────────────────
  let scopeFit = 60;
  
  if (signals.clear_deliverables) {
    scopeFit += 20;
    greenFlags.push('clear deliverables');
  }
  if (signals.vague_scope) {
    scopeFit -= 25;
    redFlags.push('vague scope — will expand mid-project');
  }
  if (freelancerProfile.targetIndustries && signals.industry && freelancerProfile.targetIndustries.includes(signals.industry)) {
    scopeFit += 15;
    greenFlags.push('in your target industry');
  }
  if (freelancerProfile.avoidIndustries && signals.industry && freelancerProfile.avoidIndustries.includes(signals.industry)) {
    scopeFit -= 30;
    redFlags.push('industry you\'ve chosen to avoid');
  }

  // ─── EFFORT FIT (how painful will they be) ─────────────
  let effortFit = 60;
  
  if (signals.requestedFreeTrial) {
    effortFit -= 30;
    redFlags.push('requested free trial — sets bad precedent');
  }
  if (signals.requestedSpec) {
    effortFit -= 25;
    redFlags.push('requested free spec work');
  }
  if (signals.negotiatedBefore_starting) {
    effortFit -= 15;
    redFlags.push('negotiated hard before work started — often continues');
  }
  if (signals.mentioned_similar_work_done) {
    effortFit += 15;
    greenFlags.push('has done similar projects — knows what to expect');
  }

  // ─── STRATEGIC VALUE ────────────────────────────────────
  let strategicValue = 40;
  
  // Known brands = case study gold
  const knownBrandPatterns = [
    /\.(gov|edu|mil)$/i,
    /forbes|wired|techcrunch|vogue|wsj/i,
  ];
  if (signals.website && knownBrandPatterns.some(p => p.test(signals.website!))) {
    strategicValue += 30;
    greenFlags.push('name-brand client — case study value');
  }
  if (signals.foundVia === 'referral') {
    strategicValue += 15;
    greenFlags.push('referral — likely to refer others');
  }
  if (signals.companySize === '201-1000' || signals.companySize === '1000+') {
    strategicValue += 15; // Expansion within company possible
  }

  // ─── NORMALIZE & WEIGHT ──────────────────────────────────
  const normalize = (v: number) => Math.max(0, Math.min(100, v));
  
  const dimensions = {
    buyProbability: normalize(buyProbability),
    budgetFit: normalize(budgetFit),
    scopeFit: normalize(scopeFit),
    effortFit: normalize(effortFit),
    strategicValue: normalize(strategicValue),
  };

  // Weights — buy probability and budget fit matter most for short-term revenue
  const overall = Math.round(
    dimensions.buyProbability * 0.30 +
    dimensions.budgetFit * 0.25 +
    dimensions.scopeFit * 0.20 +
    dimensions.effortFit * 0.15 +
    dimensions.strategicValue * 0.10
  );

  const tier: ClientFitScore['tier'] = 
    overall >= 85 ? 'dream' :
    overall >= 70 ? 'great' :
    overall >= 55 ? 'good' :
    overall >= 40 ? 'mediocre' :
    'avoid';

  const recommendation = 
    tier === 'dream' ? 'Drop everything and pursue this. Respond within 2 hours, not 2 days.' :
    tier === 'great' ? 'High-priority lead. Move them to the top of your outreach / response queue.' :
    tier === 'good' ? 'Worth pursuing at standard pace. Don\'t over-discount to win them.' :
    tier === 'mediocre' ? 'Pursue only if you have capacity. Don\'t lead with this account.' :
    'Consider declining. The effort likely exceeds the return. Protect your time.';

  return {
    overall,
    tier,
    dimensions,
    redFlags,
    greenFlags,
    recommendation,
  };
}

// ─── EXISTING CLIENT HEALTH MONITORING ────────────────────────

export interface ActiveClientHealth {
  clientId: string;
  daysSinceLastPayment: number;
  daysSinceLastCommunication: number;
  payment_disputes: number;
  scope_changes_past_month: number;
  avg_payment_delay_days: number;
  last_nps_sentiment?: 'positive' | 'neutral' | 'negative';
}

/**
 * Detect clients who are silently churning.
 * The best time to save a client is BEFORE they ghost you.
 */
export function assessClientHealth(data: ActiveClientHealth): {
  status: 'healthy' | 'cooling' | 'at-risk' | 'churning' | 'problematic';
  signals: string[];
  action: string;
} {
  const signals: string[] = [];
  let riskScore = 0;

  if (data.daysSinceLastCommunication > 14) {
    signals.push(`No communication for ${data.daysSinceLastCommunication} days`);
    riskScore += 25;
  } else if (data.daysSinceLastCommunication > 7) {
    signals.push(`Communication slowing — ${data.daysSinceLastCommunication} days since last contact`);
    riskScore += 10;
  }

  if (data.avg_payment_delay_days > 14) {
    signals.push(`Paying ${data.avg_payment_delay_days} days late on average`);
    riskScore += 20;
  }

  if (data.payment_disputes > 0) {
    signals.push(`${data.payment_disputes} payment disputes`);
    riskScore += 30;
  }

  if (data.scope_changes_past_month > 3) {
    signals.push(`${data.scope_changes_past_month} scope changes this month — scope creep risk`);
    riskScore += 15;
  }

  if (data.last_nps_sentiment === 'negative') {
    signals.push('Negative sentiment in last interaction');
    riskScore += 25;
  }

  const status = 
    riskScore >= 60 ? 'churning' :
    riskScore >= 40 ? 'at-risk' :
    riskScore >= 20 ? 'cooling' :
    riskScore >= 10 && data.payment_disputes > 0 ? 'problematic' :
    'healthy';

  const action = 
    status === 'churning' ? 'Schedule a direct conversation this week. Ask openly if the engagement is working.' :
    status === 'at-risk' ? 'Re-engage personally. Send a status update and ask about priorities.' :
    status === 'cooling' ? 'Check in with a low-pressure message. Share a wins/progress update.' :
    status === 'problematic' ? 'Consider whether to continue. Problem clients rarely become good clients.' :
    'Client is healthy. Maintain current communication cadence.';

  return { status, signals, action };
}