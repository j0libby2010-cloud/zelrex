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

  private async getMemory(userId: string): Promise<MemoryFact[]> {
    const { data, error } = await this.supabase
      .from('user_memory')
      .select('category, fact_key, fact_value, confidence')
      .eq('user_id', userId)
      .neq('confidence', 'outdated')
      .order('category');
    if (error) { console.error('[Memory]', error); return []; }
    return data || [];
  }

  private async getMilestones(userId: string): Promise<Milestone[]> {
    const { data, error } = await this.supabase
      .from('user_milestones')
      .select('stage, stage_name, reached_at, evidence')
      .eq('user_id', userId)
      .order('stage');
    if (error) { console.error('[Memory]', error); return []; }
    return data || [];
  }

  private async getActiveCommitments(userId: string): Promise<Commitment[]> {
    const { data, error } = await this.supabase
      .from('user_commitments')
      .select('id, commitment, due_date, status, outcome_note, week_number')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('due_date');
    if (error) { console.error('[Memory]', error); return []; }
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
    if (error) { console.error('[Memory]', error); return []; }
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
    if (error && error.code !== 'PGRST116') console.error('[Memory]', error);
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
    if (error && error.code !== 'PGRST116') console.error('[Memory]', error);
    return data || null;
  }

  // --- WRITE METHODS (called by route.ts when Claude uses tools) ---

  async setFacts(userId: string, facts: MemoryFact[], chatId?: string) {
    if (!facts.length) return;
    const rows = facts.map(f => ({
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
    if (error) console.error('[Memory] setFacts:', error);
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
    if (error) { console.error('[Memory] milestone:', error); return false; }

    // Track milestone reached
    collectDataPoint(this.supabase, userId, 'milestone', null, {
      stage,
      stage_name: stageName,
    }).catch(() => {});

    return true;
  }

  async createCommitments(userId: string, commitments: string[], weekNumber: number, chatId?: string) {
    const due = new Date();
    due.setDate(due.getDate() + 7);
    const rows = commitments.map(c => ({
      user_id: userId,
      commitment: c,
      due_date: due.toISOString(),
      status: 'active',
      week_number: weekNumber,
      source_chat_id: chatId || null,
    }));
    const { error } = await this.supabase.from('user_commitments').insert(rows);
    if (error) console.error('[Memory] commitments:', error);
  }

  async resolveCommitment(id: string, status: 'completed' | 'missed' | 'adjusted', note: string, chatId?: string) {
    const { error } = await this.supabase
      .from('user_commitments')
      .update({ status, outcome_note: note, resolved_at: new Date().toISOString(), resolved_chat_id: chatId || null })
      .eq('id', id);
    if (error) console.error('[Memory] resolve:', error);
  }

  async saveOffer(userId: string, offer: Omit<Offer, 'version'>, chatId?: string) {
    // Deactivate old offer
    await this.supabase.from('user_offers').update({ is_active: false }).eq('user_id', userId).eq('is_active', true);
    // Get next version
    const { data: ex } = await this.supabase.from('user_offers').select('version').eq('user_id', userId).order('version', { ascending: false }).limit(1);
    const v = ex?.length ? ex[0].version + 1 : 1;
    // Insert new offer
    const { error } = await this.supabase.from('user_offers').insert({
      user_id: userId, ...offer, version: v, is_active: true, source_chat_id: chatId || null,
    });
    if (error) console.error('[Memory] offer:', error);
  }

  // --- PROGRESS BAR (called by /api/progress) ---

  async getProgressData(userId: string) {
    const reached = await this.getMilestones(userId);
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