/**
 * ZELREX DATA COLLECTOR — FIXED VERSION
 *
 * Critical fixes from previous version:
 * 1. AGGREGATION TRIGGERING — was only firing at exact multiples of 5, now uses tiered intervals + cron-style "is it stale" check
 * 2. METRIC EXTRACTION REGEX — handles "k" notation, "mo"/"yr"/"monthly", multiple sentences, prefers RECENT messages over old
 * 3. SUCCESS CRITERIA — was treating $1 revenue as "succeeded," now uses real thresholds
 * 4. NICHE NORMALIZATION — fixed shadow variable bug where unnormalized niche was stored
 * 5. CHANNEL DETECTION — fixed double-counting of overlapping channel names
 * 6. PROMPT INJECTION — removed [PATTERN] tag instruction (we don't use tags anymore)
 * 7. DATA VALIDATION — caps + schema validation BEFORE storing, not after
 *
 * Privacy:
 * - Raw data is NEVER exposed to any user
 * - Only anonymized, aggregated statistics are surfaced
 * - Users who opt out are excluded from aggregation
 * - Minimum sample size of 5 before insights are surfaced
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
  | "goal_achieved"
  | "outreach_sent"
  | "outreach_replied"
  | "outcome_30d"
  | "outcome_60d"
  | "outcome_90d";

export type Niche =
  | "video_editing"
  | "design"
  | "writing"
  | "social_media"
  | "virtual_assistance"
  | "coaching"
  | "consulting"
  | "agency";

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
  if (NICHE_MAP[lower]) return NICHE_MAP[lower];
  for (const [key, val] of Object.entries(NICHE_MAP)) {
    if (lower.includes(key) || key.includes(lower)) return val;
  }
  return null;
}

// ─── DATA VALIDATION (FIX #7) ──────────────────────────
// Validate and cap incoming data BEFORE storing, not after retrieval

const VALIDATION_CAPS = {
  price: { min: 1, max: 100000 },
  revenue: { min: 0, max: 500000 },
  revenue_monthly: { min: 0, max: 500000 },
  client_count: { min: 0, max: 10000 },
  hours_per_week: { min: 0, max: 168 },
  days_since_signup: { min: 0, max: 1825 }, // 5 years
  score: { min: 0, max: 10 },
  customers: { min: 0, max: 100000 },
  stage: { min: 1, max: 10 },
} as const;

function validateAndSanitizeData(data: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Numeric caps
    if (key in VALIDATION_CAPS) {
      const cap = VALIDATION_CAPS[key as keyof typeof VALIDATION_CAPS];
      const num = typeof value === "number" ? value : parseFloat(String(value).replace(/[^\d.-]/g, ""));
      if (!isNaN(num) && num >= cap.min && num <= cap.max) {
        sanitized[key] = Math.round(num * 100) / 100; // Round to 2 decimals
      }
      // Silently drop invalid values
      continue;
    }
    
    // String fields — cap length to prevent abuse
    if (typeof value === "string") {
      sanitized[key] = value.slice(0, 500);
      continue;
    }
    
    // Arrays — cap length
    if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 20).map(item => 
        typeof item === "string" ? item.slice(0, 200) : item
      );
      continue;
    }
    
    // Booleans pass through
    if (typeof value === "boolean") {
      sanitized[key] = value;
      continue;
    }
    
    // Nested objects — recurse with depth limit
    if (typeof value === "object" && value !== null) {
      // Avoid infinite recursion — only one level deep
      const nested: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === "string") nested[k] = v.slice(0, 200);
        else if (typeof v === "number" && isFinite(v)) nested[k] = v;
        else if (typeof v === "boolean") nested[k] = v;
      }
      sanitized[key] = nested;
    }
  }
  
  return sanitized;
}

// ─── COLLECT DATA POINT ────────────────────────────────

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
    // Validate userId format
    if (!userId || typeof userId !== "string") {
      console.warn("[ZELREX DATA] Invalid userId, skipping");
      return;
    }
    
    // Validate event type
    const validEvents: EventType[] = [
      "market_eval", "website_build", "milestone", "check_in", "revenue_report",
      "client_acquired", "goal_set", "goal_achieved", "outreach_sent", "outreach_replied",
      "outcome_30d", "outcome_60d", "outcome_90d",
    ];
    if (!validEvents.includes(eventType)) {
      console.warn(`[ZELREX DATA] Invalid eventType: ${eventType}`);
      return;
    }
    
    const normalizedNiche = niche ? normalizeNiche(niche) : null;
    const sanitizedData = validateAndSanitizeData(data || {});
    
    const { error } = await supabase.from("zelrex_data_points").insert({
      user_id: userId,
      event_type: eventType,
      niche: normalizedNiche,
      sub_niche: subNiche ? subNiche.slice(0, 100) : null,
      data: sanitizedData,
      opted_out: optedOut || false,
    });

    if (error) {
      console.error("[ZELREX DATA] Insert error:", error.message);
    } else if (process.env.NODE_ENV === "development") {
      console.log(`[ZELREX DATA] Collected: ${eventType} for ${normalizedNiche || "unknown"}`);
    }
  } catch (e: any) {
    console.error("[ZELREX DATA] Collection failed (non-blocking):", e?.message);
  }
}

// ─── EXTRACT METRICS FROM MESSAGES (FIX #2) ──────────
// Now handles k notation, mo/yr/yearly/monthly, prefers RECENT messages

export function extractMetricsFromMessages(
  messages: Array<{ role: string; content: string }>
): Record<string, any> {
  const metrics: Record<string, any> = {};
  
  // Process user messages from MOST RECENT first to LEAST RECENT
  // This way, if the user updated their numbers in a later message, we get the new ones
  const userMessages = messages
    .filter(m => m.role === "user" && typeof m.content === "string")
    .map(m => m.content)
    .reverse(); // Most recent first
  
  for (const text of userMessages) {
    extractMetricsFromText(text, metrics);
  }
  
  return metrics;
}

function extractMetricsFromText(text: string, metrics: Record<string, any>): void {
  const lower = text.toLowerCase();
  
  // ─── REVENUE — handles k notation, mo/yr/monthly/yearly ───
  // Patterns to try (most specific first):
  if (metrics.revenue === undefined) {
    const revPatterns = [
      // "$5k/month", "$5K a month", "5K/mo"
      /(?:making|earning|revenue|income|brought? in|generating|pulling)\s*(?:about|around|roughly|currently)?\s*\$?(\d+(?:\.\d+)?)\s*([kK])\s*(?:\/|per|a)?\s*(month|mo|week|wk|year|yr|annually|monthly|yearly)/i,
      // "$5,000/month", "$5000 a month"
      /(?:making|earning|revenue|income|brought? in|generating|pulling)\s*(?:about|around|roughly|currently)?\s*\$?([\d,]+)\s*(?:\/|per|a)?\s*(month|mo|week|wk|year|yr|annually|monthly|yearly)/i,
      // "I'm at $5000 monthly"
      /(?:i(?:'m| am)?\s*at|currently\s*at)\s*\$?([\d,]+)\s*(?:k)?\s*(month|mo|year|yr|monthly|yearly)?/i,
      // "earn $5000" without period unit (assume monthly)
      /(?:making|earning|revenue|income)\s*\$?([\d,]+)/i,
    ];
    
    for (const pattern of revPatterns) {
      const m = text.match(pattern);
      if (!m) continue;
      
      const rawAmount = m[1].replace(/,/g, "");
      let amount = parseFloat(rawAmount);
      if (isNaN(amount) || amount <= 0) continue;
      
      // K notation
      const hasK = m[0].toLowerCase().includes("k") && !m[0].toLowerCase().includes("week");
      if (hasK) amount *= 1000;
      
      // Period detection
      let period = "month"; // default
      const periodStr = (m[2] || m[3] || "").toLowerCase();
      if (/year|yr|annual/.test(periodStr)) period = "year";
      else if (/week|wk/.test(periodStr)) period = "week";
      else if (/month|mo|monthly/.test(periodStr)) period = "month";
      
      // Sanity bounds
      if (amount > 0 && amount < 10_000_000) {
        metrics.revenue = amount;
        metrics.revenue_period = period;
        metrics.revenue_monthly = period === "year" ? Math.round(amount / 12) : period === "week" ? amount * 4 : amount;
        break;
      }
    }
  }
  
  // ─── CLIENTS ───
  if (metrics.client_count === undefined) {
    const clientMatch = text.match(/(?:have|got|landed|working with|signed|currently with|managing)\s*(\d+)\s*(?:active\s*)?(?:clients?|customers?|accounts?)/i);
    if (clientMatch) {
      const count = parseInt(clientMatch[1]);
      if (count > 0 && count < 10000) metrics.client_count = count;
    }
  }
  
  // ─── PRICING — handles k notation ───
  if (metrics.price === undefined) {
    const pricePatterns = [
      /(?:charg(?:e|ing)|price|rate|fee)\s*(?:is|of|at|around|about)?\s*\$?(\d+(?:\.\d+)?)\s*([kK])\s*(?:\/|per|a)?\s*(hour|hr|project|month|mo|retainer)?/i,
      /(?:charg(?:e|ing)|price|rate|fee)\s*(?:is|of|at|around|about)?\s*\$?([\d,]+)\s*(?:\/|per|a)?\s*(hour|hr|project|month|mo|retainer)?/i,
    ];
    for (const pattern of pricePatterns) {
      const m = text.match(pattern);
      if (!m) continue;
      
      const rawAmount = m[1].replace(/,/g, "");
      let price = parseFloat(rawAmount);
      if (isNaN(price) || price <= 0) continue;
      
      const hasK = m[0].toLowerCase().includes("k") && !m[0].toLowerCase().includes("hour");
      if (hasK) price *= 1000;
      
      if (price > 0 && price < 1_000_000) {
        metrics.price = price;
        const typeStr = (m[2] || m[3] || "").toLowerCase();
        metrics.price_type = /hour|hr/.test(typeStr) ? "hour" :
                            /project/.test(typeStr) ? "project" :
                            /month|mo|retainer/.test(typeStr) ? "month" : "unknown";
        break;
      }
    }
  }
  
  // ─── HOURS PER WEEK ───
  if (metrics.hours_per_week === undefined) {
    const hoursMatch = text.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:per|a|\/|each)\s*week/i);
    if (hoursMatch) {
      const hours = parseInt(hoursMatch[1]);
      if (hours > 0 && hours <= 168) metrics.hours_per_week = hours;
    }
  }
  
  // ─── WHAT'S WORKING / NOT WORKING ───
  // Only capture from this iteration if not already captured (most recent message wins)
  if (metrics.what_working === undefined) {
    const workingMatch = text.match(/(?:what(?:'s| is) working|going well|landed .+ through|got .+ from|finally getting)\s*(?:is|:)?\s*([^.!?]{10,150})/i);
    if (workingMatch) metrics.what_working = workingMatch[1].trim().slice(0, 200);
  }
  if (metrics.what_not_working === undefined) {
    const notWorkingMatch = text.match(/(?:not working|struggling with|failing|can(?:'t| not) get|no luck|no response|zero|stuck on)\s*(?:with|on|at|from)?\s*([^.!?]{10,150})/i);
    if (notWorkingMatch) metrics.what_not_working = notWorkingMatch[1].trim().slice(0, 200);
  }
  
  // ─── ACQUISITION CHANNELS (FIX #5: prevent double counting) ───
  // Order matters — match longer/more specific patterns first
  const channelPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bword of mouth\b|\bw\.?o\.?m\.?\b/i, label: "word of mouth" },
    { pattern: /\bcold email\b|\bcold outreach\b/i, label: "cold email" },
    { pattern: /\bcold (?:dm|message)\b/i, label: "cold dm" },
    { pattern: /\blinkedin\b/i, label: "linkedin" },
    { pattern: /\btwitter\b|\bx\.com\b/i, label: "twitter" },
    { pattern: /\binstagram\b|\bigreel\b/i, label: "instagram" },
    { pattern: /\btiktok\b/i, label: "tiktok" },
    { pattern: /\byoutube\b/i, label: "youtube" },
    { pattern: /\breferr?al/i, label: "referral" },
    { pattern: /\bupwork\b/i, label: "upwork" },
    { pattern: /\bfiverr\b/i, label: "fiverr" },
    { pattern: /\b(?:seo|search engine)\b/i, label: "seo" },
    { pattern: /\bblog\b/i, label: "blog" },
    { pattern: /\bnetworking\b|\bin person\b|\bevent\b/i, label: "networking" },
    { pattern: /\bcontent marketing\b/i, label: "content marketing" },
  ];
  
  if (!metrics.channels) metrics.channels = [];
  for (const { pattern, label } of channelPatterns) {
    if (pattern.test(text) && !metrics.channels.includes(label)) {
      metrics.channels.push(label);
    }
  }
  if (metrics.channels.length === 0) delete metrics.channels;
}

// ─── AGGREGATION TRIGGERING (FIX #1) ───────────────────
// Smart triggering — frequent when sample size is small, less frequent when large
// Plus a "staleness" check: if we haven't aggregated in 24h, aggregate even without new data

export async function maybeAggregate(
  supabase: SupabaseClient,
  niche: string | null
): Promise<void> {
  if (!niche) return;
  const normalizedNiche = normalizeNiche(niche);
  if (!normalizedNiche) return;

  try {
    // Count data points for this niche (excluding opted-out)
    const { count } = await supabase
      .from("zelrex_data_points")
      .select("id", { count: "exact", head: true })
      .eq("niche", normalizedNiche)
      .eq("opted_out", false);

    if (!count || count < 5) return;

    // Check when last aggregated
    const { data: lastInsight } = await supabase
      .from("zelrex_niche_insights")
      .select("updated_at, sample_size")
      .eq("niche", normalizedNiche)
      .is("sub_niche", null)
      .single();

    let shouldAggregate = false;
    
    if (!lastInsight) {
      // Never aggregated before — aggregate now
      shouldAggregate = true;
    } else {
      const lastSample = lastInsight.sample_size || 0;
      const newPoints = count - lastSample;
      const hoursSinceUpdate = (Date.now() - new Date(lastInsight.updated_at).getTime()) / (1000 * 60 * 60);
      
      // Tiered trigger logic:
      // - Small samples (5-20): aggregate every 2 new points
      // - Medium samples (20-100): aggregate every 5 new points
      // - Large samples (100+): aggregate every 10 new points
      // - Always aggregate if it's been 24h+ since last update (staleness)
      const triggerInterval = count < 20 ? 2 : count < 100 ? 5 : 10;
      
      if (newPoints >= triggerInterval || hoursSinceUpdate > 24) {
        shouldAggregate = true;
      }
    }

    if (shouldAggregate) {
      console.log(`[ZELREX DATA] Triggering aggregation for ${normalizedNiche} (${count} total points)`);
      await aggregateInsights(supabase, normalizedNiche);
    }
  } catch (e: any) {
    console.warn("[ZELREX DATA] maybeAggregate check failed:", e?.message);
  }
}

// ─── AGGREGATE INSIGHTS ────────────────────────────────

export async function aggregateInsights(
  supabase: SupabaseClient,
  niche: Niche
): Promise<void> {
  try {
    // Use the typed `niche` parameter consistently throughout (FIX #4)
    const { data: points, error } = await supabase
      .from("zelrex_data_points")
      .select("event_type, data, created_at, user_id")
      .eq("niche", niche)
      .eq("opted_out", false);

    if (error) {
      console.error(`[ZELREX DATA] Aggregation query error for ${niche}:`, error.message);
      return;
    }
    if (!points || points.length < 5) {
      console.log(`[ZELREX DATA] Not enough data for ${niche} (${points?.length || 0} points, need 5)`);
      return;
    }

    // Pricing aggregation
    const prices = points
      .filter(p => p.data?.price || p.data?.avg_price)
      .map(p => parseFloat(String(p.data.price || p.data.avg_price).replace(/[^\d.]/g, "")))
      .filter(p => p > 0 && p < 100000)
      .sort((a, b) => a - b);

    const pricing = prices.length >= 3 ? {
      median: prices[Math.floor(prices.length / 2)],
      range_low: prices[Math.floor(prices.length * 0.25)],
      range_high: prices[Math.floor(prices.length * 0.75)],
      sample: prices.length,
    } : null;

    // Revenue aggregation
    const revenues = points
      .filter(p => p.data?.revenue_monthly)
      .map(p => p.data.revenue_monthly)
      .filter((r: number) => r > 0 && r < 500000)
      .sort((a: number, b: number) => a - b);

    const revenue = revenues.length >= 3 ? {
      median_monthly: revenues[Math.floor(revenues.length / 2)],
      range_low: revenues[Math.floor(revenues.length * 0.25)],
      range_high: revenues[Math.floor(revenues.length * 0.75)],
      sample: revenues.length,
    } : null;

    // Time to first client
    const milestones = points.filter(p => p.event_type === "milestone" && p.data?.stage === 5);
    const daysToClient = milestones
      .map(m => m.data?.days_since_signup)
      .filter((d: number) => d > 0 && d < 365)
      .sort((a: number, b: number) => a - b);

    const timeToClient = daysToClient.length >= 3 ? {
      median_days: daysToClient[Math.floor(daysToClient.length / 2)],
      range: `${daysToClient[Math.floor(daysToClient.length * 0.25)]}-${daysToClient[Math.floor(daysToClient.length * 0.75)]} days`,
      sample: daysToClient.length,
    } : null;

    // Top channels
    const channelCounts: Record<string, number> = {};
    points.forEach(p => {
      if (Array.isArray(p.data?.channels)) {
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

    // Failures + successes
    const failures: Record<string, number> = {};
    const successes: Record<string, number> = {};
    points.forEach(p => {
      if (p.data?.what_not_working) {
        const key = String(p.data.what_not_working).toLowerCase().slice(0, 80);
        failures[key] = (failures[key] || 0) + 1;
      }
      if (p.data?.what_working) {
        const key = String(p.data.what_working).toLowerCase().slice(0, 80);
        successes[key] = (successes[key] || 0) + 1;
      }
    });

    // Market eval scores
    const evalScores = points
      .filter(p => p.event_type === "market_eval" && p.data?.score)
      .map(p => p.data.score)
      .filter((s: number) => s > 0 && s <= 10);

    const avgScore = evalScores.length >= 3
      ? Math.round((evalScores.reduce((a: number, b: number) => a + b, 0) / evalScores.length) * 10) / 10
      : null;

    const goals = points.filter(p => p.event_type === "goal_achieved");
    const goalAchieved = goals.length;
    const goalSet = points.filter(p => p.event_type === "goal_set").length;

    const insights: Record<string, any> = {};
    if (pricing) insights.pricing = pricing;
    if (revenue) insights.revenue = revenue;
    if (timeToClient) insights.time_to_first_client = timeToClient;
    if (topChannels.length > 0) insights.top_acquisition_channels = topChannels;
    if (Object.keys(failures).length > 0) {
      insights.common_failures = Object.keys(failures)
        .sort((a, b) => failures[b] - failures[a])
        .slice(0, 5);
    }
    if (Object.keys(successes).length > 0) {
      insights.common_successes = Object.keys(successes)
        .sort((a, b) => successes[b] - successes[a])
        .slice(0, 5);
    }
    if (avgScore) insights.avg_market_eval_score = avgScore;
    if (goalSet > 0) {
      insights.goals = {
        set: goalSet,
        achieved: goalAchieved,
        achievement_rate: Math.round((goalAchieved / goalSet) * 100) / 100,
      };
    }

    // Pattern analysis (when enough data)
    if (points.length >= 10) {
      const foundPatterns = await analyzePatterns(supabase, niche);
      if (foundPatterns.length > 0) {
        insights.patterns = foundPatterns;
        console.log(`[ZELREX DATA] Found ${foundPatterns.length} patterns for ${niche}`);
      }
    }

    // FIX #4: Use the typed normalized niche, NOT a potentially-shadowed variable
    const { error: upsertError } = await supabase
      .from("zelrex_niche_insights")
      .upsert({
        niche, // <-- this is the typed Niche parameter, guaranteed correct
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
  } catch (e: any) {
    console.error(`[ZELREX DATA] Aggregation failed for ${niche}:`, e?.message);
  }
}

// ─── OUTCOME TRACKING ──────────────────────────────────

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
  await collectDataPoint(supabase, userId, eventType, niche, data);
}

// ─── PATTERN INTELLIGENCE (FIX #3 — real success criteria) ───

export interface PatternInsight {
  pattern: string;
  confidence: number;
  sample_size: number;
  success_rate: number;
  applies_when: string;
}

// FIX #3: Define real success criteria — not "any revenue > 0"
const SUCCESS_THRESHOLDS = {
  // Real success requires meaningful revenue, not just "any"
  monthly_revenue_min: 1000, // $1k/mo minimum to count as "succeeded"
  // OR substantial client count
  client_count_min: 3,
  // OR explicit "growing" status
};

function isUserSucceeding(events: Array<{ event: string; data: any }>): "succeeded" | "started" | "failed" | "unknown" {
  let hasGrowingStatus = false;
  let hasFailingStatus = false;
  let maxRevenue = 0;
  let maxClients = 0;
  let hasClientAcquired = false;
  
  for (const e of events) {
    if (e.data?.status === "growing") hasGrowingStatus = true;
    if (e.data?.status === "abandoned" || e.data?.status === "stalled") hasFailingStatus = true;
    if (typeof e.data?.revenue_monthly === "number" && e.data.revenue_monthly > maxRevenue) {
      maxRevenue = e.data.revenue_monthly;
    }
    if (typeof e.data?.revenue === "number" && e.data.revenue > maxRevenue) {
      maxRevenue = e.data.revenue;
    }
    if (typeof e.data?.client_count === "number" && e.data.client_count > maxClients) {
      maxClients = e.data.client_count;
    }
    if (e.event === "client_acquired") hasClientAcquired = true;
  }
  
  // Real success criteria
  if (hasGrowingStatus || maxRevenue >= SUCCESS_THRESHOLDS.monthly_revenue_min || maxClients >= SUCCESS_THRESHOLDS.client_count_min) {
    return "succeeded";
  }
  // Has at least one client but didn't reach success threshold
  if (hasClientAcquired) return "started";
  // Explicitly failed
  if (hasFailingStatus) return "failed";
  
  return "unknown";
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

    // Group by user
    const userJourneys: Record<string, Array<{ event: string; data: any; date: string }>> = {};
    for (const p of points) {
      if (!userJourneys[p.user_id]) userJourneys[p.user_id] = [];
      userJourneys[p.user_id].push({ event: p.event_type, data: p.data, date: p.created_at });
    }
    const userIds = Object.keys(userJourneys);
    if (userIds.length < 5) return patterns;

    // Pattern: Pricing vs success — using REAL success criteria
    const pricingOutcomes: Array<{ price: number; outcome: ReturnType<typeof isUserSucceeding> }> = [];
    for (const uid of userIds) {
      const j = userJourneys[uid];
      const pricePoint = j.find(e => e.data?.price);
      if (!pricePoint?.data?.price) continue;
      
      const price = parseFloat(String(pricePoint.data.price).replace(/[^\d.]/g, ""));
      if (price <= 0 || price >= 100000) continue;
      
      const outcome = isUserSucceeding(j);
      if (outcome !== "unknown") {
        pricingOutcomes.push({ price, outcome });
      }
    }
    
    if (pricingOutcomes.length >= 5) {
      const sorted = pricingOutcomes.map(p => p.price).sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const above = pricingOutcomes.filter(p => p.price >= med);
      const below = pricingOutcomes.filter(p => p.price < med);
      const aRate = above.filter(p => p.outcome === "succeeded").length / (above.length || 1);
      const bRate = below.filter(p => p.outcome === "succeeded").length / (below.length || 1);
      
      // Only surface pattern if difference is meaningful (15+ points)
      if (Math.abs(aRate - bRate) > 0.15) {
        const winner = aRate > bRate ? "above" : "below";
        const winnerRate = aRate > bRate ? aRate : bRate;
        const loserRate = aRate > bRate ? bRate : aRate;
        patterns.push({
          pattern: `Freelancers pricing ${winner} $${med} succeed ${Math.round(winnerRate * 100)}% vs ${Math.round(loserRate * 100)}% on the other side`,
          confidence: Math.min(0.9, pricingOutcomes.length / 30),
          sample_size: pricingOutcomes.length,
          success_rate: winnerRate,
          applies_when: "pricing decisions",
        });
      }
    }

    // Pattern: Channel effectiveness — with real success criteria
    const channelOutcomes: Record<string, { total: number; succeeded: number }> = {};
    for (const uid of userIds) {
      const j = userJourneys[uid];
      const channelsRaw = j.flatMap(e => 
        Array.isArray(e.data?.channels) ? e.data.channels : 
        e.data?.channel ? [e.data.channel] : []
      );
      const uniqueChannels = [...new Set(channelsRaw.filter(c => typeof c === "string"))];
      const outcome = isUserSucceeding(j);
      
      if (outcome === "unknown") continue;
      
      for (const ch of uniqueChannels) {
        if (!channelOutcomes[ch]) channelOutcomes[ch] = { total: 0, succeeded: 0 };
        channelOutcomes[ch].total++;
        if (outcome === "succeeded") channelOutcomes[ch].succeeded++;
      }
    }
    
    for (const [ch, stats] of Object.entries(channelOutcomes)) {
      if (stats.total >= 5) {
        const rate = stats.succeeded / stats.total;
        patterns.push({
          pattern: `${ch} has ${Math.round(rate * 100)}% success rate for ${niche.replace(/_/g, " ")}`,
          confidence: Math.min(0.85, stats.total / 20),
          sample_size: stats.total,
          success_rate: rate,
          applies_when: "choosing acquisition channels",
        });
      }
    }

    // Pattern: Time to first client (real)
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
      patterns.push({
        pattern: `First client in median ${med} days (range: ${timelines[Math.floor(timelines.length * 0.25)]}-${timelines[Math.floor(timelines.length * 0.75)]})`,
        confidence: Math.min(0.9, timelines.length / 20),
        sample_size: timelines.length,
        success_rate: 1,
        applies_when: "setting timeline expectations",
      });
    }

    return patterns.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
  } catch (e: any) {
    console.error("[ZELREX DATA] Pattern analysis failed:", e?.message);
    return [];
  }
}

// ─── PROMPT INJECTION (FIX #6 — no more [PATTERN] tags) ───

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

    parts.push(`\n\nZELREX INTELLIGENCE — ${normalizedNiche.replace(/_/g, " ")} (data from ${data.sample_size} real Zelrex users, last updated ${new Date(data.updated_at).toLocaleDateString()}):`);
    parts.push(`This is proprietary data from real Zelrex user outcomes — more reliable than generic AI estimates. When referencing it, use natural language like "from data we've collected on ${data.sample_size} ${normalizedNiche.replace(/_/g, " ")} users..." Don't use bracket tags.`);

    if (ins.pricing) parts.push(`  Pricing: $${ins.pricing.range_low}-${ins.pricing.range_high}/project (median $${ins.pricing.median}, n=${ins.pricing.sample})`);
    if (ins.revenue) parts.push(`  Revenue: median $${ins.revenue.median_monthly}/mo (range $${ins.revenue.range_low}-${ins.revenue.range_high}, n=${ins.revenue.sample})`);
    if (ins.time_to_first_client) parts.push(`  First client: median ${ins.time_to_first_client.median_days} days (${ins.time_to_first_client.range}, n=${ins.time_to_first_client.sample})`);
    if (ins.top_acquisition_channels?.length) parts.push(`  Top channels: ${ins.top_acquisition_channels.join(", ")}`);
    if (ins.common_successes?.length) parts.push(`  What works: ${ins.common_successes.slice(0, 3).join("; ")}`);
    if (ins.common_failures?.length) parts.push(`  Common mistakes: ${ins.common_failures.slice(0, 3).join("; ")}`);
    if (ins.goals) parts.push(`  Goals: ${Math.round(ins.goals.achievement_rate * 100)}% achievement rate (${ins.goals.achieved}/${ins.goals.set})`);

    if (ins.patterns?.length) {
      parts.push(`  Discovered patterns:`);
      for (const p of ins.patterns.slice(0, 5)) {
        parts.push(`    - ${p.pattern} (confidence: ${Math.round(p.confidence * 100)}%, n=${p.sample_size})`);
        parts.push(`      Use when: ${p.applies_when}`);
      }
    }

    parts.push(`  Reference this naturally: "Based on data from ${data.sample_size} Zelrex users in this niche..."`);
    parts.push(`  Never reveal individual user data or say "one of our users did X".`);

    return parts.join("\n");
  } catch (e: any) {
    console.error("[ZELREX DATA] Insights fetch failed:", e?.message);
    return "";
  }
}