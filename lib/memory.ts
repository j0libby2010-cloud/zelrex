/**
 * ZELREX MEMORY SERVICE — FIXED VERSION
 *
 * Critical fixes from previous version:
 * 1. SETFACTS no longer leaves duplicate facts with similar keys — normalizes + auto-outdates conflicts
 * 2. GETMEMORY now supports relevance-based retrieval to prevent attention dilution
 * 3. COLLECTDATAPOINT failures now log instead of swallowing silently
 * 4. CREATECOMMITMENTS now dedupes against existing active commitments
 * 5. GETPROGRESSDATA refactored to accept already-loaded milestones (avoid duplicate query)
 * 6. NEW markOutdated() method for explicit fact lifecycle management
 * 7. NEW getRelevantMemory() for semantic retrieval based on current query
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { collectDataPoint, maybeAggregate } from '@/lib/dataCollector';

export interface MemoryFact {
  category: string;
  fact_key: string;
  fact_value: string;
  confidence: 'stated' | 'inferred' | 'outdated';
}

export interface Milestone {
  stage: number;
  stage_name: string;
  reached_at: string;
  evidence: string;
}

export interface Commitment {
  id: string;
  commitment: string;
  due_date: string;
  status: 'active' | 'completed' | 'missed' | 'adjusted';
  outcome_note?: string;
  week_number: number;
}

export interface Offer {
  offer_name: string;
  target_audience: string;
  included: string;
  not_included: string;
  pricing_tiers: Array<{ tier: string; price: string; description: string }>;
  guarantee?: string;
  scarcity?: string;
  cta: string;
  turnaround: string;
  version: number;
}

export interface UserContext {
  memory: MemoryFact[];
  milestones: Milestone[];
  activeCommitments: Commitment[];
  pastCommitments: Commitment[];
  currentOffer: Offer | null;
  lastEvaluation: any | null;
  progressStage: number;
}

export const MILESTONE_NAMES: Record<number, string> = {
  1: 'Intake completed',
  2: 'Market evaluation done',
  3: 'Offer designed',
  4: 'Website built',
  5: 'First outreach sent',
  6: 'First response received',
  7: 'First client conversation',
  8: 'First paying client',
  9: 'First $1,000 month',
  10: 'First $5,000 month',
};

// ─── KEY NORMALIZATION (FIX #1) ────────────────────────
// Detect semantically similar fact keys so "monthly_income" and "income_per_month"
// don't both exist with different values.

const KEY_ALIASES: Record<string, string> = {
  // Income synonyms — all normalize to "monthly_income"
  'monthly_income': 'monthly_income',
  'income_per_month': 'monthly_income',
  'income_monthly': 'monthly_income',
  'current_income': 'monthly_income',
  'monthly_revenue': 'monthly_income',
  'revenue_monthly': 'monthly_income',
  'current_revenue': 'monthly_income',
  
  // Target/goal income
  'target_income': 'target_income',
  'income_goal': 'target_income',
  'income_target': 'target_income',
  'revenue_goal': 'target_income',
  'target_revenue': 'target_income',
  
  // Skill/niche synonyms
  'primary_skill': 'primary_skill',
  'main_skill': 'primary_skill',
  'skill': 'primary_skill',
  'specialty': 'primary_skill',
  'specialization': 'primary_skill',
  'niche': 'primary_skill',
  'main_service': 'primary_skill',
  
  // Hours per week
  'hours_per_week': 'hours_per_week',
  'weekly_hours': 'hours_per_week',
  'work_hours': 'hours_per_week',
  'available_hours': 'hours_per_week',
  
  // Years experience
  'years_experience': 'years_experience',
  'experience_years': 'years_experience',
  'years_in_business': 'years_experience',
  
  // Business name
  'business_name': 'business_name',
  'company_name': 'business_name',
  
  // Platform leaving
  'previous_platform': 'previous_platform',
  'platform_leaving': 'previous_platform',
  'leaving_from': 'previous_platform',
};

function normalizeFactKey(key: string): string {
  if (!key) return key;
  const lower = key.toLowerCase().trim().replace(/\s+/g, '_');
  return KEY_ALIASES[lower] || lower;
}

// ─── MEMORY SERVICE ────────────────────────────────────

export class MemoryService {
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  async loadFullContext(userId: string): Promise<UserContext> {
    const [memory, milestones, activeCommitments, pastCommitments, currentOffer, lastEvaluation] =
      await Promise.all([
        this.getMemory(userId),
        this.getMilestones(userId),
        this.getActiveCommitments(userId),
        this.getRecentPastCommitments(userId),
        this.getActiveOffer(userId),
        this.getLastEvaluation(userId),
      ]);
    const progressStage = milestones.length > 0 ? Math.max(...milestones.map(m => m.stage)) : 0;
    return { memory, milestones, activeCommitments, pastCommitments, currentOffer, lastEvaluation, progressStage };
  }

  // FIX #2: Original getMemory loads everything
  // New: also exposes a relevance-aware variant for the chat route
  private async getMemory(userId: string): Promise<MemoryFact[]> {
    const { data, error } = await this.supabase
      .from('user_memory')
      .select('category, fact_key, fact_value, confidence')
      .eq('user_id', userId)
      .neq('confidence', 'outdated')
      .order('category')
      .limit(150); // Hard cap to prevent runaway growth
    if (error) {
      console.error('[Memory] getMemory error:', error.message);
      return [];
    }
    return data || [];
  }

  /**
   * NEW: Get memory facts ranked by relevance to the current query.
   * Use this in the chat route instead of getMemory() when context space matters.
   *
   * Returns the top N most-relevant facts based on:
   * - Keyword overlap between fact and query
   * - Category priority for the detected query intent
   * - Confidence level (stated > inferred)
   */
  async getRelevantMemory(userId: string, query: string, limit = 30): Promise<MemoryFact[]> {
    const allFacts = await this.getMemory(userId);
    if (allFacts.length === 0) return [];
    if (allFacts.length <= limit) return allFacts;
    
    const lowerQuery = (query || '').toLowerCase();
    const intent = this.detectQueryIntent(lowerQuery);
    
    // Always include core profile facts
    const coreKeys = ['primary_skill', 'business_name', 'target_income', 'monthly_income', 'previous_platform', 'hours_per_week', 'years_experience'];
    const coreFacts = allFacts.filter(f => coreKeys.includes(f.fact_key));
    const remaining = allFacts.filter(f => !coreFacts.includes(f));
    
    // Score each remaining fact
    const scored = remaining.map(fact => ({
      fact,
      score: this.scoreFactRelevance(fact, lowerQuery, intent),
    }));
    
    scored.sort((a, b) => b.score - a.score);
    
    const reservedForCore = Math.min(coreFacts.length, 10);
    const relevantSlots = limit - reservedForCore;
    
    return [
      ...coreFacts.slice(0, reservedForCore),
      ...scored.filter(s => s.score > 0).slice(0, relevantSlots).map(s => s.fact),
    ];
  }

  private detectQueryIntent(lowerQuery: string): string[] {
    const intents: string[] = [];
    if (/price|rate|charge|cost|fee|\$|dollar|money|income|revenue/.test(lowerQuery)) intents.push('financial');
    if (/client|customer|prospect|lead|buyer|deal/.test(lowerQuery)) intents.push('business');
    if (/outreach|cold email|pitch|reach out|dm|message|prospect/.test(lowerQuery)) intents.push('outreach');
    if (/website|site|landing|domain|deploy/.test(lowerQuery)) intents.push('website');
    if (/offer|package|service|deliverable|scope|guarantee/.test(lowerQuery)) intents.push('offer');
    if (/time|hours|schedule|availability|deadline/.test(lowerQuery)) intents.push('time');
    if (/me|my|myself|i am|i'm/.test(lowerQuery)) intents.push('profile');
    return intents;
  }

  private scoreFactRelevance(fact: MemoryFact, lowerQuery: string, intent: string[]): number {
    let score = 0;
    
    // Category priority by intent
    const categoryMatches: Record<string, string[]> = {
      financial: ['financial', 'business', 'platform'],
      business: ['business', 'context', 'platform'],
      outreach: ['skill', 'business', 'context'],
      website: ['business', 'preferences', 'skill'],
      offer: ['skill', 'financial', 'business'],
      time: ['constraints', 'profile'],
      profile: ['profile', 'preferences'],
    };
    
    for (const i of intent) {
      const matches = categoryMatches[i];
      if (matches?.includes(fact.category)) {
        score += 8;
        break;
      }
    }
    
    // Keyword overlap
    const factText = `${fact.fact_key} ${fact.fact_value}`.toLowerCase();
    const factWords = factText.split(/\s+/).filter(w => w.length > 3);
    let matches = 0;
    for (const word of factWords) {
      if (lowerQuery.includes(word)) matches++;
    }
    score += Math.min(matches * 2, 8);
    
    // Confidence bonus
    if (fact.confidence === 'stated') score += 2;
    if (fact.confidence === 'outdated') score -= 100;
    
    // Profile baseline so it's at least available
    if (fact.category === 'profile' && score === 0) score = 1;
    
    return score;
  }

  private async getMilestones(userId: string): Promise<Milestone[]> {
    const { data, error } = await this.supabase
      .from('user_milestones')
      .select('stage, stage_name, reached_at, evidence')
      .eq('user_id', userId)
      .order('stage');
    if (error) {
      console.error('[Memory] getMilestones error:', error.message);
      return [];
    }
    return data || [];
  }

  private async getActiveCommitments(userId: string): Promise<Commitment[]> {
    const { data, error } = await this.supabase
      .from('user_commitments')
      .select('id, commitment, due_date, status, outcome_note, week_number')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('due_date');
    if (error) {
      console.error('[Memory] getActiveCommitments error:', error.message);
      return [];
    }
    return data || [];
  }

  private async getRecentPastCommitments(userId: string): Promise<Commitment[]> {
    const { data, error } = await this.supabase
      .from('user_commitments')
      .select('id, commitment, due_date, status, outcome_note, week_number')
      .eq('user_id', userId)
      .in('status', ['completed', 'missed', 'adjusted'])
      .order('resolved_at', { ascending: false })
      .limit(10);
    if (error) {
      console.error('[Memory] getRecentPastCommitments error:', error.message);
      return [];
    }
    return data || [];
  }

  private async getActiveOffer(userId: string): Promise<Offer | null> {
    const { data, error } = await this.supabase
      .from('user_offers')
      .select('offer_name, target_audience, included, not_included, pricing_tiers, guarantee, scarcity, cta, turnaround, version')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('version', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') console.error('[Memory] getActiveOffer error:', error.message);
    return data || null;
  }

  private async getLastEvaluation(userId: string): Promise<any | null> {
    const { data, error } = await this.supabase
      .from('user_evaluations')
      .select('skill_evaluated, target_audience, income_target, evaluation_result, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') console.error('[Memory] getLastEvaluation error:', error.message);
    return data || null;
  }

  // ─── WRITE METHODS ───────────────────────────────────

  /**
   * FIXED: setFacts now normalizes keys and auto-outdates conflicts.
   * If the user updates "monthly_income" from "$3k" to "$8k", and the old fact was
   * stored as "income_per_month" = "$3k", that old fact gets marked outdated.
   */
  async setFacts(userId: string, facts: MemoryFact[], chatId?: string) {
    if (!facts.length) return;
    
    // Normalize incoming fact keys
    const normalizedFacts = facts.map(f => ({
      ...f,
      fact_key: normalizeFactKey(f.fact_key),
    }));
    
    // Check for existing facts with similar keys but different values
    // and mark them outdated before inserting the new versions
    try {
      const newKeyValues = new Map(normalizedFacts.map(f => [f.fact_key, f.fact_value]));
      const newKeys = Array.from(newKeyValues.keys());
      
      // Find existing facts that match any of the new normalized keys
      const { data: existing } = await this.supabase
        .from('user_memory')
        .select('id, category, fact_key, fact_value')
        .eq('user_id', userId)
        .neq('confidence', 'outdated');
      
      if (existing && existing.length > 0) {
        const toOutdate: string[] = [];
        for (const ex of existing) {
          const exNormalized = normalizeFactKey(ex.fact_key);
          // Same normalized key + different value = outdate the old
          if (newKeyValues.has(exNormalized)) {
            const newValue = newKeyValues.get(exNormalized);
            if (ex.fact_value !== newValue) {
              toOutdate.push(ex.id);
            }
          }
        }
        
        if (toOutdate.length > 0) {
          const { error: outdateErr } = await this.supabase
            .from('user_memory')
            .update({ confidence: 'outdated' })
            .in('id', toOutdate);
          if (outdateErr) {
            console.warn('[Memory] Failed to mark conflicting facts outdated:', outdateErr.message);
          } else {
            console.log(`[Memory] Marked ${toOutdate.length} conflicting facts as outdated`);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Memory] Conflict detection failed (non-blocking):', e?.message);
    }
    
    // Now insert/update the new facts
    const rows = normalizedFacts.map(f => ({
      user_id: userId,
      category: f.category,
      fact_key: f.fact_key,
      fact_value: f.fact_value,
      confidence: f.confidence,
      source_chat_id: chatId || null,
    }));
    
    const { error } = await this.supabase
      .from('user_memory')
      .upsert(rows, { onConflict: 'user_id,category,fact_key' });
    
    if (error) console.error('[Memory] setFacts:', error.message);
  }

  /**
   * NEW: Explicitly mark a fact as outdated.
   * Use when the user explicitly tells Zelrex "actually, that's no longer true."
   */
  async markOutdated(userId: string, factKey: string): Promise<void> {
    const normalized = normalizeFactKey(factKey);
    const { error } = await this.supabase
      .from('user_memory')
      .update({ confidence: 'outdated' })
      .eq('user_id', userId)
      .eq('fact_key', normalized);
    if (error) console.error('[Memory] markOutdated error:', error.message);
  }

  async reachMilestone(userId: string, stage: number, evidence: string, chatId?: string): Promise<boolean> {
    const stageName = MILESTONE_NAMES[stage];
    if (!stageName) return false;
    
    const { error } = await this.supabase
      .from('user_milestones')
      .upsert(
        { user_id: userId, stage, stage_name: stageName, evidence, source_chat_id: chatId || null },
        { onConflict: 'user_id,stage', ignoreDuplicates: true }
      );
    if (error) {
      console.error('[Memory] milestone error:', error.message);
      return false;
    }

    // FIX #3: Log data collection failures instead of swallowing
    collectDataPoint(this.supabase, userId, 'milestone', null, {
      stage,
      stage_name: stageName,
    }).catch(e => {
      console.warn('[Memory] Data collection for milestone failed (non-blocking):', e?.message);
    });

    return true;
  }

  /**
   * FIXED: createCommitments now dedupes against existing active commitments.
   * If Claude tries to create the same commitment twice in one session
   * (because of a tool-call retry or bug), only one ends up in the DB.
   */
  async createCommitments(userId: string, commitments: string[], weekNumber: number, chatId?: string) {
    if (!commitments.length) return;
    
    // Get existing active commitments to dedupe against
    const { data: existing } = await this.supabase
      .from('user_commitments')
      .select('commitment')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    const existingNormalized = new Set(
      (existing || []).map(c => this.normalizeCommitmentText(c.commitment))
    );
    
    // Filter out duplicates from incoming commitments AND duplicates within incoming
    const seen = new Set<string>();
    const uniqueCommitments: string[] = [];
    for (const c of commitments) {
      const normalized = this.normalizeCommitmentText(c);
      if (!normalized) continue;
      if (existingNormalized.has(normalized)) {
        console.log(`[Memory] Skipping duplicate commitment: ${c.slice(0, 50)}`);
        continue;
      }
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      uniqueCommitments.push(c);
    }
    
    if (uniqueCommitments.length === 0) {
      console.log('[Memory] All commitments were duplicates, skipping insert');
      return;
    }
    
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const rows = uniqueCommitments.map(c => ({
      user_id: userId,
      commitment: c,
      due_date: due.toISOString(),
      status: 'active',
      week_number: weekNumber,
      source_chat_id: chatId || null,
    }));
    
    const { error } = await this.supabase.from('user_commitments').insert(rows);
    if (error) console.error('[Memory] commitments error:', error.message);
  }

  /**
   * Normalize commitment text for dedup comparison.
   * "Send 5 cold emails this week" and "send 5 cold emails this week!" should match.
   */
  private normalizeCommitmentText(text: string): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Collapse whitespace
      .trim()
      .slice(0, 100);          // Cap length for comparison
  }

  async resolveCommitment(id: string, status: 'completed' | 'missed' | 'adjusted', note: string, chatId?: string) {
    const { error } = await this.supabase
      .from('user_commitments')
      .update({ status, outcome_note: note, resolved_at: new Date().toISOString(), resolved_chat_id: chatId || null })
      .eq('id', id);
    if (error) console.error('[Memory] resolve error:', error.message);
  }

  async saveOffer(userId: string, offer: Omit<Offer, 'version'>, chatId?: string) {
    // Deactivate old offer
    await this.supabase.from('user_offers').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    
    // Get next version
    const { data: ex } = await this.supabase
      .from('user_offers')
      .select('version')
      .eq('user_id', userId)
      .order('version', { ascending: false })
      .limit(1);
    const v = ex?.length ? ex[0].version + 1 : 1;
    
    // Insert new offer
    const { error } = await this.supabase.from('user_offers').insert({
      user_id: userId,
      ...offer,
      version: v,
      is_active: true,
      source_chat_id: chatId || null,
    });
    if (error) console.error('[Memory] offer error:', error.message);
  }

  // ─── PROGRESS BAR ────────────────────────────────────

  /**
   * FIXED: getProgressData now optionally accepts pre-loaded milestones to avoid duplicate query.
   * If you've already loaded the user's full context, pass in milestones to save a DB roundtrip.
   */
  async getProgressData(userId: string, preloadedMilestones?: Milestone[]) {
    const reached = preloadedMilestones || await this.getMilestones(userId);
    const reachedMap = new Map(reached.map(m => [m.stage, m]));
    
    return {
      currentStage: reached.length > 0 ? Math.max(...reached.map(m => m.stage)) : 0,
      milestones: Object.entries(MILESTONE_NAMES).map(([s, name]) => {
        const stage = parseInt(s);
        const m = reachedMap.get(stage);
        return { stage, name, reached: !!m, reachedAt: m?.reached_at };
      }),
    };
  }
}