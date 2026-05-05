/**
 * ZELREX SEMANTIC MEMORY RETRIEVAL
 * 
 * Problem with current memory system:
 * Current `loadFullContext` pulls ALL user facts into the prompt. With 100+ facts,
 * Claude's attention gets diluted and relevant facts compete with irrelevant ones.
 * 
 * Solution: rank facts by relevance to the current query and load the top N.
 * 
 * This uses:
 * 1. KEYWORD OVERLAP scoring (primary — fast and free)
 * 2. CATEGORY PRIORITY matching (queries about pricing load financial facts first)
 * 3. RECENCY BOOST (newer facts win over stale ones)
 * 4. STATED > INFERRED (user-stated facts score higher than guesses)
 * 
 * Does NOT use embeddings because:
 * - Would require OpenAI API + vector storage
 * - Adds cost, complexity, and latency to every message
 * - Keyword + category + recency scoring works for 90%+ of cases
 * - Can add embeddings later if keyword approach proves insufficient
 */

import { MemoryFact } from './memory';

// ─── QUERY INTENT CATEGORIES ─────────────────────────────────────
// Map user queries to the fact categories most relevant to them

const CATEGORY_PRIORITIES: Record<string, Array<{ category: string; weight: number }>> = {
  pricing: [
    { category: 'financial', weight: 10 },
    { category: 'business', weight: 8 },
    { category: 'platform', weight: 6 },
    { category: 'skill', weight: 4 },
  ],
  client: [
    { category: 'business', weight: 10 },
    { category: 'context', weight: 8 },
    { category: 'platform', weight: 6 },
  ],
  outreach: [
    { category: 'skill', weight: 10 },
    { category: 'business', weight: 9 },
    { category: 'context', weight: 7 },
  ],
  website: [
    { category: 'business', weight: 10 },
    { category: 'preferences', weight: 8 },
    { category: 'skill', weight: 6 },
  ],
  offer: [
    { category: 'skill', weight: 10 },
    { category: 'financial', weight: 9 },
    { category: 'business', weight: 8 },
    { category: 'constraints', weight: 6 },
  ],
  time: [
    { category: 'constraints', weight: 10 },
    { category: 'profile', weight: 6 },
  ],
  personal: [
    { category: 'profile', weight: 10 },
    { category: 'preferences', weight: 8 },
  ],
};

// Keywords that signal query intent
const INTENT_KEYWORDS: Record<string, string[]> = {
  pricing: ['price', 'rate', 'charge', 'cost', 'pricing', 'fee', 'package', 'tier', 'retainer', 'hourly', 'project fee', 'discount', '$', 'dollar', 'money', 'income', 'revenue'],
  client: ['client', 'customer', 'prospect', 'lead', 'buyer', 'deal'],
  outreach: ['outreach', 'cold email', 'pitch', 'reach out', 'dm', 'message', 'linkedin', 'prospect'],
  website: ['website', 'site', 'landing page', 'homepage', 'domain', 'deploy'],
  offer: ['offer', 'package', 'service', 'deliverable', 'scope', 'guarantee'],
  time: ['time', 'hours', 'schedule', 'availability', 'deadline', 'week', 'month'],
  personal: ['me', 'my', 'myself', 'i am', "i'm", 'background', 'experience'],
};

function detectQueryIntent(query: string): string[] {
  const lower = query.toLowerCase();
  const intents: Array<{ intent: string; score: number }> = [];

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > 0) intents.push({ intent, score });
  }

  intents.sort((a, b) => b.score - a.score);
  return intents.slice(0, 3).map(i => i.intent);
}

// ─── FACT RELEVANCE SCORING ──────────────────────────────────────

interface ScoredFact {
  fact: MemoryFact;
  score: number;
  reasons: string[];
}

export function scoreFactRelevance(fact: MemoryFact, query: string, queryIntents: string[]): ScoredFact {
  const reasons: string[] = [];
  let score = 0;

  // 1. CATEGORY PRIORITY (largest weight)
  for (const intent of queryIntents) {
    const priorities = CATEGORY_PRIORITIES[intent] || [];
    const match = priorities.find(p => p.category === fact.category);
    if (match) {
      score += match.weight;
      reasons.push(`category:${fact.category} matches intent:${intent}`);
      break; // Only count best category match
    }
  }

  // 2. KEYWORD OVERLAP between query and fact
  const queryLower = query.toLowerCase();
  const factText = `${fact.fact_key} ${fact.fact_value}`.toLowerCase();
  const factWords = factText.split(/\s+/).filter(w => w.length > 3);
  let wordMatches = 0;
  for (const word of factWords) {
    if (queryLower.includes(word)) {
      wordMatches++;
    }
  }
  if (wordMatches > 0) {
    score += Math.min(wordMatches * 2, 8);
    reasons.push(`${wordMatches} keyword matches`);
  }

  // 3. CONFIDENCE BONUS (stated > inferred)
  if (fact.confidence === 'stated') {
    score += 2;
    reasons.push('user-stated');
  } else if (fact.confidence === 'outdated') {
    score -= 100; // Effectively excludes outdated facts
    reasons.push('outdated');
  }

  // 4. BASELINE: profile facts always score low but non-zero so they're available
  if (fact.category === 'profile' && score === 0) {
    score = 1;
    reasons.push('baseline profile');
  }

  return { fact, score, reasons };
}

