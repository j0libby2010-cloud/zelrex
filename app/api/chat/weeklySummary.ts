/**
 * ZELREX WEEKLY SUMMARY GENERATOR
 * 
 * Generates a structured weekly check-in based on:
 * - Progress data (milestones, revenue, commitments)
 * - Market pulse (fresh web search)
 * - Accountability (what they committed to vs what they did)
 * - Next week's focus
 * 
 * Used by route.ts when user asks for a check-in or weekly summary.
 */

import Anthropic from "@anthropic-ai/sdk";

type Commitment = {
  action: string;
  dueBy: string | number | Date;
  completed?: boolean;
};

type Milestone = {
  label: string;
  completed?: boolean;
  dueBy?: string | number | Date;
};

export type BusinessProgress = {
  startedAt: string;
  businessCategory: string;
  revenue?: number;
  commitments?: Commitment[];
  milestones?: Milestone[];
};

function generateProgressSummary(progress: BusinessProgress): string {
  const started = new Date(progress.startedAt).toLocaleDateString();
  const revenue = typeof progress.revenue === "number" ? `$${progress.revenue.toLocaleString()}` : "No revenue reported";
  const completedMilestones = (progress.milestones ?? []).filter((m) => m.completed).length;
  const totalMilestones = (progress.milestones ?? []).length;
  const pendingCommitments = (progress.commitments ?? []).filter((c) => !c.completed).length;

  return [
    `Started: ${started}`,
    `Revenue: ${revenue}`,
    `Milestones: ${completedMilestones}/${totalMilestones} completed`,
    `Pending commitments: ${pendingCommitments}`,
  ].join("\n");
}

function getPendingCommitments(progress: BusinessProgress): Commitment[] {
  return (progress.commitments ?? []).filter((c) => !c.completed && c.action && c.dueBy);
}

function getNextMilestone(progress: BusinessProgress): Milestone | null {
  const next = (progress.milestones ?? []).find((m) => !m.completed);
  return next ?? null;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODEL = "claude-sonnet-4-5-20250929";

// ═══════════════════════════════════════════════════════════════════════
// DETECTION
// ═══════════════════════════════════════════════════════════════════════

export function wantsWeeklySummary(message: string): boolean {
  const l = message.toLowerCase();
  return [
    /weekly\s*(summary|report|check|update|review)/,
    /check.?in/, /how.?s my business/, /business\s*update/,
    /what should i (do|focus)/, /am i on track/,
    /give me.*summary/, /what.?s my progress/,
    /how am i doing/, /status\s*(update|report|check)/,
  ].some((r) => r.test(l));
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN WEEKLY SUMMARY
// ═══════════════════════════════════════════════════════════════════════

export async function generateWeeklySummary(
  messages: Array<{ role: string; content: string }>,
  progress: BusinessProgress | null
): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  
  // If no progress data exists, do a basic check-in
  if (!progress) {
    return generateBasicCheckIn(messages);
  }
  
  const progressSummary = generateProgressSummary(progress);
  const pending = getPendingCommitments(progress);
  const nextMilestone = getNextMilestone(progress);
  const weekNum = Math.ceil(
    (Date.now() - new Date(progress.startedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
  );
  
  // Get recent user messages for context
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-5)
    .map((m) => m.content)
    .join("\n");
  
  // Run market pulse search
  const marketPulse = await searchMarketPulse(progress.businessCategory);
  
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: `Today is ${today}. You are Zelrex generating a Week ${weekNum} check-in.

USER'S PROGRESS DATA:
${progressSummary}

PENDING COMMITMENTS:
${pending.length > 0 ? pending.map((c) => `- ${c.action} (due: ${new Date(c.dueBy).toLocaleDateString()})`).join("\n") : "None currently set"}

NEXT MILESTONE TO HIT:
${nextMilestone ? nextMilestone.label : "All milestones completed"}

RECENT USER MESSAGES:
${recentUserMessages.slice(-2000)}

MARKET PULSE (from fresh search):
${marketPulse}

BUSINESS CATEGORY: ${progress.businessCategory}

Generate a weekly check-in following this EXACT structure:

## Week ${weekNum} Check-In

### Accountability
${pending.length > 0 
  ? "Ask about each pending commitment specifically. Don't be vague — list each one and ask if it was completed." 
  : "No commitments were set last week. Note this — having commitments is important for progress."}

### Your Progress
Reference the progress data. Be specific about milestones completed, days since start, and revenue if any. If progress is slow, say so directly but constructively.

### Market Pulse
Mention 1-2 relevant things from the market search. Only include what's actually useful — don't pad with generic info.

### This Week's Focus
Give exactly ONE priority for the next 7 days. Not a list. One thing. The most important thing they should focus on.

Explain WHY this is the priority based on where they are in their journey.

### Your 3 Commitments
Three specific, measurable actions for this week. Rules:
- Cost $0 (or nearly $0)
- Completable in their available hours
- Concrete enough that they can say "I did it" or "I didn't"
- Connected to the ONE priority above

Format:
1. **[Action]** — by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long" })}
2. **[Action]** — by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long" })}
3. **[Action]** — by ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long" })}

### Warning Flags
Only include if you detect a problem from the progress data or recent messages. Check for:
- No outreach activity after 7+ days (CRITICAL)
- Working on branding/design instead of client acquisition
- Still "researching" or "planning" after evaluation is done
- Pricing below market rate
- Going quiet (no check-ins for 2+ weeks)
- Scope creep (offering too many services)

If no warnings, skip this section entirely.

End with: "Report back anytime. I'll remember these commitments."

RULES:
- Be direct. If they're behind, say so.
- Be specific. "Reach out to 5 potential clients on LinkedIn" not "do some outreach."
- Be honest. If the market data shows something concerning, mention it.
- Keep it under 500 words total. This is a check-in, not an essay.`
    }],
  });
  
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

