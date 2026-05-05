/**
 * ZELREX FACT VERIFICATION & FRESHNESS
 * 
 * Problem: The system prompt contains hardcoded market benchmarks like 
 * "Video editing: $300-1,500/video." If these are stale or wrong, every 
 * user gets bad pricing anchors.
 * 
 * Solution: a fact verification layer that:
 * 1. Tracks how old each "known fact" is
 * 2. Forces web search for stale facts before Claude uses them
 * 3. Flags claims made with high confidence that shouldn't be
 * 4. Logs which facts Zelrex used so you can audit outcomes later
 */

// ─── FACT FRESHNESS TIERS ────────────────────────────────────────

export type FreshnessStatus = 'fresh' | 'aging' | 'stale' | 'unknown';

export interface TimestampedFact {
  content: string;
  source: 'training' | 'web-search' | 'user-provided' | 'calculated';
  storedAt?: Date;
  expiresAt?: Date;
}

/**
 * How stale is a fact? Different categories have different staleness thresholds.
 */
export function assessFreshness(
  fact: TimestampedFact,
  category: 'pricing' | 'market-data' | 'platform-info' | 'tool-info' | 'general'
): { status: FreshnessStatus; ageInDays: number | null; shouldVerify: boolean } {
  // If there's no timestamp, assume it's training data (stale by default for dynamic topics)
  if (!fact.storedAt) {
    const shouldVerify = ['pricing', 'market-data', 'platform-info', 'tool-info'].includes(category);
    return {
      status: 'unknown',
      ageInDays: null,
      shouldVerify,
    };
  }

  const ageMs = Date.now() - fact.storedAt.getTime();
  const ageInDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

  // Category-specific staleness thresholds
  const thresholds: Record<typeof category, { fresh: number; aging: number }> = {
    'pricing': { fresh: 30, aging: 90 },          // Pricing changes fast
    'market-data': { fresh: 60, aging: 180 },     // Market sizing changes medium
    'platform-info': { fresh: 14, aging: 60 },    // Platform policies change FAST
    'tool-info': { fresh: 30, aging: 90 },        // Tool pricing/features change
    'general': { fresh: 365, aging: 730 },        // General info stable
  };

  const t = thresholds[category];
  let status: FreshnessStatus;
  if (ageInDays <= t.fresh) status = 'fresh';
  else if (ageInDays <= t.aging) status = 'aging';
  else status = 'stale';

  return {
    status,
    ageInDays,
    shouldVerify: status === 'stale',
  };
}

// ─── HIGH-STAKES CLAIM DETECTION ────────────────────────────────

/**
 * Some claims need verification before Claude states them confidently.
 * This returns whether a claim is high-stakes and should trigger web search.
 */
export function isHighStakesClaim(text: string): {
  isHighStakes: boolean;
  category: string | null;
  reason: string;
} {
  // Specific dollar amounts → high stakes if stated as current fact
  if (/\$\d{3,}(?:[,.]\d{3})*\s*(?:per|\/|a)\s*(?:month|year|hour|day|project|client|user|seat)/i.test(text)) {
    return {
      isHighStakes: true,
      category: 'pricing',
      reason: 'Specific price stated as fact',
    };
  }

  // Platform policies
  if (/(?:fiverr|upwork|contra|toptal|stripe|substack|patreon) (?:charges?|takes?|fees?|policy|rules?)/i.test(text)) {
    return {
      isHighStakes: true,
      category: 'platform-info',
      reason: 'Platform policy/fee claim',
    };
  }

  // Tool pricing
  if (/(?:notion|figma|webflow|framer|zapier|airtable|make|n8n) (?:costs?|pricing|plan|tier)/i.test(text)) {
    return {
      isHighStakes: true,
      category: 'tool-info',
      reason: 'Tool pricing claim',
    };
  }

  // Market size statements
  if (/(?:market size|industry size|total addressable market|tam|worth \$\d+\s*(?:billion|million))/i.test(text)) {
    return {
      isHighStakes: true,
      category: 'market-data',
      reason: 'Market sizing claim',
    };
  }

  // Percentage claims (statistics)
  if (/\b\d{1,3}%\s*(?:of|report|experience|see|achieve)/i.test(text)) {
    return {
      isHighStakes: true,
      category: 'statistic',
      reason: 'Statistical claim',
    };
  }

  return {
    isHighStakes: false,
    category: null,
    reason: '',
  };
}

// ─── VERIFICATION PROMPT BUILDER ────────────────────────────────

/**
 * When a high-stakes claim is detected in Claude's response, build a prompt
 * that either verifies via web search or softens to estimate-language.
 */