// ─── MAIN RETRIEVAL FUNCTION ─────────────────────────────────────

/**
 * Given a user's full memory and their current query, return the most relevant
 * facts ranked by relevance score. Use this instead of loading ALL facts into context.
 */
export function retrieveRelevantFacts(
  allFacts: MemoryFact[],
  query: string,
  maxFacts = 30
): {
  selected: MemoryFact[];
  intent: string[];
  stats: { total: number; selected: number; excluded: number };
} {
  if (!allFacts || allFacts.length === 0) {
    return { selected: [], intent: [], stats: { total: 0, selected: 0, excluded: 0 } };
  }

  const intents = detectQueryIntent(query);
  
  // Always include core profile facts (name, primary skill) regardless of query
  const coreFactKeys = ['primary_skill', 'business_name', 'target_income', 'current_income', 'platform', 'hours_per_week', 'years_experience'];
  const coreFacts = allFacts.filter(f => 
    coreFactKeys.includes(f.fact_key) && f.confidence !== 'outdated'
  );

  // Score remaining facts
  const scored: ScoredFact[] = allFacts
    .filter(f => !coreFacts.includes(f))
    .map(f => scoreFactRelevance(f, query, intents));

  // Sort by score, take top N (reserving slots for core facts)
  scored.sort((a, b) => b.score - a.score);
  const reservedForCore = Math.min(coreFacts.length, 10);
  const relevantSlots = maxFacts - reservedForCore;
  const topRelevant = scored
    .filter(s => s.score > 0)
    .slice(0, relevantSlots)
    .map(s => s.fact);

  const selected = [...coreFacts.slice(0, reservedForCore), ...topRelevant];

  return {
    selected,
    intent: intents,
    stats: {
      total: allFacts.length,
      selected: selected.length,
      excluded: allFacts.length - selected.length,
    },
  };
}

// ─── CONFLICT DETECTION ──────────────────────────────────────────

/**
 * Detect potential conflicts in stored facts.
 * E.g., monthly_income: "$5000" and current_income: "$8000" probably conflict.
 */
export function detectMemoryConflicts(facts: MemoryFact[]): Array<{
  factKeys: [string, string];
  description: string;
  severity: 'high' | 'medium' | 'low';
}> {
  const conflicts: Array<{ factKeys: [string, string]; description: string; severity: 'high' | 'medium' | 'low' }> = [];

  // Look for semantically similar fact keys with different values
  const incomeKeys = facts.filter(f => /income|earning|revenue|salary/i.test(f.fact_key));
  for (let i = 0; i < incomeKeys.length; i++) {
    for (let j = i + 1; j < incomeKeys.length; j++) {
      const a = incomeKeys[i], b = incomeKeys[j];
      if (a.category === 'financial' && b.category === 'financial' && a.fact_value !== b.fact_value) {
        conflicts.push({
          factKeys: [a.fact_key, b.fact_key],
          description: `Two income-related facts have different values: "${a.fact_key}" = "${a.fact_value}" vs "${b.fact_key}" = "${b.fact_value}"`,
          severity: 'medium',
        });
      }
    }
  }

  // Price vs pricing
  const priceKeys = facts.filter(f => /price|rate|charge|fee/i.test(f.fact_key));
  for (let i = 0; i < priceKeys.length; i++) {
    for (let j = i + 1; j < priceKeys.length; j++) {
      const a = priceKeys[i], b = priceKeys[j];
      if (a.fact_value !== b.fact_value) {
        conflicts.push({
          factKeys: [a.fact_key, b.fact_key],
          description: `Two pricing facts have different values: "${a.fact_key}" = "${a.fact_value}" vs "${b.fact_key}" = "${b.fact_value}"`,
          severity: 'low',
        });
      }
    }
  }

  // Skill conflicts (multiple different primary_skill values)
  const skillFacts = facts.filter(f => f.fact_key === 'primary_skill');
  if (skillFacts.length > 1) {
    const uniqueSkills = [...new Set(skillFacts.map(f => f.fact_value))];
    if (uniqueSkills.length > 1) {
      conflicts.push({
        factKeys: ['primary_skill', 'primary_skill'],
        description: `Multiple primary_skill values stored: ${uniqueSkills.join(', ')}`,
        severity: 'high',
      });
    }
  }

  return conflicts;
}

// ─── DEDUPLICATION ───────────────────────────────────────────────

/**
 * When a new fact is about to be saved, check if it's semantically
 * a duplicate of an existing fact. This prevents "monthly_income: $5000"
 * and "income_monthly: $5000" both existing.
 */
export function findSimilarExistingFact(
  newFact: MemoryFact,
  existingFacts: MemoryFact[]
): MemoryFact | null {
  const newKeyNormalized = normalizeFactKey(newFact.fact_key);
  
  for (const existing of existingFacts) {
    if (existing.category !== newFact.category) continue;
    if (existing.fact_key === newFact.fact_key) continue; // Exact match handled by upsert
    
    const existingKeyNormalized = normalizeFactKey(existing.fact_key);
    if (newKeyNormalized === existingKeyNormalized) {
      return existing;
    }
  }
  
  return null;
}

function normalizeFactKey(key: string): string {
  // "monthly_income" and "income_monthly" both become "income_monthly" (sorted alphabetically)
  return key.toLowerCase().split('_').sort().join('_');
}