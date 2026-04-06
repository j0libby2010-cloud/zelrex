/**
 * ZELREX DATA COLLECTOR
 * 
 * Collects business intelligence at key events.
 * Aggregates anonymized insights per niche.
 * Injects relevant insights into the system prompt.
 * 
 * PRIVACY:
 *   - Raw data is NEVER exposed to any user
 *   - Only anonymized, aggregated statistics are surfaced
 *   - Users who opt out are excluded from aggregation
 *   - Minimum sample size of 5 before insights are surfaced
 * 
 * Usage:
 *   import { collectDataPoint, getInsightsForPrompt, aggregateInsights } from '@/lib/dataCollector';
 *   
 *   // After a key event:
 *   await collectDataPoint(supabase, userId, 'website_build', 'design', { template: 'studio', tiers_count: 2 });
 *   
 *   // When building the system prompt:
 *   const insights = await getInsightsForPrompt(supabase, 'design');
 */

import { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────

export type EventType =
  | "market_eval"
  | "website_build"
  | "milestone"
  | "check_in"
  | "revenue_report"
  | "client_acquired"
  | "goal_set"
  | "goal_achieved";

export type Niche =
  | "video_editing"
  | "design"
  | "writing"
  | "social_media"
  | "virtual_assistance"
  | "coaching"
  | "consulting"
  | "agency";

// Map user-facing niche names to normalized keys
const NICHE_MAP: Record<string, Niche> = {
  "video editing": "video_editing",
  "video editor": "video_editing",
  "video production": "video_editing",
  "design": "design",
  "graphic design": "design",
  "brand identity": "design",
  "ui/ux": "design",
  "web design": "design",
  "writing": "writing",
  "copywriting": "writing",
  "content writing": "writing",
  "ghostwriting": "writing",
  "social media": "social_media",
  "social media management": "social_media",
  "virtual assistance": "virtual_assistance",
  "virtual assistant": "virtual_assistance",
  "coaching": "coaching",
  "business coaching": "coaching",
  "life coaching": "coaching",
  "consulting": "consulting",
  "strategy consulting": "consulting",
  "agency": "agency",
};

export function normalizeNiche(raw: string): Niche | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  // Direct match
  if (NICHE_MAP[lower]) return NICHE_MAP[lower];
  // Partial match
  for (const [key, val] of Object.entries(NICHE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

// ─── Collect a data point ─────────────────────────────

export async function collectDataPoint(
  supabase: SupabaseClient,
  userId: string,
  eventType: EventType,
  niche: string | null,
  data: Record<string, any>,
  subNiche?: string,
  optedOut?: boolean
): Promise<void> {
  try {
    const normalizedNiche = niche ? normalizeNiche(niche) : null;
    
    const { error } = await supabase.from("zelrex_data_points").insert({
      user_id: userId,
      event_type: eventType,
      niche: normalizedNiche,
      sub_niche: subNiche || null,
      data,
      opted_out: optedOut || false,
    });

    if (error) {
      console.error("[ZELREX DATA] Insert error:", error.message);
    } else {
      console.log(`[ZELREX DATA] Collected: ${eventType} for ${normalizedNiche || "unknown"}`);
    }
  } catch (e) {
    console.error("[ZELREX DATA] Collection failed (non-blocking):", e);
  }
}


// ─── Extract metrics from conversation messages ──────

export function extractMetricsFromMessages(
  messages: Array<{ role: string; content: string }>
): Record<string, any> {
  const userText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ");

  const metrics: Record<string, any> = {};

  // Revenue
  const revMatch = userText.match(/(?:making|earning|revenue|income|brought? in)\s*(?:about|around|roughly)?\s*\$?([\d,]+)\s*(?:\/|per|a)\s*(month|week|year)/i);
  if (revMatch) {
    const amount = parseInt(revMatch[1].replace(/,/g, ""));
    const period = revMatch[2].toLowerCase();
    metrics.revenue = amount;
    metrics.revenue_period = period;
    metrics.revenue_monthly = period === "year" ? Math.round(amount / 12) : period === "week" ? amount * 4 : amount;
  }

  // Clients
  const clientMatch = userText.match(/(?:have|got|landed|working with|signed)\s*(\d+)\s*(?:clients?|customers?)/i);
  if (clientMatch) metrics.client_count = parseInt(clientMatch[1]);

  // Pricing
  const priceMatch = userText.match(/(?:charg(?:e|ing)|price|rate|fee)\s*(?:is|of|at)?\s*\$?([\d,]+)\s*(?:\/|per|a)?\s*(hour|project|month|retainer)?/i);
  if (priceMatch) {
    metrics.price = parseInt(priceMatch[1].replace(/,/g, ""));
    metrics.price_type = priceMatch[2] || "unknown";
  }

  // Hours per week
  const hoursMatch = userText.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:per|a|\/)\s*week/i);
  if (hoursMatch) metrics.hours_per_week = parseInt(hoursMatch[1]);

  // What's working
  const workingMatch = userText.match(/(?:what(?:'s| is) working|going well|success|landed .* through|got .* from)\s*(?:is|:)?\s*([^.!?]{10,100})/i);
  if (workingMatch) metrics.what_working = workingMatch[1].trim();

  // What's not working
  const notWorkingMatch = userText.match(/(?:not working|struggling|failing|can(?:'t| not) get|no luck|no response|zero)\s*(?:with|on|at|from)?\s*([^.!?]{10,100})/i);
  if (notWorkingMatch) metrics.what_not_working = notWorkingMatch[1].trim();

  // Acquisition channel
  const channels = ["linkedin", "twitter", "instagram", "cold email", "referral", "upwork", "fiverr", "seo", "blog", "youtube", "tiktok", "networking", "word of mouth"];
  for (const ch of channels) {
    if (userText.toLowerCase().includes(ch)) {
      if (!metrics.channels) metrics.channels = [];
      metrics.channels.push(ch);
    }
  }

  return metrics;
}


// ─── Aggregate insights per niche ────────────────────
// Call this periodically (e.g., daily cron, or after every N data points)

export async function aggregateInsights(
  supabase: SupabaseClient,
  niche: Niche
): Promise<void> {
  try {
    // Fetch all non-opted-out data points for this niche
    const { data: points, error } = await supabase
      .from("zelrex_data_points")
      .select("event_type, data")
      .eq("niche", niche)
      .eq("opted_out", false);

    if (error || !points || points.length < 5) {
      console.log(`[ZELREX DATA] Not enough data for ${niche} (${points?.length || 0} points, need 5)`);
      return;
    }

    // Aggregate pricing
    const prices = points
      .filter((p) => p.data?.price || p.data?.avg_price)
      .map((p) => parseInt(String(p.data.price || p.data.avg_price).replace(/[^0-9]/g, "")))
      .filter((p) => p > 0 && p < 100000)
      .sort((a, b) => a - b);

    const pricing = prices.length >= 3 ? {
      median: prices[Math.floor(prices.length / 2)],
      range_low: prices[Math.floor(prices.length * 0.25)],
      range_high: prices[Math.floor(prices.length * 0.75)],
      sample: prices.length,
    } : null;

    // Aggregate revenue
    const revenues = points
      .filter((p) => p.data?.revenue_monthly)
      .map((p) => p.data.revenue_monthly)
      .filter((r: number) => r > 0 && r < 500000)
      .sort((a: number, b: number) => a - b);

    const revenue = revenues.length >= 3 ? {
      median_monthly: revenues[Math.floor(revenues.length / 2)],
      range_low: revenues[Math.floor(revenues.length * 0.25)],
      range_high: revenues[Math.floor(revenues.length * 0.75)],
      sample: revenues.length,
    } : null;

    // Aggregate milestones — time to first client
    const milestones = points.filter((p) => p.event_type === "milestone" && p.data?.stage === 5);
    const daysToClient = milestones
      .map((m) => m.data?.days_since_signup)
      .filter((d: number) => d > 0 && d < 365)
      .sort((a: number, b: number) => a - b);

    const timeToClient = daysToClient.length >= 3 ? {
      median_days: daysToClient[Math.floor(daysToClient.length / 2)],
      range: `${daysToClient[Math.floor(daysToClient.length * 0.25)]}-${daysToClient[Math.floor(daysToClient.length * 0.75)]} days`,
      sample: daysToClient.length,
    } : null;

    // Top acquisition channels
    const channelCounts: Record<string, number> = {};
    points.forEach((p) => {
      if (p.data?.channels) {
        for (const ch of p.data.channels) {
          channelCounts[ch] = (channelCounts[ch] || 0) + 1;
        }
      }
      if (p.data?.channel) {
        channelCounts[p.data.channel] = (channelCounts[p.data.channel] || 0) + 1;
      }
    });
    const topChannels = Object.entries(channelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([ch]) => ch);

    // Common failures and successes
    const failures: Record<string, number> = {};
    const successes: Record<string, number> = {};
    points.forEach((p) => {
      if (p.data?.what_not_working) {
        const key = p.data.what_not_working.toLowerCase().slice(0, 50);
        failures[key] = (failures[key] || 0) + 1;
      }
      if (p.data?.what_working) {
        const key = p.data.what_working.toLowerCase().slice(0, 50);
        successes[key] = (successes[key] || 0) + 1;
      }
    });

    // Market eval scores
    const evalScores = points
      .filter((p) => p.event_type === "market_eval" && p.data?.score)
      .map((p) => p.data.score)
      .filter((s: number) => s > 0 && s <= 10);

    const avgScore = evalScores.length >= 3
      ? Math.round((evalScores.reduce((a: number, b: number) => a + b, 0) / evalScores.length) * 10) / 10
      : null;

    // Goals
    const goals = points.filter((p) => p.event_type === "goal_achieved");
    const goalAchieved = goals.length;
    const goalSet = points.filter((p) => p.event_type === "goal_set").length;

    // Build insights object
    const insights: Record<string, any> = {};
    if (pricing) insights.pricing = pricing;
    if (revenue) insights.revenue = revenue;
    if (timeToClient) insights.time_to_first_client = timeToClient;
    if (topChannels.length > 0) insights.top_acquisition_channels = topChannels;
    if (Object.keys(failures).length > 0) insights.common_failures = Object.keys(failures).sort((a, b) => failures[b] - failures[a]).slice(0, 5);
    if (Object.keys(successes).length > 0) insights.common_successes = Object.keys(successes).sort((a, b) => successes[b] - successes[a]).slice(0, 5);
    if (avgScore) insights.avg_market_eval_score = avgScore;
    if (goalSet > 0) insights.goals = { set: goalSet, achieved: goalAchieved, achievement_rate: Math.round((goalAchieved / goalSet) * 100) / 100 };

    // ─── Pattern Analysis (when enough data) ─────────
    if (points.length >= 10) {
      const foundPatterns = await analyzePatterns(supabase, niche);
      if (foundPatterns.length > 0) {
        insights.patterns = foundPatterns;
        console.log(`[ZELREX DATA] Found ${foundPatterns.length} patterns for ${niche}`);
      }
    }

    // Upsert into niche_insights
    const { error: upsertError } = await supabase
      .from("zelrex_niche_insights")
      .upsert({
        niche,
        sub_niche: null,
        updated_at: new Date().toISOString(),
        sample_size: points.length,
        insights,
      }, { onConflict: "niche,sub_niche" });

    if (upsertError) {
      console.error(`[ZELREX DATA] Upsert insights error for ${niche}:`, upsertError.message);
    } else {
      console.log(`[ZELREX DATA] Aggregated ${niche}: ${points.length} points → insights updated`);
    }
  } catch (e) {
    console.error(`[ZELREX DATA] Aggregation failed for ${niche}:`, e);
  }
}


// ─── Get insights formatted for system prompt injection ──

// ═══════════════════════════════════════════════════════════════
// OUTCOME TRACKING — Link advice → results over time
// ═══════════════════════════════════════════════════════════════

export async function trackOutcome(
  supabase: SupabaseClient,
  userId: string,
  eventType: "outcome_30d" | "outcome_60d" | "outcome_90d",
  niche: string | null,
  data: {
    launched?: boolean;
    revenue?: number;
    customers?: number;
    status?: "growing" | "stalled" | "abandoned" | "pivoted";
    what_worked?: string;
    what_failed?: string;
    original_advice_followed?: boolean;
  }
): Promise<void> {
  await collectDataPoint(supabase, userId, eventType as any, niche, data);
}


// ═══════════════════════════════════════════════════════════════
// PATTERN INTELLIGENCE — Find causal correlations in user data
// ═══════════════════════════════════════════════════════════════

export interface PatternInsight {
  pattern: string;
  confidence: number;
  sample_size: number;
  success_rate: number;
  applies_when: string;
}

export async function analyzePatterns(
  supabase: SupabaseClient,
  niche: Niche
): Promise<PatternInsight[]> {
  const patterns: PatternInsight[] = [];
  try {
    const { data: points } = await supabase
      .from("zelrex_data_points")
      .select("user_id, event_type, data, created_at")
      .eq("niche", niche)
      .eq("opted_out", false)
      .order("created_at", { ascending: true });

    if (!points || points.length < 10) return patterns;

    // Group by user to track journeys
    const userJourneys: Record<string, Array<{ event: string; data: any; date: string }>> = {};
    for (const p of points) {
      if (!userJourneys[p.user_id]) userJourneys[p.user_id] = [];
      userJourneys[p.user_id].push({ event: p.event_type, data: p.data, date: p.created_at });
    }
    const userIds = Object.keys(userJourneys);
    if (userIds.length < 5) return patterns;

    // Pattern: Pricing vs Success
    const pricingOutcomes: Array<{ price: number; succeeded: boolean }> = [];
    for (const uid of userIds) {
      const j = userJourneys[uid];
      const pricePoint = j.find(e => e.data?.price);
      const outcome = j.find(e => e.event.startsWith("outcome") || e.event === "client_acquired");
      if (pricePoint?.data?.price && outcome) {
        const price = parseInt(String(pricePoint.data.price).replace(/[^0-9]/g, ""));
        const succeeded = outcome.data?.status === "growing" || !!outcome.data?.revenue || outcome.event === "client_acquired";
        if (price > 0) pricingOutcomes.push({ price, succeeded });
      }
    }
    if (pricingOutcomes.length >= 5) {
      const sorted = pricingOutcomes.map(p => p.price).sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const above = pricingOutcomes.filter(p => p.price >= med);
      const below = pricingOutcomes.filter(p => p.price < med);
      const aRate = above.filter(p => p.succeeded).length / (above.length || 1);
      const bRate = below.filter(p => p.succeeded).length / (below.length || 1);
      if (aRate > bRate + 0.15) {
        patterns.push({ pattern: `Freelancers pricing above $${med} succeed ${Math.round(aRate * 100)}% vs ${Math.round(bRate * 100)}% below`, confidence: Math.min(0.9, pricingOutcomes.length / 30), sample_size: pricingOutcomes.length, success_rate: aRate, applies_when: "pricing decisions" });
      }
    }

    // Pattern: Channel effectiveness
    const channelOutcomes: Record<string, { total: number; succeeded: number }> = {};
    for (const uid of userIds) {
      const j = userJourneys[uid];
      const channels = j.flatMap(e => e.data?.channels || (e.data?.channel ? [e.data.channel] : []));
      const succeeded = j.some(e => e.event === "client_acquired" || e.data?.status === "growing");
      for (const ch of [...new Set(channels)]) {
        if (!channelOutcomes[ch]) channelOutcomes[ch] = { total: 0, succeeded: 0 };
        channelOutcomes[ch].total++;
        if (succeeded) channelOutcomes[ch].succeeded++;
      }
    }
    for (const [ch, stats] of Object.entries(channelOutcomes)) {
      if (stats.total >= 5) {
        const rate = stats.succeeded / stats.total;
        patterns.push({ pattern: `${ch} has ${Math.round(rate * 100)}% success rate for ${niche.replace(/_/g, " ")}`, confidence: Math.min(0.85, stats.total / 20), sample_size: stats.total, success_rate: rate, applies_when: "choosing acquisition channels" });
      }
    }

    // Pattern: Time to first client
    const timelines: number[] = [];
    for (const uid of userIds) {
      const j = userJourneys[uid];
      const signup = j[0]?.date;
      const first = j.find(e => e.event === "client_acquired" || (e.event === "milestone" && e.data?.stage >= 5));
      if (signup && first) {
        const days = Math.round((new Date(first.date).getTime() - new Date(signup).getTime()) / (1000 * 60 * 60 * 24));
        if (days > 0 && days < 365) timelines.push(days);
      }
    }
    if (timelines.length >= 5) {
      timelines.sort((a, b) => a - b);
      const med = timelines[Math.floor(timelines.length / 2)];
      patterns.push({ pattern: `First client in median ${med} days (range: ${timelines[Math.floor(timelines.length * 0.25)]}-${timelines[Math.floor(timelines.length * 0.75)]})`, confidence: Math.min(0.9, timelines.length / 20), sample_size: timelines.length, success_rate: 1, applies_when: "setting timeline expectations" });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  } catch (e) {
    console.error("[ZELREX DATA] Pattern analysis failed:", e);
    return [];
  }
}


// ═══════════════════════════════════════════════════════════════
// ENHANCED PROMPT INJECTION — with discovered patterns
// ═══════════════════════════════════════════════════════════════

export async function getInsightsForPrompt(
  supabase: SupabaseClient,
  niche: string | null
): Promise<string> {
  if (!niche) return "";
  const normalizedNiche = normalizeNiche(niche);
  if (!normalizedNiche) return "";

  try {
    const { data, error } = await supabase
      .from("zelrex_niche_insights")
      .select("insights, sample_size, updated_at")
      .eq("niche", normalizedNiche)
      .is("sub_niche", null)
      .single();

    if (error || !data || data.sample_size < 5) return "";

    const ins = data.insights;
    const parts: string[] = [];

    parts.push(`\n\nZELREX INTELLIGENCE — ${normalizedNiche.replace(/_/g, " ")} (${data.sample_size} data points from real Zelrex users, updated ${new Date(data.updated_at).toLocaleDateString()}):`);
    parts.push(`This is PROPRIETARY data from real Zelrex user outcomes. More reliable than generic AI estimates. Use [PATTERN] tags when referencing.`);

    if (ins.pricing) parts.push(`  PRICING: $${ins.pricing.range_low}-${ins.pricing.range_high}/project (median $${ins.pricing.median}, n=${ins.pricing.sample})`);
    if (ins.revenue) parts.push(`  REVENUE: Median $${ins.revenue.median_monthly}/mo (range $${ins.revenue.range_low}-${ins.revenue.range_high}, n=${ins.revenue.sample})`);
    if (ins.time_to_first_client) parts.push(`  FIRST CLIENT: Median ${ins.time_to_first_client.median_days} days (${ins.time_to_first_client.range}, n=${ins.time_to_first_client.sample})`);
    if (ins.top_acquisition_channels?.length) parts.push(`  TOP CHANNELS: ${ins.top_acquisition_channels.join(", ")}`);
    if (ins.common_successes?.length) parts.push(`  WHAT WORKS: ${ins.common_successes.slice(0, 3).join("; ")}`);
    if (ins.common_failures?.length) parts.push(`  COMMON MISTAKES: ${ins.common_failures.slice(0, 3).join("; ")}`);
    if (ins.goals) parts.push(`  GOALS: ${Math.round(ins.goals.achievement_rate * 100)}% achievement rate (${ins.goals.achieved}/${ins.goals.set})`);

    if (ins.patterns?.length) {
      parts.push(`  DISCOVERED PATTERNS:`);
      for (const p of ins.patterns.slice(0, 5)) {
        parts.push(`    • ${p.pattern} (confidence: ${Math.round(p.confidence * 100)}%, n=${p.sample_size})`);
        parts.push(`      Use when: ${p.applies_when}`);
      }
    }

    parts.push(`  Say "Based on data from ${data.sample_size} Zelrex users in ${normalizedNiche.replace(/_/g, " ")}..." with [PATTERN] tag.`);
    parts.push(`  NEVER reveal individual user data or say "one of our users did X".`);

    return parts.join("\n");
  } catch (e) {
    console.error("[ZELREX DATA] Insights fetch failed:", e);
    return "";
  }
}


// ─── Trigger aggregation after collecting enough data ──

export async function maybeAggregate(
  supabase: SupabaseClient,
  niche: string | null
): Promise<void> {
  if (!niche) return;
  const normalizedNiche = normalizeNiche(niche);
  if (!normalizedNiche) return;

  try {
    // Count data points for this niche
    const { count } = await supabase
      .from("zelrex_data_points")
      .select("id", { count: "exact", head: true })
      .eq("niche", normalizedNiche)
      .eq("opted_out", false);

    // Only aggregate if we have enough data AND it's a round number (every 5 new points)
    if (count && count >= 5 && count % 5 === 0) {
      console.log(`[ZELREX DATA] Triggering aggregation for ${normalizedNiche} (${count} points)`);
      await aggregateInsights(supabase, normalizedNiche);
    }
  } catch (e) {
    console.warn("[ZELREX DATA] maybeAggregate check failed:", e);
  }
}