export function buildVerificationGuidance(claim: string): string {
  const assessment = isHighStakesClaim(claim);
  if (!assessment.isHighStakes) return '';

  return `The response contains a ${assessment.category} claim: "${claim.slice(0, 100)}..."

This should either:
1. Be verified via web_search before stating as fact, OR
2. Be softened with natural uncertainty language: "from what I've seen", "last I checked", "roughly", "I'd estimate"

Do NOT state specific numbers about ${assessment.category} as confident present-tense fact without either search evidence or uncertainty language.`;
}

// ─── RESPONSE AUDIT — Before sending to user ────────────────────

/**
 * Scan a Claude response for unverified high-stakes claims.
 * If found, returns a revised version that softens the claims.
 */
export function auditResponseForUnverifiedClaims(
  response: string,
  didWebSearch: boolean
): {
  issues: Array<{ claim: string; category: string }>;
  needsRevision: boolean;
  suggestedNote?: string;
} {
  const issues: Array<{ claim: string; category: string }> = [];
  
  // Don't scan if web search was done — trust the response
  if (didWebSearch) {
    return { issues: [], needsRevision: false };
  }

  // Split into sentences and check each
  const sentences = response.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    // Skip sentences that already have hedging language
    const hasHedge = /\b(?:roughly|around|estimate|typically|usually|from what I've seen|in my experience|last I checked|approximately|ballpark|rough)\b/i.test(sentence);
    if (hasHedge) continue;

    const assessment = isHighStakesClaim(sentence);
    if (assessment.isHighStakes && assessment.category) {
      issues.push({ claim: sentence.slice(0, 150), category: assessment.category });
    }
  }

  const needsRevision = issues.length > 0;
  
  let suggestedNote: string | undefined;
  if (needsRevision && issues.length >= 2) {
    suggestedNote = "\n\n*Quick note: some of the specific numbers above are my best knowledge — if you're making decisions based on them, quick web check to verify would be smart.*";
  } else if (needsRevision) {
    suggestedNote = "\n\n*Worth noting: that specific figure is from my general knowledge, not a live check. Worth verifying before relying on it.*";
  }

  return {
    issues,
    needsRevision,
    suggestedNote,
  };
}

// ─── HARDCODED BENCHMARK WARNINGS ────────────────────────────────

/**
 * The systemPrompt.ts pricing module has hardcoded benchmarks like
 * "Video editing: $300-1,500/video." These need to be presented as
 * ranges with "this is an estimate, market rates vary" framing.
 * 
 * Export these so the system prompt and pricing logic can reference them
 * with built-in uncertainty language instead of stating as fact.
 */
export const PRICING_BENCHMARKS = {
  source: 'Derived from common freelancer patterns — these are estimates, not verified market data',
  lastUpdated: '2025-04',
  staleness: 'aging', // We acknowledge these get stale
  benchmarks: {
    'video-editing': { range: '$300-1,500 per video', dependsOn: 'complexity and turnaround' },
    'design-brand': { range: '$2,000-10,000 per project', dependsOn: 'scope and timeline' },
    'design-logo': { range: '$500+', dependsOn: 'alone or as part of system' },
    'writing-copy': { range: '$500-5,000 per project', dependsOn: 'length and research required' },
    'writing-email-sequence': { range: '$1,000-3,000', dependsOn: 'sequence length' },
    'writing-landing-page': { range: '$500-2,000', dependsOn: 'research and iteration' },
    'social-media-management': { range: '$1,500-5,000/month retainer', dependsOn: 'platform count and post frequency' },
    'content-creation': { range: '$2,000-4,000/month', dependsOn: 'volume and type' },
    'virtual-assistance-hourly': { range: '$25-75/hour', dependsOn: 'skill level' },
    'virtual-assistance-retainer': { range: '$2,000-5,000/month', dependsOn: 'hours per week' },
    'coaching-hourly': { range: '$150-500/hour', dependsOn: 'niche and experience' },
    'coaching-package': { range: '$1,000-5,000/month packages', dependsOn: 'duration and support level' },
    'consulting-hourly': { range: '$200-750/hour', dependsOn: 'seniority and niche' },
    'consulting-engagement': { range: '$3,000-15,000 per engagement', dependsOn: 'scope' },
    'agency-small': { range: '2-3x individual rates', dependsOn: 'team size and positioning' },
  },
} as const;

/**
 * Format benchmark for display with proper uncertainty framing.
 */
export function formatBenchmarkWithUncertainty(serviceType: string): string | null {
  const benchmark = (PRICING_BENCHMARKS.benchmarks as any)[serviceType];
  if (!benchmark) return null;
  
  return `Freelancers in this space typically charge around ${benchmark.range} — though this depends on ${benchmark.dependsOn}. These are rough benchmarks from common patterns, not verified live market data. Worth web-searching for current specifics if you're setting prices.`;
}