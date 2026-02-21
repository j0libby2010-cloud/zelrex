/**
 * ZELREX MARKET EVALUATION ENGINE v2 — INFRASTRUCTURE GRADE
 * 
 * Architecture:
 *   Round 1: DISCOVERY — market landscape, size, trends
 *   Round 2: COMPETITORS — find 3-5 NAMED real businesses doing this exact thing
 *   Round 3: DEEP DIVE — fill gaps from R1+R2 (pricing, CAC, solo operator income)
 *   Round 4: SYNTHESIS — score, project, pre-mortem, validation plan, accountability
 * 
 * New in v2:
 *   - Named competitor research (real businesses, real pricing, real reviews)
 *   - Pre-mortem analysis ("it's 90 days from now and you failed — here's why")
 *   - Confidence calibration (honest about what this can/can't tell you)
 *   - Feedback loop hooks (30/60/90 day check-in prompts)
 *   - Accountability tracking (commitments the user makes → follow-up)
 *   - Outcome schema (stores eval + outcome for future calibration)
 * 
 * Cost: ~$2.50-4.00 per evaluation (4 Sonnet calls, 3 with web search)
 * Time: ~45-90 seconds
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const MODEL = "claude-sonnet-4-5-20250929";

// ═══════════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════════

export function wantsMarketEval(message: string): boolean {
  const l = message.toLowerCase();
  return [
    /evaluat\w*\s+(the\s+)?market/, /market\s+evaluat/, /analyz\w*\s+(the\s+)?market/,
    /research\s+(the\s+)?market/, /stress\s+test/, /is\s+(this|my)\s+(idea|business)\s+(viable|good|worth)/,
    /should\s+i\s+(start|launch|build)/, /what\s+business\s+should/, /which\s+business\s+should/,
    /find\s+me\s+a\s+business/, /best\s+business\s+for/, /validate\s+(my|this)/, /how\s+viable/,
  ].some((r) => r.test(l));
}

export function wantsCheckIn(message: string): boolean {
  const l = message.toLowerCase();
  return [
    /check.?in/, /how.?s my business/, /weekly\s+(summary|report|check|update)/,
    /business\s+update/, /what should i (do|focus)/, /am i on track/,
  ].some((r) => r.test(l));
}

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface UserContext {
  goals?: string;
  skills?: string;
  timePerWeek?: string;
  riskTolerance?: string;
  sellingComfort?: string;
  speedPreference?: string;
  incomeTarget?: string;
  businessIdea?: string;
  constraints?: string;
}

/**
 * Outcome tracking schema.
 * Store this alongside every evaluation in your KV store.
 * Over time, this becomes your calibration database.
 */
export interface EvaluationRecord {
  id: string;
  createdAt: string;
  userContext: UserContext;
  recommendedBusiness: string;
  weightedScore: number;
  searchQueries: string[];
  // Filled in later as user reports back:
  outcome30d?: { launched: boolean; revenue?: number; customers?: number; notes?: string };
  outcome60d?: { revenue?: number; customers?: number; pivoted?: boolean; notes?: string };
  outcome90d?: { revenue?: number; customers?: number; status: "growing" | "stalled" | "abandoned" | "pivoted"; notes?: string };
}

/**
 * Accountability commitments.
 * Store these per-chat so Zelrex can follow up.
 */