// ═══════════════════════════════════════════════════════════════════════
// MARKET PULSE SEARCH
// ═══════════════════════════════════════════════════════════════════════

async function searchMarketPulse(category: string): Promise<string> {
  const categoryTerms: Record<string, string> = {
    "video-editing": "freelance video editing market",
    "design": "freelance graphic design market",
    "writing": "freelance copywriting market",
    "social-media": "social media management freelance",
    "virtual-assistance": "virtual assistant freelance market",
    "coaching": "online coaching business",
    "consulting": "freelance consulting",
    "agency": "small agency market",
    "other": "freelance services market",
  };
  
  const searchTerm = categoryTerms[category] || "freelance services market";
  
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 800,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for recent news or changes in the ${searchTerm} space. Look for: pricing changes, new competitors, platform policy changes (Upwork/Fiverr), demand shifts, or anything a freelancer in this space should know about this week. Keep your summary to 3-4 bullet points of what's actually relevant.`
      }],
    });
    
    return response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  } catch {
    return "Market pulse search unavailable this week.";
  }
}

// ═══════════════════════════════════════════════════════════════════════
// BASIC CHECK-IN (no progress data available)
// ═══════════════════════════════════════════════════════════════════════

async function generateBasicCheckIn(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const userText = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n").slice(-3000);
  const assistantText = messages.filter((m) => m.role === "assistant").map((m) => m.content).join("\n").slice(-3000);
  
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `You are Zelrex. The user is asking for a check-in but no structured progress data is available yet.

Scan the conversation for:
- Any business the user is working on
- Any commitments previously given
- Any revenue or client numbers mentioned
- Any warning signs

CONVERSATION:
User: ${userText}
Zelrex: ${assistantText}

Generate a conversational check-in that:
1. Asks about any commitments you can find in the conversation
2. Asks 3 specific diagnostic questions: (a) Have you talked to any potential clients this week? (b) Have you made any revenue? (c) What did you spend your time on?
3. Gives ONE focus for this week
4. Sets 3 new commitments

If the user hasn't started anything yet, the focus should be: "Complete your evaluation and get your website built. Everything else comes after that."

Keep it conversational and under 400 words.`
    }],
  });
  
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}