export interface Commitment {
  id: string;
  createdAt: string;
  action: string;
  dueBy: string;
  status: "pending" | "done" | "missed" | "deferred";
  checkedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// CONTEXT EXTRACTION
// ═══════════════════════════════════════════════════════════════════════

export function extractUserContext(messages: Array<{ role: string; content: string }>): UserContext {
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ").toLowerCase();
  const ctx: UserContext = {};

  // Business idea
  const ideaPatterns = [
    /(?:i want to|i'm thinking about|my idea is|i want to (?:start|sell|offer|build)|business (?:is|about)|selling|offering)\s+(.{10,150})/i,
    /(?:evaluate|analyze|research|stress test).*?(?:for|about)\s+(.{10,150})/i,
  ];
  for (const p of ideaPatterns) { const m = userText.match(p); if (m) { ctx.businessIdea = m[1].trim().replace(/[.!?]+$/, ""); break; } }

  // Skills
  const skillMap: Record<string, string> = {
    "video edit": "video editing", design: "design", writ: "writing", market: "marketing",
    code: "software development", program: "software development", develop: "development",
    coach: "coaching", consult: "consulting", photo: "photography", music: "music production",
    teach: "teaching/tutoring", account: "accounting", bookkeep: "bookkeeping",
    "social media": "social media management", seo: "SEO", web: "web development",
    sales: "sales", copywr: "copywriting", data: "data analysis",
  };
  for (const [k, v] of Object.entries(skillMap)) { if (userText.includes(k)) { ctx.skills = v; break; } }

  // Time
  const tm = userText.match(/(\d+)\s*(?:hours?|hrs?)\s*(?:per|a|\/)\s*week/);
  if (tm) ctx.timePerWeek = tm[1] + " hours/week";

  // Speed
  if (userText.includes("quickly") || userText.includes("fast") || userText.includes("asap")) ctx.speedPreference = "fast";
  else if (userText.includes("willing to wait") || userText.includes("long term") || userText.includes("durable")) ctx.speedPreference = "patient";

  // Selling comfort
  if (userText.match(/comfortable.{0,20}(talk|call|sell)/)) ctx.sellingComfort = "comfortable with sales calls";
  else if (userText.match(/prefer not|don.t want to talk|no calls/)) ctx.sellingComfort = "prefers no direct sales";

  // Risk
  if (userText.match(/really bad|can.t afford|devastating/)) ctx.riskTolerance = "low";
  else if (userText.match(/not great but|manageable|setback/)) ctx.riskTolerance = "medium";
  else if (userText.match(/fine|learning experience|experiment/)) ctx.riskTolerance = "high";

  // Income
  const im = userText.match(/\$?([\d,]+)\s*(?:per|a|\/)\s*month/);
  if (im) ctx.incomeTarget = "$" + im[1] + "/month";

  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// ROUND 1: MARKET DISCOVERY
// ═══════════════════════════════════════════════════════════════════════

async function round1(ctx: UserContext): Promise<string> {
  const biz = ctx.businessIdea || ctx.skills || "online business";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Today is ${today}.

Research the market for: "${biz}"

Perform 3-4 web searches to find:
1. Current market size and growth trajectory (2024-2026 data preferred)
2. Main customer segments and what they currently pay for this
3. Primary acquisition channels for solo operators in this space
4. Any recent trend shifts (AI disruption, new platforms, market consolidation)

RULES:
- Every data point must include the YEAR and SOURCE
- If a source says "projected to reach $X by 2025" and it's now ${new Date().getFullYear()}, search for what ACTUALLY happened
- Distinguish between company-level market data and solo operator income
- If you can't find reliable data, say "NOT FOUND" — never fabricate

Return a structured summary organized by the 4 questions above.` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// ROUND 2: NAMED COMPETITOR RESEARCH
// ═══════════════════════════════════════════════════════════════════════

async function round2Competitors(ctx: UserContext, r1: string): Promise<string> {
  const biz = ctx.businessIdea || ctx.skills || "online business";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Today is ${today}.

You're researching competitors for someone starting: "${biz}"

Round 1 findings:
---
${r1.slice(0, 3000)}
---

TASK: Find 3-5 REAL, NAMED businesses or individuals currently doing this exact thing as a solo operator or small team. For EACH one, find:

1. Their name / brand / website
2. What exactly they offer
3. Their pricing (specific numbers)
4. How they acquire customers (social media, SEO, referrals, ads, etc.)
5. How long they've been operating (if findable)
6. Any reviews, testimonials, or public revenue data
7. What makes them successful OR what weakness you notice

Search specifically for:
- "[business type] freelancer portfolio site"
- "[business type] pricing 2025"
- "[business type] solo operator" or "one person [business type] business"
- Look at platforms where these people operate (Upwork, Fiverr, their own sites, Twitter/X, LinkedIn)

ALSO find ONE alternative/adjacent business the user should consider as a comparison. This should be something meaningfully different that uses similar skills but targets a different market or price point.

RULES:
- REAL businesses only. If you can't find specific names, find specific profiles on freelance platforms.
- Real pricing only. If pricing isn't public, say so.
- Include URLs where possible.` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// ROUND 3: GAP FILLING
// ═══════════════════════════════════════════════════════════════════════

async function round3Gaps(ctx: UserContext, r1: string, r2: string): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 2000,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Today is ${today}.

You've done 2 rounds of research. Review the findings and fill the BIGGEST remaining gaps.

Round 1 (Market):
${r1.slice(0, 2000)}

Round 2 (Competitors):
${r2.slice(0, 2500)}

User context:
- Skills: ${ctx.skills || "unknown"}
- Time: ${ctx.timePerWeek || "unknown"}
- Income target: ${ctx.incomeTarget || "unknown"}

Identify the 3 most important data gaps and search to fill them. Common gaps:
- Customer acquisition cost (how much does it cost to get one client?)
- Realistic solo operator income at different experience levels
- Time from start to first paying client
- Seasonal patterns or market timing considerations
- What makes businesses in this space FAIL (not succeed — fail)

Also search for: common failure reasons for [this type of business]

Return findings organized by gap, with sources and years.` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// ROUND 4: SYNTHESIS + PRE-MORTEM + ACCOUNTABILITY
// ═══════════════════════════════════════════════════════════════════════

async function round4Synthesis(ctx: UserContext, r1: string, r2: string, r3: string): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 5000,
    messages: [{ role: "user", content: `Today is ${today}.

You are Zelrex. Synthesize 3 rounds of research into the definitive market evaluation.

USER:
- Idea: ${ctx.businessIdea || "not specified"}
- Skills: ${ctx.skills || "not specified"}
- Time: ${ctx.timePerWeek || "not specified"}
- Speed: ${ctx.speedPreference || "not specified"}
- Selling: ${ctx.sellingComfort || "not specified"}
- Risk tolerance: ${ctx.riskTolerance || "not specified"}
- Income target: ${ctx.incomeTarget || "not specified"}
- Constraints: ${ctx.constraints || "none stated"}

ROUND 1 — MARKET:
${r1.slice(0, 2500)}

ROUND 2 — COMPETITORS:
${r2.slice(0, 3000)}

ROUND 3 — GAP FILLING:
${r3.slice(0, 2500)}

═══════════════════════════════════════════
OUTPUT FORMAT — follow this EXACTLY:
═══════════════════════════════════════════

## Market Evaluation

*${today} · 3 research rounds · 9-15 search queries · Evidence-backed scoring*

---

### What This Evaluation Can and Can't Tell You

Write 3-4 sentences. Be honest:
- CAN: structured analysis of publicly available market data, competitor pricing, demand signals
- CAN: identify specific risks and failure patterns based on real businesses in this space
- CANNOT: guarantee accuracy of projections (all projections are estimates based on found data)
- CANNOT: replace talking to real potential customers (which is step 1 of the validation plan)
- State that scoring accuracy will improve as Zelrex tracks more user outcomes over time

---

### Your Situation

2-3 sentences about THIS user specifically. Reference their stated skills, time, goals, constraints.

---

### Recommended Business

**[Specific business name/type]**

3-4 sentences on why this is the best fit for THIS user. Be specific — don't say "there's demand," say "we found X competitors charging $Y, which suggests Z."

**Evidence-Backed Score:**

| Dimension | Score | Evidence |
|---|---|---|
| Demand Certainty | X/10 | [Specific finding from Round 1/2/3 with source] |
| Time-to-Cash (2x) | X/10 | [Based on competitor data: how long to first client] |
| Skill Fit (2x) | X/10 | [Specific match between user's skills and requirements] |
| Competition | X/10 | [From Round 2: # of competitors, their saturation, user's wedge] |
| Revenue Ceiling | X/10 | [From competitors: what top solo operators earn] |
| Risk Level | X/10 | [From Round 3: failure rate data if found, user's tolerance] |

**Weighted Score: X.X/10**

Explain the weighted calculation: (Demand + TimeToCash×2 + SkillFit×2 + Competition + RevenueCeiling + Risk) / 8

---

### Real Competitors You're Up Against

For each of the 3-5 competitors found in Round 2, list:
- **[Name/Brand]** — [What they offer] — [Their pricing] — [Their acquisition channel]
- Note what the user can learn from each one
- Note what weakness the user could exploit

---

### Comparison Business

**[Alternative business]**

2-3 sentences on why this alternative exists. Score it with the same 6-dimension table. Show weighted score. State which is better for THIS user and why.

---

### Revenue Projection

| Timeline | Conservative | Moderate | Aggressive | Confidence |
|---|---|---|---|---|
| Month 1 | $X | $X | $X | X% |
| Month 3 | $X | $X | $X | X% |
| Month 6 | $X | $X | $X | X% |
| Year 1 | $X | $X | $X | X% |

**How these numbers were calculated:** [Be explicit. "Based on [Competitor X] charging $Y per [unit], and the user having [Z hours/week], the conservative estimate assumes [N] clients at [price] with a [X-week] ramp-up."]

---

### Pre-Mortem: How This Business Dies

*It's 90 days from now. Your business has failed. Here's the most likely story:*

Write a specific, realistic narrative (150-200 words) of exactly how failure happens for THIS user with THIS business. Include:
- The specific week things started going wrong
- The emotional state that led to bad decisions
- The tactical mistake that was avoidable
- The moment they should have pivoted or changed approach but didn't

Then write: **How to prevent this story from happening:** and list 3 specific actions.

---

### Validation Plan

Matched to user's speed preference:
- Fast → 14-day plan (7 steps)
- Patient → 30-day plan (10 steps)
- Unknown → 21-day plan (8 steps)

Each step MUST include:
1. **Action:** [Specific, concrete, doable this week]
2. **Purpose:** [What this proves or disproves]
3. **Success criteria:** [Specific number or outcome — "3 people say they'd pay" not "gauge interest"]
4. **Time:** [Hours or days this takes]
5. **Cost:** [$0 if possible, state if money required]
6. **Go/No-Go:** [What result means stop vs continue]

---

### Risk Assessment

5 risks ranked by (probability × impact):

For each:
- **Risk:** [Specific to THIS business, not generic]
- **Probability:** Low / Medium / High — [with evidence from research]
- **Impact:** Low / Medium / High
- **Mitigation:** [Specific action, not "be careful"]
- **Early warning:** [Specific observable signal, not "things feel slow"]

---

### What NOT to Do

5 specific mistakes THIS user is likely to make:

For each:
1. **The mistake:** [Specific]
2. **Why it's tempting:** [Based on their stated preferences/situation]
3. **Why it fails:** [Evidence from Round 3 or competitor data]
4. **Do this instead:** [Specific alternative action]

---

### Your First 3 Commitments

Based on the validation plan, propose exactly 3 things the user should commit to completing in the next 7 days. These must be:
- Achievable in the user's stated time availability
- Free or nearly free
- Concrete (not "research the market" — that's what Zelrex just did)
- Measurable (the user can say "I did it" or "I didn't")

Format:
1. **[Action]** — by [day of week, 7 days from now]
2. **[Action]** — by [day of week, 7 days from now]
3. **[Action]** — by [day of week, 7 days from now]

Then say: "When you come back, I'll ask you about these. Reporting back — even if you didn't complete them — helps me give you better guidance."

---

### Confidence Statement

**Overall confidence: X/10**

- **Based on:** [# of sources, quality of data found]
- **Would increase confidence:** [Specific data or actions — "talking to 3 potential customers" is always #1]
- **Would change recommendation:** [Specific scenario — "if competitor X drops pricing below $Y" or "if user discovers they hate client calls"]
- **Couldn't find:** [Honest list of gaps]
- **Scoring note:** These scores are based on publicly available data and AI analysis. As Zelrex tracks outcomes from more users over time, scoring calibration will improve. Currently, treat scores as structured guidance, not precision measurements.

═══════════════════════════════════════════
RULES:
═══════════════════════════════════════════

1. EVERY score must cite evidence. "7/10 — based on [specific finding]". No vibes.
2. EVERY revenue number must show its math. "[Price] × [clients/month] × [utilization rate]"
3. The pre-mortem must be emotionally real, not clinical. It should make the user slightly uncomfortable.
4. Named competitors must be REAL. If you couldn't find real names, use real platform profiles.
5. The comparison business must be genuinely different enough to be a real alternative.
6. Validation steps must cost $0 for at least the first 3 steps.
7. The 3 commitments must be completable in ONE WEEK.
8. Be honest about confidence. A 6/10 with clear reasoning builds more trust than a fake 9/10.
9. If data wasn't found, say "NOT FOUND" — never fabricate.
10. The entire output should make the user feel like they have a plan they can trust, while being honest about what they still need to verify themselves.` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: FULL EVALUATION
// ═══════════════════════════════════════════════════════════════════════

export async function runMarketEvaluation(
  messages: Array<{ role: string; content: string }>
): Promise<{ reply: string; evaluationRecord: EvaluationRecord }> {
  const ctx = extractUserContext(messages);

  // Guard: need enough context
  if (!ctx.businessIdea && !ctx.skills) {
    return {
      reply: `I need more context before running a proper evaluation.

Tell me:
1. What business or skill you want me to evaluate
2. How many hours per week you can put in
3. Whether you want fast cash or long-term durability

The more specific you are about what you want to sell and to whom, the better the evaluation.`,
      evaluationRecord: null as any,
    };
  }

  try {
    console.log("ZELREX EVAL: Round 1 — Market Discovery");
    const r1 = await round1(ctx);

    console.log("ZELREX EVAL: Round 2 — Competitor Research");
    const r2 = await round2Competitors(ctx, r1);

    console.log("ZELREX EVAL: Round 3 — Gap Filling");
    const r3 = await round3Gaps(ctx, r1, r2);

    console.log("ZELREX EVAL: Round 4 — Synthesis");
    const synthesis = await round4Synthesis(ctx, r1, r2, r3);

    // Build evaluation record for outcome tracking
    const record: EvaluationRecord = {
      id: `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      userContext: ctx,
      recommendedBusiness: ctx.businessIdea || ctx.skills || "unknown",
      weightedScore: 0, // Will be parsed from output if needed
      searchQueries: [], // Could be populated from Round 1-3 tool use blocks
    };

    return { reply: synthesis, evaluationRecord: record };

  } catch (error) {
    console.error("ZELREX EVAL ERROR:", error);
    const fallback = await runFallback(ctx);
    return {
      reply: fallback,
      evaluationRecord: {
        id: `eval_fallback_${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        userContext: ctx,
        recommendedBusiness: ctx.businessIdea || "unknown",
        weightedScore: 0,
        searchQueries: [],
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// CHECK-IN / ACCOUNTABILITY SYSTEM
// ═══════════════════════════════════════════════════════════════════════

export async function runCheckIn(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const ctx = extractUserContext(messages);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Extract any numbers the user has shared
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content).join(" ");
  const assistantMessages = messages.filter((m) => m.role === "assistant").map((m) => m.content).join(" ");

  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 2500,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [{ role: "user", content: `Today is ${today}.

You are Zelrex running a business check-in.

USER'S BUSINESS: ${ctx.businessIdea || ctx.skills || "unknown"}
CONVERSATION HISTORY (scan for any metrics, commitments, or reported outcomes):
${userMessages.slice(-3000)}

PREVIOUS ZELREX ADVICE (scan for commitments the user was asked to complete):
${assistantMessages.slice(-3000)}

TASK:

1. ACCOUNTABILITY CHECK: Look through the conversation for any commitments Zelrex previously asked the user to complete. List each one and ask whether they did it. If you can't find specific commitments, ask:
   - "Have you talked to any potential customers this week?"
   - "Have you made any revenue?"
   - "What did you actually spend time on?"

2. MARKET PULSE: Do 1-2 searches for recent news or changes in the user's industry. Look for:
   - New competitors
   - Price changes
   - Platform algorithm changes
   - Seasonal patterns
   - Anything that could affect the user THIS WEEK

3. DIAGNOSIS: Based on where the user is, identify:
   - What's working (if anything)
   - What's not working (be specific)
   - The #1 thing they should focus on this week (ONLY ONE — not a list of 5)

4. NEW COMMITMENTS: Give exactly 3 things to complete by next check-in. Same rules: free, concrete, measurable, achievable in their stated hours.

5. WARNING FLAGS: If you detect any of these patterns, say so directly:
   - User hasn't talked to any customers (most common failure)
   - User is spending time on branding/logos/design instead of selling
   - User is "researching" instead of doing
   - User's pricing is below what competitors charge (from evaluation data)
   - User hasn't launched after 2+ weeks
   - User seems to be losing motivation (shorter messages, less detail)

FORMAT: Keep it conversational but structured. Use headers. Be direct. If they're failing, say so — with compassion but without sugarcoating.

End with: "Same time next week. I'll remember what you committed to."` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// FALLBACK (no web search)
// ═══════════════════════════════════════════════════════════════════════

async function runFallback(ctx: UserContext): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const r = await anthropic.messages.create({
    model: MODEL, max_tokens: 4000,
    messages: [{ role: "user", content: `Today is ${today}.

You are Zelrex. Web search is UNAVAILABLE. Run a market evaluation using ONLY training knowledge.

Business: "${ctx.businessIdea || ctx.skills || "their idea"}"
Skills: ${ctx.skills || "unknown"} | Time: ${ctx.timePerWeek || "unknown"} | Speed: ${ctx.speedPreference || "unknown"} | Income: ${ctx.incomeTarget || "unknown"}

CRITICAL: Since no web search:
- Label ALL numbers as [AI ESTIMATE]
- Be 20% more conservative
- Recommend verifying key numbers before committing money
- Training data goes through early 2025

Start with this disclaimer:
> **Evaluation without real-time data.** Web search was unavailable. All numbers are AI estimates based on training knowledge through early 2025. Verify independently before making decisions. Run this evaluation again later for a live-data version.

Then follow the FULL output format: 6-dimension scores, named competitors if you know real ones, pre-mortem, validation plan with commitments, risk assessment, what NOT to do, confidence statement.` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
}
